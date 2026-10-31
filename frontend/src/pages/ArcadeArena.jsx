import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw,
  LogOut,
  Sparkles,
  BookOpen,
  Trophy,
  Folder as FolderIcon,
  Home,
  Compass,
  AlertCircle,
  Flame,
  EyeOff,
  Star,
  SkipForward,
} from "lucide-react";

import QuestionModal from "../components/QuestionModal";
import CardDetailModal from "../components/CardDetailModal";
import ZenRelaxModal from "../components/ZenRelaxModal";
import StudyFolderManagerModal from "../components/StudyFolderManagerModal";
import InstitutionModal from "../components/InstitutionModal";
import UserAuthModal from "../components/UserAuthModal";
import AuthModal from "../components/AuthModal";
import SubscriptionModal from "../components/SubscriptionModal";
import TutorialModal from "../components/TutorialModal";
import VictoryModal from "../components/VictoryModal";
import WelcomeScreen from "../components/WelcomeScreen";
import GenerationOverlay from "../components/GenerationOverlay";
import AdventureMap from "../components/AdventureMap";
import LegalModal from "../components/LegalModal";
import CookieConsentBanner from "../components/CookieConsentBanner";
import CapyCompanion from "../components/CapyCompanion";
import RestartOptionsModal from "../components/RestartOptionsModal";
import A11yControls from "../components/A11yControls";
import HandTray from "../components/HandTray";
import BoardConsole from "../components/BoardConsole";
import { lockLandscape } from "../utils/orientation";
import HubziChatPanel from "../components/HubziChatPanel";
import { capyAudio } from "../utils/capyAudio";
import { capyVoice } from "../utils/capyVoice";
import { hubziAmbient } from "../utils/hubziAmbient";
import { lobbyAmbient } from "../utils/lobbyAmbient";
import { sfx } from "../utils/sfx";
import { detectDomainCategory } from "../utils/domainIcons";

import { fetchWithAuth } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { useCrisis, checkCrisisFlag } from "../lib/crisis.jsx";
import { GAME_LEVELS, levelName } from "../utils/gameConfig";
import { useTranslation } from "react-i18next";
import { analyzeIntentLocally } from "../utils/localNlp";
import { getDynamicLayout } from "../utils/boardLayout";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useHubziState, deriveHubziStatus } from "../hooks/useHubziState";
import { track } from "../utils/uxTelemetry";
import { bandForAge, getBand } from "../utils/ageConfig";

import { useGlobalMuted, setGlobalMuted, isGlobalMuted } from "../utils/globalMute";

export default function ArcadeArena() {
  const { reportCrisis } = useCrisis();
  // Estados de Niveles del Juego (1 a 5) y Mapa de Aventura
  const [currentLevel, setCurrentLevel] = useState(1);
  const [unlockedLevel, setUnlockedLevel] = useState(1);
  const [levelStars, setLevelStars] = useState({ 1: 0 });
  const [isMapVisible, setIsMapVisible] = useState(false);
  // El juego se diseñó para horizontal: pedir lock cuando el mapa abre
  // (manifest ya lo fuerza en PWA; esto cubre navegadores Android).
  useEffect(() => {
    if (isMapVisible) lockLandscape();
  }, [isMapVisible]);
  const [isLevelTransitioning, setIsLevelTransitioning] = useState(false);
  const [isRestartOptionsModalOpen, setIsRestartOptionsModalOpen] =
    useState(false);

  // Estados del juego (Vacíos al inicio: sólo se pueblan tras subir materiales)
  const [boardInfo, setBoardInfo] = useState(null);
  const [nodes, setNodes] = useState({});
  const [hand, setHand] = useState([]);
  const { t } = useTranslation();
  const [handPage, setHandPage] = useState(0); // Paginación inteligente del mazo (8 cartas por vista)
  const [flyingCard, setFlyingCard] = useState(null); // { card, targetPos, isOpponent }
  // Racha de aciertos consecutivos (feedback positivo — nunca castiga)
  const [streak, setStreak] = useState(0);
  const [successNotif, setSuccessNotif] = useState(null);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [errorNotif, setErrorNotif] = useState(null);
  // Estado consolidado de Hubzi (Fase 3.2): burbuja + mood + tristeza en
  // una sola fuente — useHubziState devuelve los mismos setters.
  const {
    capySpeech,
    setCapySpeech,
    capyMood,
    setCapyMood,
    isCapySad,
    setIsCapySad,
  } = useHubziState();
  const [isCapySpeaking, setIsCapySpeaking] = useState(false);
  // Mute GLOBAL persistente (voz + sfx + música) — vive en localStorage,
  // los motores de audio se suscriben solos a utils/globalMute.
  const isCapyMuted = useGlobalMuted();
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(false);
  const capySpeechTimeoutRef = React.useRef(null);
  const speakTimeoutRef = React.useRef(null);

  // Reconocimiento de Voz / Micrófono Interactivo con Capibara
  const [isThinkingHint, setIsThinkingHint] = useState(false);

  // Gestión de Usuario Activo y Autenticación (Email + Contraseña)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("hubzy_current_user");
      const parsed = saved ? JSON.parse(saved) : null;
      // Las sesiones de invitado ya no son válidas: se descartan.
      if (parsed?.is_guest) {
        localStorage.removeItem("hubzy_current_user");
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  // Banda de edad del jugador — gobierna densidad, celebración y presión
  const userAgeBand = currentUser?.age_band || bandForAge(currentUser?.age);
  const userBandConfig = getBand(userAgeBand);
  const kidMode = !userBandConfig.pressure;

  // Registro adaptativo BKT — la respuesta alimenta la maestría por tema
  // (p_mastery) que luego sugiere repasos en la pantalla de victoria.
  const recordAdaptiveAttempt = (node, correct) => {
    const domain =
      node?.domain === "trampa" ? "general" : node?.domain || "general";
    const topic = node?.answerSpec?.topic || domain;
    fetchWithAuth("/api/v1/adaptive/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, topic, correct }),
    })
      .then(async (res) => {
        if (res.ok) masteryRef.current[topic] = await res.json();
      })
      .catch(() => {});
  };

  // Pantalla Inicial de Bienvenida — actúa como MENÚ PRINCIPAL de la arena.
  // Siempre arranca visible (haya sesión o no): se oculta al entrar a
  // carpetas/juego con CONTINUAR y vuelve al cerrar carpetas o tocar MENÚ.
  const [isWelcomeScreenVisible, setIsWelcomeScreenVisible] = useState(true);

  // Modal de Login / Registro
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Modal secundario de edición de perfil (género, edad, apodo)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  // Cerrar Sesión
  const handleLogout = () => {
    localStorage.removeItem("hubzy_current_user");
    localStorage.removeItem("hubzy_auth_token");
    chatHistoryRef.current = []; // la memoria de Hubzi es privada por sesión
    setChatLog([]);
    useAuthStore.getState().logout();
    setCurrentUser(null);
    setIsAuthModalOpen(true);
  };

  // Confirmación de cierre de sesión (botón de cuenta en la bienvenida)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Modal de Suscripción Stripe (Hubzy Pro)
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

  // Modal Legal y Transparencia (Términos, Privacidad, Reembolsos, Cookies)
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState("terms");

  const handleOpenLegal = (tab = "terms") => {
    setLegalModalTab(tab);
    setIsLegalModalOpen(true);
  };

  // Escuchar si el usuario regresa de Stripe con ?payment=success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    if (payment === "success" && sessionId) {
      fetchWithAuth(`/api/v1/payments/verify-session/${sessionId}`)
        .then((res) => res.json())
        .then(async (data) => {
          if (data.is_paid) {
            setIsProModalOpen(true);
            // Resincronizar contra /auth/me: trae plan/pro_since reales de la DB
            await useAuthStore.getState().refreshUser();
            const fresh = useAuthStore.getState().user;
            const updated =
              fresh?.id && currentUser
                ? { ...fresh }
                : currentUser
                  ? { ...currentUser, plan: "pro" }
                  : null;
            if (updated) {
              setCurrentUser(updated);
              localStorage.setItem(
                "hubzy_current_user",
                JSON.stringify(updated),
              );
            }
          } else {
            setErrorNotif(t('arena.pay_pending'));
          }
        })
        .catch(() => setErrorNotif(t('arena.pay_verify_err')))
        .finally(() => {
          // Limpiar URL sin recargar
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        });
    } else if (payment === "cancelled") {
      setErrorNotif(t('arena.pay_cancel'));
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Retorno de Stripe del checkout INSTITUCIONAL (?school_payment=success)
    const schoolPayment = params.get("school_payment");
    if (schoolPayment === "success" && sessionId) {
      fetchWithAuth(`/api/v1/payments/verify-session/${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.is_paid) {
            setSuccessNotif(
              t('arena.school_pay_ok'),
            );
          } else {
            setSuccessNotif(
              t('arena.school_pay_pending'),
            );
          }
        })
        .catch(() => {
          setErrorNotif(
            t('arena.school_pay_fail'),
          );
        })
        .finally(() => {
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        });
    } else if (schoolPayment === "cancelled") {
      setErrorNotif(t('arena.school_pay_cancel'));
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Deep-link desde el Dashboard: /arena?upgrade=1 abre el modal Pro
    if (params.get("upgrade") === "1") {
      setIsSubscriptionModalOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [currentUser]);

  // Modales (Flujo: 1. Autenticación -> 2. Carpetas/Material -> 3. Zen Relax -> 4. Juego en Vivo)
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isInstitutionModalOpen, setIsInstitutionModalOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isVictoryModalOpen, setIsVictoryModalOpen] = useState(false);
  const [victoryStats, setVictoryStats] = useState({
    accuracy: 100,
    totalQuestions: 5,
  });
  const [activeFolder, setActiveFolder] = useState(null);
  const [activeIsland, setActiveIsland] = useState(null); // isla temática activa (null = campaña general)
  const [isRelaxModalOpen, setIsRelaxModalOpen] = useState(false);
  // Intervención emocional UNIFICADA (Fase 3.3): un solo sistema
  // escalonado — stage 0 nada · 1 sugerencia (banner) · 2 pausa Zen · 3 crisis.
  const [wellbeing, setWellbeing] = useState({
    stage: 0,
    category: "",
    distortion: "",
    emotion: "",
  });
  // Publica una oferta de apoyo sin degradar una etapa más alta activa.
  const offerSupport = (meta, stage = 1) =>
    setWellbeing((w) => (w.stage > stage ? w : { stage, ...meta }));
  const [isGeneratingArena, setIsGeneratingArena] = useState(false);
  const [genStage, setGenStage] = useState(null); // Etapa real reportada por el job async
  const [genProgress, setGenProgress] = useState(null); // % real reportado por el job
  const [genError, setGenError] = useState(null); // { message } — mantiene el overlay con opción de reintentar
  const genAbortRef = useRef(null); // AbortController de la generación en curso
  const lastGenRef = useRef(null); // último intento {level, folder, island, force} para reintentar
  const victoryConsumedRef = useRef(false); // true mientras el tablero completado siga en pantalla (anti victoria fantasma)
  const failedNodesRef = useRef(new Set()); // nodos con ≥1 intento fallido → precisión real
  const failStreakRef = useRef(0); // fallos consecutivos → trigger de apoyo Zen
  const lastFailedNodeRef = useRef(null); // último nodo fallado → pista dirigida
  const firstMoveTrackedRef = useRef(false); // funnel: 1er acierto por tablero

  // PRIMERA PARTIDA GUIADA: overlay paso a paso sobre el tablero real —
  // 1: toca una carta · 2: colócala en su casilla · 3: felicitación.
  // Solo se muestra la primera vez que se genera un tablero.
  const [guideStep, setGuideStep] = useState(0);
  const GUIDED_KEY = "hubzy_guided_done";
  const finishGuided = () => {
    try {
      localStorage.setItem(GUIDED_KEY, "1");
    } catch {}
    setGuideStep(0);
    setGuideTarget(null);
  };
  const streakGreetedRef = useRef(false); // saludo de racha 1× por sesión
  const masteryRef = useRef({}); // topic → {p_mastery, mastered, recommendation} (BKT)
  const chatHistoryRef = useRef([]); // memoria conversacional de Hubzi [{role, text}]
  // Chat visible (Fase 3.1): espejo en estado del historial para el panel.
  const [chatLog, setChatLog] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const pushChat = (role, text) => {
    chatHistoryRef.current.push({ role, text });
    if (chatHistoryRef.current.length > 12) chatHistoryRef.current.shift();
    setChatLog([...chatHistoryRef.current]);
  };
  const [guideTarget, setGuideTarget] = useState(null); // {cardId,nodeId} onboarding
  const breakOfferedRef = useRef(false); // micro-pausa sugerida una vez por sesión
  const [selectedNodeForQuestion, setSelectedNodeForQuestion] = useState(null);
  const [selectedCardForDetail, setSelectedCardForDetail] = useState(null);
  const [selectedCardInHand, setSelectedCardInHand] = useState(null);
  // Referencia estable para el memo de CardDetailModal.
  const closeCardDetail = useCallback(() => setSelectedCardForDetail(null), []);

  // Cerrar el baúl de carpetas: sin partida en curso la pantalla nunca
  // queda vacía — vuelve al menú principal (WelcomeScreen).
  const closeFolderModal = () => {
    setIsFolderModalOpen(false);
    if (Object.keys(nodes).length === 0) {
      setIsMapVisible(false);
      setIsWelcomeScreenVisible(true);
    }
  };

  // Con sesión iniciada y sin partida/mapa/menú visible, la arena no debe
  // quedar vacía: el baúl de carpetas se abre solo (p. ej. tras "Empezar").
  // Persistencia de vista de la arena: al recargar la página el jugador
  // vuelve exactamente donde estaba (menú, baúl, mapa o tablero) en vez de
  // caer siempre en la bienvenida.
  const ARENA_SESSION_KEY = "hubzy_arena_session";
  const arenaRestoreRef = useRef(false); // ya se intentó restaurar
  const sessionReadyRef = useRef(false); // la sesión ya puede sobrescribirse

  useEffect(() => {
    if (!currentUser || arenaRestoreRef.current) return;
    arenaRestoreRef.current = true;
    let sess = null;
    try {
      sess = JSON.parse(localStorage.getItem(ARENA_SESSION_KEY) || "null");
    } catch {}
    if (!sess || !sess.view || sess.view === "menu") {
      sessionReadyRef.current = true;
      return;
    }
    (async () => {
      try {
        setIsWelcomeScreenVisible(false);
        if (sess.view === "folders") {
          setIsFolderModalOpen(true);
          return;
        }
        // game / map: reconstruir la carpeta desde el backend o la caché local
        let folders = [];
        try {
          const res = await fetchWithAuth("/api/v1/folders");
          if (res.ok) folders = (await res.json())?.folders || [];
        } catch {}
        if (!folders.length) {
          try {
            const key = currentUser?.id
              ? `hubzy_user_study_folders_${currentUser.id}`
              : "hubzy_user_study_folders";
            folders = JSON.parse(localStorage.getItem(key) || "[]");
          } catch {}
        }
        const folder = folders.find((f) => f.id === sess.folderId);
        if (!folder) {
          setIsFolderModalOpen(true);
          return;
        }
        const island =
          (folder.islands || []).find((i) => i.id === sess.islandId) || null;
        hydrateCachedBoards(folder);
        setActiveFolder(folder);
        setActiveIsland(island);
        const lvl = sess.level || getResumeLevel(folder, island);
        setCurrentLevel(lvl);
        if (sess.view === "map") {
          setIsMapVisible(true);
        } else {
          await loadGameForLevel(lvl, folder, false, island);
        }
      } finally {
        sessionReadyRef.current = true;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      localStorage.removeItem(ARENA_SESSION_KEY);
      return;
    }
    if (!sessionReadyRef.current) return; // no pisar la sesión antes de restaurarla
    let view = "menu";
    if (Object.keys(nodes).length > 0 || isGeneratingArena) view = "game";
    else if (isMapVisible) view = "map";
    else if (isFolderModalOpen) view = "folders";
    try {
      localStorage.setItem(
        ARENA_SESSION_KEY,
        JSON.stringify({
          view,
          folderId: activeFolder?.id || null,
          islandId: activeIsland?.id || null,
          level: currentLevel,
        }),
      );
    } catch {}
  }, [
    currentUser,
    nodes,
    isGeneratingArena,
    isMapVisible,
    isFolderModalOpen,
    isWelcomeScreenVisible,
    activeFolder,
    activeIsland,
    currentLevel,
  ]);

  // Accesibilidad (A11y): Cerrar cualquier modal activo al presionar la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isLogoutConfirmOpen) setIsLogoutConfirmOpen(false);
        else if (isLegalModalOpen) setIsLegalModalOpen(false);
        else if (selectedNodeForQuestion) setSelectedNodeForQuestion(null);
        else if (selectedCardForDetail) setSelectedCardForDetail(null);
        else if (selectedCardInHand) setSelectedCardInHand(null);
        else if (isChatOpen) setIsChatOpen(false);
        else if (isFolderModalOpen) closeFolderModal();
        else if (isTutorialOpen) setIsTutorialOpen(false);
        else if (isSubscriptionModalOpen) setIsSubscriptionModalOpen(false);
        else if (isRelaxModalOpen) setIsRelaxModalOpen(false);
        else if (isUserModalOpen) setIsUserModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isLogoutConfirmOpen,
    isLegalModalOpen,
    selectedNodeForQuestion,
    selectedCardForDetail,
    selectedCardInHand,
    isChatOpen,
    isFolderModalOpen,
    isTutorialOpen,
    isSubscriptionModalOpen,
    isRelaxModalOpen,
    isUserModalOpen,
  ]);

  // AYUDA PEDAGÓGICA ANTI-FRUSTRACIÓN: Flecha y destello tras 30s de inactividad
  const [hintCardId, setHintCardId] = useState(null);
  const [hintNodeId, setHintNodeId] = useState(null);
  const lastActionTimestampRef = React.useRef(Date.now());

  // Feedback visual del nodo ante un intento: { nodeId, kind, seq, points }.
  // 'wrong' → pulso ámbar + sacudida suave; 'correct' → estrella + puntos.
  // seq incrementa por evento para re-disparar la animación en el mismo nodo.
  const [nodeFx, setNodeFx] = useState(null);
  const nodeFxSeqRef = useRef(0);
  const fireNodeFx = (nodeId, kind, points = 0) => {
    nodeFxSeqRef.current += 1;
    setNodeFx({ nodeId, kind, seq: nodeFxSeqRef.current, points });
  };

  // Preview de drop en vivo: nodo bajo el puntero durante el arrastre +
  // si la carta encajaría ahí (feedback pre-drop rojo tenue/naranja).
  const [dragPreview, setDragPreview] = useState(null); // { cardId, nodeId, correct }
  const dragPreviewRef = useRef(null);
  const setDragPreviewIfChanged = (next) => {
    const prev = dragPreviewRef.current;
    if (
      prev?.cardId === next?.cardId &&
      prev?.nodeId === next?.nodeId &&
      prev?.correct === next?.correct
    )
      return;
    dragPreviewRef.current = next;
    setDragPreview(next);
  };

  // Revelación de carta trampa: micro-animación de "descubrimiento" al
  // fallar con una distractora — explica qué era falso antes de desvanecer.
  const [trapReveal, setTrapReveal] = useState(null); // { card, nodeLabel }
  useEffect(() => {
    if (!trapReveal) return;
    const t = setTimeout(() => setTrapReveal(null), 2600);
    return () => clearTimeout(t);
  }, [trapReveal]);

  // Layout adaptativo móvil: lista compacta de nodos + deck horizontal
  // (sin escala de "laptop" — UI real a tamaño táctil).

  // Hubzi reactiva: nudge suave si llevas >40s sin actuar (una vez por
  // racha de inactividad). idleBlinkSeq re-dispara su parpadeo.
  const idleNudgeRef = useRef(false);
  const [idleBlinkSeq, setIdleBlinkSeq] = useState(0);

  // Reiniciar temporizador con cualquier interacción
  const registerUserActivity = () => {
    lastActionTimestampRef.current = Date.now();
    idleNudgeRef.current = false;
    if (hintCardId) {
      setHintCardId(null);
      setHintNodeId(null);
    }
  };

  // Temporizador de 60 segundos de inactividad para la pista de Hubzi
  useEffect(() => {
    const checkInterval = setInterval(() => {
      // Solo disparar si hay una partida en curso y cartas en mano
      if (
        hand.length > 0 &&
        Object.keys(nodes).length > 0 &&
        !isVictoryModalOpen
      ) {
        const elapsed = (Date.now() - lastActionTimestampRef.current) / 1000;
        if (elapsed >= 60 && !hintCardId) {
          // Encontrar el primer nodo vacío que aún no tenga carta colocada
          const emptyNode = Object.values(nodes).find((n) => !n.placedCard);
          if (emptyNode) {
            // Buscar la carta en la mano que corresponde a este nodo
            const matchingCard = hand.find(
              (c) =>
                (emptyNode.correctCardId &&
                  String(emptyNode.correctCardId) === String(c.id)) ||
                (c.matchesNodeId &&
                  String(c.matchesNodeId) === String(emptyNode.id)) ||
                (emptyNode.label &&
                  c.name &&
                  emptyNode.label.trim().toLowerCase() ===
                    c.name.trim().toLowerCase()),
            );

            if (matchingCard) {
              setHintCardId(matchingCard.id);
              setHintNodeId(emptyNode.id);
              setSuccessNotif(
                t('arena.hint_belongs', { label: emptyNode.label || t('arena.pending_slot') }),
              );
            }
          }
        }

        // NUDGE DE COMPAÑÍA (>40s inactivo): Hubzi parpadea y pregunta
        // "¿seguimos?" — presencia sin presión, una vez por racha de calma.
        if (elapsed >= 40 && !idleNudgeRef.current) {
          idleNudgeRef.current = true;
          setIdleBlinkSeq((s) => s + 1);
          triggerCapyVoice("hint", {
            customText:
              t('arena.idle_nudge'),
            profile: "loving_psychologist",
          });
        }
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [hand, nodes, hintCardId, isVictoryModalOpen]);

  const [playerScore, setPlayerScore] = useState(0);

  // Modo Solitario Zen sin contrincante: El estudiante juega a su propio ritmo sin presiones
  const isActualTurn = true;

  // Sincronización de eventos de voz de Capibara
  useEffect(() => {
    const unsubscribe = capyVoice.subscribe((state) => {
      setIsCapySpeaking(state.isSpeaking);
      // Ducking: la música baja mientras Hubzi habla — su voz manda.
      hubziAmbient.duck(state.isSpeaking);
      if (!state.isSpeaking) {
        if (capySpeechTimeoutRef.current)
          clearTimeout(capySpeechTimeoutRef.current);
        capySpeechTimeoutRef.current = setTimeout(() => {
          // La oferta de pista (tras 2 fallos) espera al jugador: no se
          // auto-oculta — desaparece al aceptarla o con la siguiente frase.
          setCapySpeech((prev) =>
            prev.showHintButton ? prev : { ...prev, isVisible: false },
          );
          setCapyMood("idle");
          setIsCapySad(false);
        }, 3200);
      }
    });
    // Sincronización de estado de música ambient
    const unsubscribeAmbient = hubziAmbient.subscribe((state) => {
      setIsAmbientPlaying(state.isPlaying);
    });
    return () => {
      unsubscribe();
      unsubscribeAmbient();
      if (capySpeechTimeoutRef.current)
        clearTimeout(capySpeechTimeoutRef.current);
    };
  }, []);

  // Al desmontar la arena: soltar voz de Hubzi, música ambient y cualquier
  // generación en vuelo — sin esto seguían sonando/corriendo sin pantalla.
  useEffect(() => {
    return () => {
      try {
        capyVoice.stop();
      } catch (_) {}
      try {
        hubziAmbient.stop(0);
      } catch (_) {}
      try {
        lobbyAmbient.stop(0);
      } catch (_) {}
      try {
        genAbortRef.current?.abort();
      } catch (_) {}
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
      if (capySpeechTimeoutRef.current) clearTimeout(capySpeechTimeoutRef.current);
    };
  }, []);

  // -------------------------------------------------------------------
  // Progreso de campaña persistente (estrellas, nivel desbloqueado y actual)
  // -------------------------------------------------------------------

  // Claves por isla: cada tema tiene su propia campaña y su propio caché.
  const campaignKey = (folderId, islandId) =>
    `hubzy_campaign_progress_${folderId}${islandId ? `_${islandId}` : ""}`;
  const lvlCacheKey = (lvl, island) =>
    island ? `${island.id}__level_${lvl}` : `level_${lvl}`;
  const islandQuery = (island) => (island ? `&island_id=${island.id}` : "");

  // El GET /folders excluye cached_boards (payload pesado): los re-hidratamos
  // desde el espejo localStorage para que entrar a una isla ya generada sea
  // instantáneo en vez de pasar por el job del backend.
  const hydrateCachedBoards = (folder) => {
    try {
      const key = currentUser?.id
        ? `hubzy_user_study_folders_${currentUser.id}`
        : "hubzy_user_study_folders";
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      const match = saved.find((f) => f.id === folder.id);
      if (match?.cached_boards && !folder.cached_boards) {
        folder.cached_boards = match.cached_boards;
      }
      if (match?.cached_board && !folder.cached_board) {
        folder.cached_board = match.cached_board;
      }
    } catch {}
    return folder;
  };

  // Niveles de la campaña activa: los de la isla o los 20 de la carpeta
  const maxLevel = activeIsland?.total_levels || 20;
  const activeLevels =
    maxLevel < GAME_LEVELS.length ? GAME_LEVELS.slice(0, maxLevel) : GAME_LEVELS;

  // Hidratar progreso al cambiar de carpeta/isla: primero del objeto
  // (GET /folders incluye campaign_progress e islands[].campaign_progress)
  // y si no hay, del espejo local.
  useEffect(() => {
    if (!activeFolder?.id) return;
    const cap = activeIsland?.total_levels || 20;
    let stars = { 1: 0 };
    let unlocked = 1;
    let current = 1;
    const p = activeIsland
      ? activeIsland.campaign_progress
      : activeFolder.campaign_progress;
    if (p && (p.level_stars || p.unlocked_level > 1)) {
      stars =
        p.level_stars && Object.keys(p.level_stars).length
          ? p.level_stars
          : { 1: 0 };
      unlocked = Math.min(cap, Math.max(1, p.unlocked_level || 1));
      current = Math.min(cap, Math.max(1, p.current_level || unlocked));
    } else {
      try {
        const saved = JSON.parse(
          localStorage.getItem(
            campaignKey(activeFolder.id, activeIsland?.id),
          ) || "null",
        );
        if (saved) {
          if (saved.level_stars && Object.keys(saved.level_stars).length)
            stars = saved.level_stars;
          if (saved.unlocked_level)
            unlocked = Math.min(cap, Math.max(1, saved.unlocked_level));
          if (saved.current_level)
            current = Math.min(cap, Math.max(1, saved.current_level));
        }
      } catch {}
    }
    setLevelStars(stars);
    setUnlockedLevel(unlocked);
    setCurrentLevel(current);

    // Repaso espaciado suave: si lleva ≥2 días sin jugar esta carpeta,
    // Hubzi lo celebra al volver (retención sin culpa — jamás un regaño).
    const lastPlayed = p?.last_played_at;
    if (lastPlayed && unlocked > 1) {
      const days = Math.floor(
        (Date.now() - new Date(lastPlayed).getTime()) / 86400000,
      );
      if (days >= 2) {
        setCapyMood("encouraging");
        setCapySpeech({
          text: t('arena.welcome_back', { days }),
          isVisible: true,
          mood: "encouraging",
        });
      }
    }
    // Solo hidratar al cambiar de carpeta/isla: persistCampaignProgress
    // actualiza el progreso y no debe pisar el estado local más fresco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFolder?.id, activeIsland?.id]);

  // Micro-pausa anti-fatiga: tras ~25 min de juego activo en un tablero,
  // Hubzi sugiere respirar. Oferta suave (jamás bloqueo), una vez por sesión.
  const hasActiveBoard = Object.keys(nodes).length > 0;
  useEffect(() => {
    if (!hasActiveBoard || breakOfferedRef.current) return;
    const t = setTimeout(() => {
      if (breakOfferedRef.current) return;
      breakOfferedRef.current = true;
      offerSupport({ category: "pausa activa", emotion: "fatiga" }, 1);
      setCapyMood("encouraging");
      setCapySpeech({
        text: t('arena.break_offer'),
        isVisible: true,
        mood: "encouraging",
      });
    }, 25 * 60 * 1000);
    return () => clearTimeout(t);
  }, [hasActiveBoard]);

  // Horizontal también al entrar al tablero directo (isla → Jugar, sin mapa)
  useEffect(() => {
    if (hasActiveBoard) lockLandscape();
  }, [hasActiveBoard]);

  // ORQUESTACIÓN MUSICAL: el lobby suena desde el inicio, en carpetas y en
  // el mapa; al cargar el tablero toma el mando el ambient del juego (y el
  // lobby se apaga). Sin tablero no suena música de juego.
  useEffect(() => {
    if (hasActiveBoard) {
      lobbyAmbient.stop(0.6);
      return hubziAmbient.autoStart();
    }
    hubziAmbient.stop(0.6);
    if (currentUser) lobbyAmbient.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActiveBoard, currentUser]);

  // Nivel desde el que continuar: del progreso del servidor o del espejo local
  const getResumeLevel = (folder, island = null) => {
    const cap = island?.total_levels || 20;
    const p = island ? island.campaign_progress : folder?.campaign_progress;
    let lvl = p?.current_level || p?.unlocked_level || 1;
    if (lvl <= 1) {
      try {
        const s = JSON.parse(
          localStorage.getItem(campaignKey(folder.id, island?.id)) || "null",
        );
        if (s?.current_level) lvl = s.current_level;
        else if (s?.unlocked_level) lvl = s.unlocked_level;
      } catch {}
    }
    return Math.min(cap, Math.max(1, lvl));
  };

  // Persistencia de victoria UNIFICADA: los 4 botones del modal la llaman
  // antes de divergir — una victoria de 1★ ya no se pierde al ir al menú,
  // y repetir/repasar tampoco abandona estrellas ni XP. El merge del backend
  // es max-wins, así que es seguro llamarla más de una vez por nivel.
  const persistVictoryProgress = (targetCurrent) => {
    const earnedStars =
      victoryStats.accuracy >= 90 ? 3 : victoryStats.accuracy >= 70 ? 2 : 1;
    const nextStars = {
      ...levelStars,
      [currentLevel]: Math.max(levelStars[currentLevel] || 0, earnedStars),
    };
    const nextUnlocked =
      currentLevel < maxLevel
        ? Math.max(unlockedLevel, currentLevel + 1)
        : unlockedLevel;
    setLevelStars(nextStars);
    if (currentLevel < maxLevel) setUnlockedLevel(nextUnlocked);
    persistCampaignProgress({
      level_stars: nextStars,
      unlocked_level: nextUnlocked,
      current_level: targetCurrent,
      xp_gained: playerScore,
    });
    return nextUnlocked;
  };

  // Guardar progreso: espejo localStorage (offline) + servidor.
  const persistCampaignProgress = (progress) => {
    if (!activeFolder?.id) return;
    try {
      localStorage.setItem(
        campaignKey(activeFolder.id, activeIsland?.id),
        JSON.stringify(progress),
      );
    } catch {}
    setActiveFolder((prev) => {
      if (!prev) return prev;
      if (activeIsland) {
        return {
          ...prev,
          islands: (prev.islands || []).map((i) =>
            i.id === activeIsland.id
              ? { ...i, campaign_progress: progress }
              : i,
          ),
        };
      }
      return { ...prev, campaign_progress: progress };
    });
    // La carpeta demo es efímera: el progreso solo vive en memoria/local.
    if (activeFolder.is_demo) return;
    fetchWithAuth(`/api/v1/folders/${activeFolder.id}/campaign-progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...progress,
        island_id: activeIsland?.id,
        total_levels: activeIsland?.total_levels,
        // Día LOCAL del jugador para la racha (el servidor usaría UTC y
        // partiría sesiones nocturnas contra el día equivocado).
        study_date: new Date().toLocaleDateString("sv-SE"),
      }),
    }).catch((e) => console.warn("No se pudo guardar el progreso:", e));
  };

  // Auto-cierre de toasts: cada notificación nueva reinicia su timer — los
  // setTimeout manuales encadenados mataban la notificación NUEVA cuando
  // expiraba el timer de la anterior.
  useEffect(() => {
    if (!successNotif) return;
    const t = setTimeout(() => setSuccessNotif(null), 5000);
    return () => clearTimeout(t);
  }, [successNotif]);
  useEffect(() => {
    if (!errorNotif) return;
    const t = setTimeout(() => setErrorNotif(null), 5500);
    return () => clearTimeout(t);
  }, [errorNotif]);

  // Snapshot del progreso para guardar al ocultar/salir de la pestaña.
  const progressSnapshotRef = useRef(null);
  useEffect(() => {
    progressSnapshotRef.current = {
      level_stars: levelStars,
      unlocked_level: unlockedLevel,
      current_level: currentLevel,
    };
  }, [levelStars, unlockedLevel, currentLevel]);

  useEffect(() => {
    const onHide = () => {
      if (
        document.visibilityState === "hidden" &&
        progressSnapshotRef.current?.unlocked_level > 1
      ) {
        persistCampaignProgress(progressSnapshotRef.current);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFolder?.id, activeIsland?.id]);

  // Reiniciar campaña completa (estrellas y desbloqueo vuelven al nivel 1).
  const handleResetCampaign = async () => {
    if (!activeFolder?.id) return;
    if (
      !window.confirm(
        t('arena.confirm_reset'),
      )
    )
      return;
    setLevelStars({ 1: 0 });
    setUnlockedLevel(1);
    setCurrentLevel(1);
    try {
      localStorage.removeItem(
        campaignKey(activeFolder.id, activeIsland?.id),
      );
    } catch {}
    setActiveFolder((prev) => {
      if (!prev) return prev;
      if (activeIsland) {
        return {
          ...prev,
          islands: (prev.islands || []).map((i) =>
            i.id === activeIsland.id ? { ...i, campaign_progress: null } : i,
          ),
        };
      }
      return { ...prev, campaign_progress: null };
    });
    await fetchWithAuth(
      `/api/v1/folders/${activeFolder.id}/campaign-progress${activeIsland ? `?island_id=${activeIsland.id}` : ""}`,
      { method: "DELETE" },
    ).catch((e) => console.warn("No se pudo reiniciar el progreso:", e));
    setSuccessNotif(t('arena.reset_done'));
  };

  // Función principal para activar la voz tierna y reacciones de Capibara
  // Control estricto anti-colisión + nuevos moods expresivos
  const triggerCapyVoice = async (situation, customData = {}) => {
    // Con mute global la burbuja SIGUE informando (accesibilidad: el texto
    // es el canal de pistas) — solo el audio se silencia.
    const muted = isGlobalMuted();

    capyVoice.stop();
    if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);

    const level = customData.level || currentLevel || 1;
    const theme = customData.theme || boardInfo?.theme || "";

    let phrase = customData.customText;
    if (!phrase) {
      phrase = await capyVoice.getDynamicSpeech(situation, {
        level,
        theme,
        ...customData,
      });
    }

    // Mapa de situaciones a moods expresivos del Capibara
    let mood = "talking";
    if (situation === "level_up")
      mood = "dancing"; // BAILE al subir de nivel
    else if (situation === "victory")
      mood = "celebrating"; // CELEBRACIÓN en victoria
    else if (situation === "welcome")
      mood = "love"; // AMOR al dar bienvenida
    else if (situation === "correct")
      mood = "happy"; // FELIZ en respuesta correcta
    else if (situation === "wrong")
      mood = "encouraging"; // TRISTEZA en error
    else if (situation === "hint")
      mood = "thinking"; // PENSANDO en pista
    else if (situation === "opponent_move") mood = "surprised"; // SORPRESA

    setCapyMood(mood);
    setCapySpeech({ text: phrase, isVisible: true, mood });

    if (capySpeechTimeoutRef.current)
      clearTimeout(capySpeechTimeoutRef.current);

    const speakOpts = {
      mood,
      level,
      stress_level: customData.stress_level,
      profile:
        customData.profile ||
        (situation === "wrong" ? "anxiety_relief" : "loving_psychologist"),
      user: currentUser,
      user_gender: currentUser?.gender,
      voice_gender: currentUser?.assigned_voice_gender,
    };

    if (muted) {
      // Mute global: no hay audio — la burbuja se auto-oculta como si la
      // voz hubiera terminado (capyVoice nunca notificará isSpeaking).
      setIsCapySad(situation === "wrong");
      capySpeechTimeoutRef.current = setTimeout(() => {
        setCapySpeech((prev) =>
          prev.showHintButton ? prev : { ...prev, isVisible: false },
        );
        setCapyMood("idle");
        setIsCapySad(false);
      }, 5200);
      return;
    }

    if (situation === "wrong") {
      setIsCapySad(true);
      capyAudio.playCapyCry();
      speakTimeoutRef.current = setTimeout(() => {
        capyVoice.speak(phrase, speakOpts);
      }, 350);
    } else if (
      situation === "correct" ||
      situation === "level_up" ||
      situation === "victory"
    ) {
      setIsCapySad(false);
      capyAudio.playCapyHappy();
      speakTimeoutRef.current = setTimeout(() => {
        capyVoice.speak(phrase, speakOpts);
      }, 250);
    } else {
      setIsCapySad(false);
      capyVoice.speak(phrase, speakOpts);
    }
  };

  // ============================================================
  // NLP ESTÁTICO LOCAL — Analiza intención del usuario sin red
  // Siempre funciona offline, coherente con el contexto del juego
  // ============================================================
  const runLocalIntent = (transcript, nodesCtx, handCtx) =>
    analyzeIntentLocally(transcript, nodesCtx, handCtx, {
      boardTitle: boardInfo?.title,
      username: capyVoice.currentUser?.username,
    });

  // Clic directo en la Capibara: genera orientación psicológica o pista dinámica
  const handleCapyClick = async () => {
    const unsolvedNodes = Object.values(nodes).filter(
      (n) => !n.placedCard && !n.lockedByOpponent,
    );
    if (unsolvedNodes.length === 0) {
      triggerCapyVoice("victory", { profile: "loving_psychologist" });
      return;
    }
    const target =
      unsolvedNodes[Math.floor(Math.random() * unsolvedNodes.length)];
    const hintSnippet =
      target.hint ||
      target.question ||
      t('arena.observe_cards');
    triggerCapyVoice("hint", {
      label: target.label,
      hintText: t('arena.hint_for', { label: target.label, hint: hintSnippet.slice(0, 90) }),
      profile: "loving_psychologist",
    });
  };

  // Aceptar la oferta de pista de la burbuja (2 fallos seguidos): pista
  // dirigida al nodo que costó trabajo, no aleatoria como el clic normal.
  const acceptHintOffer = () => {
    const node =
      lastFailedNodeRef.current && nodes[lastFailedNodeRef.current];
    if (node && !node.placedCard) {
      const hintSnippet =
        node.hint ||
        node.question ||
        t('arena.observe_cards');
      triggerCapyVoice("hint", {
        label: node.label,
        hintText: t('arena.hint_for', { label: node.label, hint: hintSnippet.slice(0, 90) }),
        profile: "loving_psychologist",
      });
    } else {
      handleCapyClick();
    }
  };

  // Manejo de la pregunta por voz — NLP backend + fallback NLP estático local inteligente
  const handleUserVoiceQuery = async (transcript) => {
    setIsThinkingHint(true);
    setCapyMood("thinking");
    setCapySpeech({
      text: t('arena.heard_you', { text: transcript }),
      isVisible: true,
      mood: "thinking",
    });

    // Registrar el mensaje del usuario en la memoria conversacional (máx 12)
    pushChat("user", transcript);
    const historyPayload = chatHistoryRef.current.slice(0, -1); // sin el actual

    // Intentar NLP del backend con timeout de 8s (Gemini necesita más que 3s)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetchWithAuth("/api/v1/arena/capy-ask", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: transcript,
          history: historyPayload,
          nodes: Object.values(nodes).map((n) => ({
            label: n.label,
            question: n.question,
            hint: n.hint,
            isSolved: Boolean(n.placedCard || n.lockedByOpponent),
          })),
          hand: hand.map((c) => ({
            name: c.name,
            domain: c.domain,
            isDistractor: Boolean(c.isDistractor),
          })),
          theme: boardInfo?.title || t('arena.sim_exam'),
          user_profile: currentUser || {},
        }),
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const reply =
          data.reply || t('arena.check_cards');
        const psych = data.psychology;
        checkCrisisFlag(data, () => {
          offerSupport({ category: "apoyo inmediato" }, 3);
          reportCrisis();
        });
        setIsThinkingHint(false);

        // Guardar la respuesta de Hubzi en la memoria
        pushChat("capi", reply);

        if (
          psych?.needs_somatic_intervention ||
          (psych?.stress_level && psych.stress_level >= 0.5)
        ) {
          setCapyMood("love");
          offerSupport(
            {
              category: psych.stress_category || "tensión acumulada",
              distortion: psych.cognitive_distortion || "",
              emotion: psych.emotion_detected || "ansiedad",
            },
            psych.needs_somatic_intervention ? 2 : 1,
          );
          if (psych.needs_somatic_intervention) setIsRelaxModalOpen(true);
          triggerCapyVoice("encouraging", {
            customText: reply,
            stress_level: psych.stress_level,
            profile:
              psych.stress_level >= 0.8 ? "crisis_soothing" : "anxiety_relief",
          });
        } else {
          triggerCapyVoice("hint", {
            customText: reply,
            stress_level: psych?.stress_level,
            profile: "loving_psychologist",
          });
        }
        return;
      }
    } catch (e) {
      // Backend caído o timeout — NLP local estático inteligente
      console.warn("Backend no disponible, usando NLP local:", e?.message || e);
    }

    // NLP ESTÁTICO LOCAL — siempre coherente con el tablero actual
    setIsThinkingHint(false);
    const local = runLocalIntent(transcript, nodes, hand);

    if (local.needsZen) {
      offerSupport({ category: "estrés detectado", emotion: "frustración" }, 1);
    }

    setCapyMood(local.mood);
    setCapySpeech({ text: local.reply, isVisible: true, mood: local.mood });
    pushChat("capi", local.reply);
    capyVoice.speak(local.reply, {
      mood: local.mood,
      level: currentLevel,
      user: currentUser,
      user_gender: currentUser?.gender,
      voice_gender: currentUser?.assigned_voice_gender,
    });
  };

  // Micrófono con mensajes emotivos y NLP funcional
  const { isListening, toggleMicrophone } = useSpeechRecognition({
    onTranscript: handleUserVoiceQuery,
    // Transcripción interim EN VIVO dentro de la burbuja de Hubzi — el
    // jugador ve lo que el micrófono va captando antes del resultado final.
    onInterim: (text) => {
      if (text) {
        setCapyMood("listening");
        setCapySpeech({
          text,
          isVisible: true,
          mood: "listening",
          interim: true,
        });
      } else {
        // Solo cerrar si la burbuja visible ES la transcripción viva — no
        // pisar una frase de Hubzi que llegó entremedio.
        setCapySpeech((prev) =>
          prev.interim ? { ...prev, isVisible: false, interim: false } : prev,
        );
      }
    },
    onFeedback: (text) => {
      setCapyMood("love");
      setCapySpeech({ text, isVisible: true, mood: "love" });
    },
  });

  // Comprobación de conclusión del circuito (Campaña de 20 niveles)
  useEffect(() => {
    const nodeValues = Object.values(nodes);
    if (nodeValues.length > 0) {
      // El circuito concluye cuando el estudiante ha completado todos los conceptos
      const allNodesCompleted = nodeValues.every((n) => Boolean(n.placedCard));
      if (
        allNodesCompleted &&
        !victoryConsumedRef.current &&
        !isLevelTransitioning &&
        !isVictoryModalOpen
      ) {
        victoryConsumedRef.current = true; // se resetea al cargar un tablero NUEVO
        setIsLevelTransitioning(true);

        // Precisión real: % de nodos resueltos al primer intento (honestidad pedagógica)
        const totalQ = nodeValues.length;
        const failedNodes = nodeValues.filter((n) =>
          failedNodesRef.current.has(n.id),
        );
        const accuracyCalc = Math.round(
          ((totalQ - failedNodes.length) / totalQ) * 100,
        );

        // Repaso inteligente: temas que fallaron O donde el motor BKT
        // aún estima maestría baja (incluye sesiones previas)
        const weakTopics = new Set(
          failedNodes
            .map((n) => n.answerSpec?.topic || n.label)
            .filter(Boolean),
        );
        Object.entries(masteryRef.current).forEach(([topic, m]) => {
          if (
            m?.recommendation?.action === "remediate" ||
            (typeof m?.p_mastery === "number" && m.p_mastery < 0.4)
          ) {
            weakTopics.add(topic);
          }
        });

        setVictoryStats({
          accuracy: accuracyCalc,
          totalQuestions: totalQ,
          firstTry: Math.max(0, totalQ - failedNodes.length),
          weakNodes: [...weakTopics],
        });
        track("level_done", {
          level: currentLevel,
          accuracy: accuracyCalc,
          questions: totalQ,
        });

        sfx.victory();
        // Hubzi celebra la ESTRELLA NUEVA: solo cuando el récord del nivel
        // mejora (primera vez o más estrellas que antes) — repetir con el
        // mismo resultado usa la celebración normal.
        const earnedStars =
          accuracyCalc >= 90 ? 3 : accuracyCalc >= 70 ? 2 : 1;
        const isNewStarRecord =
          earnedStars > (levelStars[currentLevel] || 0);
        triggerCapyVoice("victory", {
          level: currentLevel,
          customText: isNewStarRecord
            ? t('arena.victory_stars', { stars: earnedStars === 1 ? t('arena.star_one') : t('arena.star_many', { count: earnedStars }) })
            : undefined,
        });
        setIsVictoryModalOpen(true);
      }
    }
    // triggerCapyVoice cambia cada render; incluirla re-dispararía la detección de victoria.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, currentLevel, isLevelTransitioning, isVictoryModalOpen]);



  // GENERADOR DINÁMICO DE POSICIONES Y TOPOLOGÍA PARA CUALQUIER NÚMERO DE PREGUNTAS (1 A 20)
  // HELPER: Configurar tablero y cartas con enlace 1-a-1 y posiciones dinámicas
  const applyBoardData = (
    boardData,
    folderName,
    level = currentLevel,
    island = activeIsland,
  ) => {
    if (!boardData.cards || boardData.cards.length === 0) return false;

    const lvlInfo =
      GAME_LEVELS.find((l) => l.level === level) || GAME_LEVELS[0];

    // Separar cartas reales de las TRAMPA antes de cortar: un slice ciego
    // podía meter una trampa como "carta correcta" o dejar un nodo sin su
    // match — nivel imposible de terminar (soft-lock).
    const isTrapCard = (c) =>
      c.is_distractor ||
      c.isDistractor ||
      String(c.id || "").includes("distractor") ||
      String(c.id || "").includes("trap");
    const realCards = (boardData.cards || []).filter((c) => !isTrapCard(c));
    const backendTrapCards = (boardData.cards || []).filter(isTrapCard);

    // REGLA ESTRICTA: El Nivel K debe tener exactamente K preguntas (N1 = 1, N2 = 2, N3 = 3 ... N20 = 20)
    const targetQuestions = Math.min(
      lvlInfo.questions,
      Math.max(1, boardData.nodes.length),
      Math.max(1, realCards.length),
    );
    const activeNodes = boardData.nodes.slice(0, targetQuestions);
    const activeMatchingCards = realCards.slice(0, targetQuestions);

    setBoardInfo({
      title:
        boardData.title ||
        (folderName ? folderName.toUpperCase() : t('arena.study_board')),
      theme: folderName || t('arena.study'),
      levelInfo: lvlInfo,
    });

    const dynamicPositions = getDynamicLayout(activeNodes.length);
    const availableShapes = [
      "hexagon",
      "circle",
      "diamond",
      "octagon",
      "squircle",
    ];

    // Detección automática del tema y disciplina académica real del documento/carpeta
    const activeTheme = folderName || boardData.title || t('arena.study');
    const detectedCategory = detectDomainCategory(
      `${activeTheme} ${boardData.title || ""}`,
    );

    // Colores ordenados o barajados
    const shuffledColors = [
      "orange",
      "purple",
      "blue",
      "dark",
      "salmon",
      "white",
    ];
    const chosenShape =
      availableShapes[Math.floor(Math.random() * availableShapes.length)];

    const newNodes = {};
    // Cada nodo se liga 1-a-1 con su carta correcta (por índice)
    activeNodes.forEach((n, idx) => {
      const matchingCard = activeMatchingCards[idx];
      const cardId = matchingCard?.id || `card_${idx + 1}`;
      const conceptLabel =
        n.label || matchingCard?.concept_name || t('arena.concept_n', { n: idx + 1 });
      const questionText =
        n.question ||
        n.description ||
        t('arena.question_default');
      const hintText =
        n.description || t('arena.hint_doc');

      newNodes[n.id] = {
        id: n.id,
        domain: detectedCategory,
        theme: activeTheme,
        label: conceptLabel,
        question: questionText,
        questionLatex: n.question_latex || null,
        answerSpec: n.answer_spec || null,
        hint: hintText,
        nodeIndex: idx,
        pos: dynamicPositions[idx % dynamicPositions.length],
        color: shuffledColors[idx % shuffledColors.length],
        shape: chosenShape,
        placedCard: null,
        lockedByOpponent: false,
        correctCardId: cardId,
      };
    });

    // Mapear cartas base coincidentes con los nodos activos de este nivel
    const processedCards = activeMatchingCards.map((c, i) => {
      return {
        id: c.id,
        name: c.concept_name,
        cost: c.points_multiplier || "1x",
        type: shuffledColors[i % shuffledColors.length],
        sourceType: "document",
        domain: detectedCategory,
        theme: activeTheme,
        cardIndex: i,
        content: c.content || t('arena.answer_default'),
        matchesNodeId: activeNodes[i]?.id || null,
        isDistractor: false,
      };
    });

    // REGLA DE CARTAS TRAMPA: A partir del Nivel 3 se inyectan cartas trampa en el mazo.
    // Preferir las trampas REALES del backend (conceptos incorrectos del doc)
    // antes que los placeholders genéricos.
    const levelHasTraps = lvlInfo.hasTraps;
    const requiredTrapCount = levelHasTraps ? lvlInfo.trapCount || 1 : 0;
    backendTrapCards.slice(0, requiredTrapCount).forEach((c, i) => {
      processedCards.push({
        id: c.id || `card_trap_backend_${i + 1}`,
        name: c.concept_name || c.name || t('arena.wrong_claim'),
        cost: c.points_multiplier || "1x",
        type: "dark",
        sourceType: "document",
        domain: "trampa",
        content: c.content || t('arena.trap_content'),
        matchesNodeId: null,
        isDistractor: true,
        isTrap: true,
      });
    });
    const currentDistractorCount = processedCards.filter(
      (c) => c.isDistractor,
    ).length;

    if (requiredTrapCount > 0 && currentDistractorCount < requiredTrapCount) {
      const missingCount = requiredTrapCount - currentDistractorCount;
      // Distractores derivados del propio tablero (nombres de conceptos
      // con sufijo de variación) — nunca texto enlatado ajeno al documento.
      const conceptPool = processedCards
        .filter((c) => !c.isDistractor)
        .map((c) => c.name);
      const trapSuffixes = t('arena.trap_sfx', { returnObjects: true });
      for (let k = 0; k < missingCount; k++) {
        const dIdx = currentDistractorCount + k;
        const baseName = conceptPool[dIdx % Math.max(1, conceptPool.length)] || t('arena.concept_n', { n: dIdx + 1 });
        processedCards.push({
          id: `card_trap_dyn_${dIdx + 1}`,
          name: `${baseName} ${trapSuffixes[dIdx % trapSuffixes.length]}`.slice(0, 38),
          cost: "1x",
          type: "dark", // Estilo oscuro / amenaza
          sourceType: "document",
          domain: "trampa",
          content:
            t('arena.trap_content2'),
          matchesNodeId: null,
          isDistractor: true,
          isTrap: true,
        });
      }
    }

    // Barajar aleatoriamente la mano del jugador para que no sigan el mismo orden que los nodos
    const shuffledHand = [...processedCards].sort(() => Math.random() - 0.5);
    shuffledHand.forEach((c, i) => {
      c.rotation = (i - Math.floor(processedCards.length / 2)) * 2;
      c.zIndex = i + 1;
    });

    // Resetear todo el estado de la partida para el nivel
    victoryConsumedRef.current = false; // tablero nuevo → victoria habilitada otra vez
    failedNodesRef.current = new Set(); // precisión del nivel se mide desde cero
    firstMoveTrackedRef.current = false; // funnel: first_move se cuenta por tablero
    failStreakRef.current = 0;
    setNodes(newNodes);
    setHand(shuffledHand);
    setHandPage(0);
    setStreak(0);
    setPlayerScore(0);
    setIsCapySad(false);
    setSelectedNodeForQuestion(null);
    setSelectedCardForDetail(null);
    setSelectedCardInHand(null);
    setFlyingCard(null);

    // Primera partida: arranca el overlay guiado paso a paso
    try {
      if (!localStorage.getItem(GUIDED_KEY)) {
        setGuideStep(1);
        // Onboarding dirigido (3.4): Hubzi señala carta y casilla del
        // primer movimiento con los flags "¡USA ÉSTA!"/"¡COLOCA AQUÍ!".
        const firstNode = Object.values(newNodes)[0];
        const firstCard = shuffledHand.find((c) => cardMatchesNode(c, firstNode));
        if (firstNode && firstCard)
          setGuideTarget({ cardId: firstCard.id, nodeId: firstNode.id });
      }
    } catch {}

    // Racha de días estudiando (retención suave): Hubzi la celebra una
    // sola vez por sesión, unos segundos tras la bienvenida del nivel.
    const studyStreak =
      island?.campaign_progress?.study_streak ??
      activeFolder?.campaign_progress?.study_streak ??
      0;
    if (studyStreak >= 3 && !streakGreetedRef.current) {
      streakGreetedRef.current = true;
      setTimeout(() => {
        setCapyMood("love");
        setCapySpeech({
          text: t('arena.streak_greet', { days: studyStreak }),
          isVisible: true,
          mood: "love",
        });
      }, 5500);
    }

    setTimeout(() => {
      // Isla recién desbloqueada (sin progreso aún): Hubzi se emociona —
      // la primera visita a un tema nuevo es un momento de descubrimiento.
      const isNewIsland = Boolean(island && !island.campaign_progress);
      triggerCapyVoice("welcome", {
        level,
        ...(isNewIsland
          ? {
              customText: t('arena.new_island', { name: island.name }),
            }
          : {}),
      });
    }, 1000);
    return true;
  };

  // CARGAR NIVEL ESPECÍFICO (1 A 5) DESDE EL BACKEND
  // Cancela la espera de generación. El job del backend termina igual y su
  // resultado queda en caché, así que cancelar no desperdicia el trabajo.
  const handleCancelGeneration = () => {
    genAbortRef.current?.abort();
    genAbortRef.current = null;
    setIsGeneratingArena(false);
    setGenStage(null);
    setGenProgress(null);
    setGenError(null);
  };

  // Reintenta la última generación con los mismos parámetros (la caché del
  // backend puede resolverlo al instante si el job previo ya terminó).
  const handleRetryGeneration = () => {
    const last = lastGenRef.current;
    setGenError(null);
    setIsGeneratingArena(false);
    if (!last) return;
    setTimeout(
      () => loadGameForLevel(last.level, last.folder, last.force, last.island),
      0,
    );
  };

  // Sondeo del job async del backend → tablero final o error con status_code.
  const pollGenerationJob = async (jobId, signal) => {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const jr = await fetchWithAuth(`/api/v1/jobs/${jobId}`, { signal });
      if (!jr.ok)
        throw new Error(t('arena.job_progress_fail', { status: jr.status }));
      const job = await jr.json();
      setGenStage(job.stage);
      if (typeof job.progress === "number") setGenProgress(job.progress);
      if (job.status === "done") return job.result;
      if (job.status === "error") {
        const e = new Error(
          job.error || t('arena.gen_fail'),
        );
        e.status = job.status_code || 500;
        throw e;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  };

  const loadGameForLevel = async (
    targetLevel,
    targetFolder = activeFolder,
    force = false,
    targetIsland = activeIsland,
  ) => {
    if (isGeneratingArena) return false; // guard anti doble-submit
    if (!targetFolder) {
      setSuccessNotif(t('arena.select_folder'));
      setIsFolderModalOpen(true);
      return false;
    }

    const lvlInfo =
      GAME_LEVELS.find((l) => l.level === targetLevel) || GAME_LEVELS[0];
    const topicLabel = targetIsland ? ` · ${targetIsland.name}` : "";
    lastGenRef.current = {
      level: targetLevel,
      folder: targetFolder,
      island: targetIsland,
      force,
    };
    setIsGeneratingArena(true);
    setGenStage("queued");
    setGenProgress(0);
    setGenError(null);
    track("gen_started", {
      level: targetLevel,
      folder: targetFolder.id,
      island: targetIsland?.id || null,
    });
    const controller = new AbortController();
    genAbortRef.current = controller;
    setSuccessNotif(
      t('arena.loading_level', { level: targetLevel, name: levelName(lvlInfo, t), count: lvlInfo.questions, folder: targetFolder.name, topic: topicLabel }),
    );

    // 0. VERIFICACIÓN INSTANTÁNEA EN MEMORIA / CACHÉ LOCAL (0 ms, 0 tokens)
    if (!force) {
      const cachedBoards = targetFolder.cached_boards || {};
      const lvlKey = lvlCacheKey(targetLevel, targetIsland);
      // Solo reutilizar caché si pertenece exactamente a este nivel o si tiene la cantidad de preguntas esperada
      const localCachedBoard =
        cachedBoards[lvlKey] ||
        (targetFolder.cached_board &&
        targetFolder.cached_board.cards?.length === lvlInfo.questions
          ? targetFolder.cached_board
          : null);

      if (
        localCachedBoard &&
        localCachedBoard.cards &&
        localCachedBoard.cards.length >= lvlInfo.questions
      ) {
        const success = applyBoardData(
          localCachedBoard,
          targetFolder.name,
          targetLevel,
          targetIsland,
        );
        if (success) {
          setCurrentLevel(targetLevel);
          setIsGeneratingArena(false);
          setGenStage(null);
          setGenProgress(null);
          setSuccessNotif(
            t('arena.level_cached', { level: targetLevel }),
          );
          return true;
        }
      }
    }

    try {
      const res = await fetchWithAuth(
        `/api/v1/folders/${targetFolder.id}/generate-game?level=${targetLevel}&question_count=${lvlInfo.questions}&difficulty=${lvlInfo.difficulty}&async=true${islandQuery(targetIsland)}${force ? "&force=true" : ""}`,
        { method: "POST", signal: controller.signal },
      );

      let boardData = null;
      if (res.status === 202) {
        // Pipeline async: sondear el job para progreso real por etapas.
        const { job_id } = await res.json();
        boardData = await pollGenerationJob(job_id, controller.signal);
      } else if (res.ok) {
        boardData = await res.json();
      } else {
        const err = await res.json().catch(() => ({}));
        const msg =
          err.detail || t('arena.gen_fail');
        if (res.status === 402) {
          setErrorNotif(msg);
        } else {
          setGenError({ message: msg });
        }
        return false;
      }

      if (boardData && boardData.cards) {
        // Guardar en la carpeta en memoria y localStorage para futuras cargas a 0 ms
        if (!targetFolder.cached_boards) targetFolder.cached_boards = {};
        targetFolder.cached_boards[lvlCacheKey(targetLevel, targetIsland)] =
          boardData;
        targetFolder.cached_board = boardData;

        try {
          const userStorageKey = currentUser?.id
            ? `hubzy_user_study_folders_${currentUser.id}`
            : "hubzy_user_study_folders";
          const savedFolders = JSON.parse(
            localStorage.getItem(userStorageKey) || "[]",
          );
          const idx = savedFolders.findIndex((f) => f.id === targetFolder.id);
          if (idx !== -1) {
            savedFolders[idx].cached_boards = targetFolder.cached_boards;
            savedFolders[idx].cached_board = boardData;
            localStorage.setItem(userStorageKey, JSON.stringify(savedFolders));
          }
        } catch {}

        const success = applyBoardData(
          boardData,
          targetFolder.name,
          targetLevel,
          targetIsland,
        );
        if (success) {
          setCurrentLevel(targetLevel);
          setSuccessNotif(
            t('arena.level_ready', { level: targetLevel, name: levelName(lvlInfo, t), count: lvlInfo.questions }),
          );
          return true;
        }
      }
      setGenError({ message: t('arena.gen_invalid') });
    } catch (e) {
      if (e.name === "AbortError") return false; // cancelado por el usuario
      console.warn("Error cargando nivel desde el backend:", e);
      if (e.status === 402) {
        setErrorNotif(e.message);
      } else if (!e.status) {
        // 4.7 Degradación offline: sin respuesta del servidor (red caída o
        // backend abajo) — estado claro + oferta de demo local inmediata.
        track("offline_gen_fail", { level: targetLevel });
        setGenError({
          offline: true,
          message:
            t('arena.gen_offline'),
        });
      } else {
        setGenError({
          message:
            e.message || t('arena.gen_error'),
        });
      }
    } finally {
      // Solo la generación dueña del ref apaga el estado: si el usuario
      // canceló y reintentó, el finally de la anterior no debe ocultar el
      // overlay ni re-habilitar el botón de la nueva en curso.
      if (genAbortRef.current === controller) {
        genAbortRef.current = null;
        setIsGeneratingArena(false);
        setGenStage(null);
        setGenProgress(null);
      }
    }
    return false;
  };

  // 2A. REINTENTAR PARTIDA (OPCIÓN A: RESET TABLERO INSTANTÁNEO 0 MS)
  // Devuelve todas las cartas a la mano, reinicia energía y vacía los nodos sin llamar a la IA
  const handleResetCurrentBoard = () => {
    setIsRestartOptionsModalOpen(false);
    setIsVictoryModalOpen(false);

    // Recolectar todas las cartas colocadas en los nodos más las que queden en mano
    const allCardsInPlay = [...hand];
    Object.values(nodes).forEach((n) => {
      if (n.placedCard) {
        allCardsInPlay.push(n.placedCard);
      }
    });

    // Desocupar todos los nodos — el examen se juega de nuevo, así que
    // la victoria vuelve a estar habilitada para este mismo tablero.
    victoryConsumedRef.current = false;
    failedNodesRef.current = new Set(); // reintento honesto: la precisión se vuelve a medir
    failStreakRef.current = 0;
    setNodes((prev) => {
      const reset = {};
      Object.entries(prev).forEach(([id, node]) => {
        reset[id] = {
          ...node,
          placedCard: null,
          lockedByOpponent: false,
        };
      });
      return reset;
    });

    // Barajar aleatoriamente las cartas en la mano
    const shuffledHand = [...allCardsInPlay].sort(() => Math.random() - 0.5);
    shuffledHand.forEach((c, i) => {
      c.rotation = (i - Math.floor(allCardsInPlay.length / 2)) * 2;
      c.zIndex = i + 1;
    });

    setHand(shuffledHand);
    setHandPage(0);
    setStreak(0);
    setPlayerScore(0);
    setIsCapySad(false);
    setSelectedNodeForQuestion(null);
    setSelectedCardForDetail(null);
    setSelectedCardInHand(null);
    setFlyingCard(null);
    setSuccessNotif(
      t('arena.board_reset'),
    );
  };

  // 2B. REGENERAR NUEVAS PREGUNTAS (OPCIÓN B: CONSULTA A GEMINI IA)
  const handleRegenerateWithNewQuestions = async () => {
    setIsRestartOptionsModalOpen(false);
    setIsVictoryModalOpen(false);
    if (!activeFolder) {
      setSuccessNotif(
        t('arena.select_trunk'),
      );
      setIsFolderModalOpen(true);
      return;
    }
    await loadGameForLevel(currentLevel, activeFolder, true);
  };

  // Alias compatible
  const handleRestartWithNewQuestions = () => {
    setIsRestartOptionsModalOpen(true);
  };

  // ¿La carta corresponde a este nodo? Regla única compartida por
  // attemptPlayCard, la affordance de drop y el preview de arrastre.
  const cardMatchesNode = (card, node) => {
    if (!card || !node) return false;
    const isDistractor =
      card.isDistractor || card.isTrap || String(card.id).includes("distractor");
    if (isDistractor) return false;
    return Boolean(
      (node.correctCardId && String(node.correctCardId) === String(card.id)) ||
        (card.matchesNodeId && String(card.matchesNodeId) === String(node.id)) ||
        (node.label &&
          card.name &&
          node.label.trim().toLowerCase() === card.name.trim().toLowerCase()),
    );
  };

  // INTENTO UNIFICADO DE JUGAR/COLOCAR CARTA (Arrastrar o Tocar)
  const attemptPlayCard = (cardId, targetNodeId) => {
    if (!targetNodeId || !nodes[targetNodeId]) return false;
    const targetNode = nodes[targetNodeId];

    if (targetNode.placedCard) {
      return false;
    }

    const card = hand.find((c) => String(c.id) === String(cardId));
    if (!card) return false;

    const isDistractor =
      card.isDistractor || String(card.id).includes("distractor");
    const isCorrectCard = cardMatchesNode(card, targetNode);

    if (!isCorrectCard) {
      // CARTA INCORRECTA O TRAMPA: apoyo sin castigo — el error enseña
      sfx.error();
      fireNodeFx(targetNodeId, "wrong");
      // Guía: ya llegó a una casilla → avanza al paso de colocación
      if (guideStep === 1) setGuideStep(2);
      triggerCapyVoice("wrong");
      recordAdaptiveAttempt(targetNode, false);
      failedNodesRef.current.add(targetNodeId);
      setStreak(0); // la racha se reinicia (feedback visual, no daño)

      // Anti-estrés escalonado: 2 fallos seguidos → Hubzi ofrece una pista
      // directa en su burbuja; 3 → pausa Zen de respiración.
      failStreakRef.current += 1;
      lastFailedNodeRef.current = targetNodeId;
      const wantsHintOffer = failStreakRef.current === 2;
      if (failStreakRef.current >= 3) {
        failStreakRef.current = 0;
        offerSupport(
          { category: "repetición de intentos", emotion: "frustración" },
          1,
        );
      }

      const isTrap = Boolean(card.isTrap || isDistractor);
      if (isTrap) {
        // La trampa se desvanece del mazo (nunca puede ser correcta en ningún nodo)
        sfx.trap();
        // Revelación: micro-animación de "descubrimiento" con explicación
        // de qué era falso en esa afirmación.
        setTrapReveal({ card, nodeLabel: targetNode.label });
        setHand((prev) =>
          prev.filter((c) => String(c.id) !== String(card.id)),
        );
        setSelectedCardInHand((prev) => (prev?.id === card.id ? null : prev));
        setSelectedCardForDetail((prev) => (prev?.id === card.id ? null : prev));
      }

      const pedagogicalHint =
        targetNode.hint ||
        t('arena.node_hint', { label: targetNode.label });
      setCapyMood(isTrap ? "surprised" : "encouraging");
      setCapySpeech({
        text: wantsHintOffer
          ? kidMode
            ? t('arena.almost_kid', { card: card.name })
            : t('arena.almost_adult', { card: card.name, label: targetNode.label })
          : kidMode
            ? t('arena.almost_kid_hint', { card: card.name, hint: pedagogicalHint })
            : isTrap
              ? t('arena.trap_speech', { hint: pedagogicalHint })
              : t('arena.almost_hint', { card: card.name, hint: pedagogicalHint }),
        isVisible: true,
        mood: isTrap ? "surprised" : "encouraging",
        // Botón "Dame una pista" directo en la burbuja (espera al jugador)
        showHintButton: wantsHintOffer && !isTrap,
      });
      setSuccessNotif(
        kidMode
          ? t('arena.notif_wrong_kid', { card: card.name, hint: pedagogicalHint })
          : isTrap
            ? t('arena.notif_trap', { hint: pedagogicalHint })
            : t('arena.notif_wrong', { card: card.name, label: targetNode.label, hint: pedagogicalHint }),
      );

      setTimeout(() => {
        setSuccessNotif(null);
      }, 4500);
      return false;
    }

    // CARTA CORRECTA: Colocar en el nodo, racha sube y voz de celebración entusiasta
    sfx.success();
    const multiplier = card.cost ? parseInt(card.cost) || 1 : 1;
    const pointsEarned = 10 * multiplier;
    fireNodeFx(targetNodeId, "correct", pointsEarned);
    // Funnel UX: primer movimiento acertado de la partida.
    if (!firstMoveTrackedRef.current) {
      firstMoveTrackedRef.current = true;
      track("first_move", { level: currentLevel });
    }
    // Guía: primera colocación exitosa → felicitación y cierre
    if (guideStep === 1 || guideStep === 2) setGuideStep(3);
    triggerCapyVoice("correct");
    recordAdaptiveAttempt(targetNode, true);
    setStreak((prev) => prev + 1);
    failStreakRef.current = 0;
    setSelectedCardForDetail(null);
    setSelectedCardInHand(null);
    setNodes((prev) => ({
      ...prev,
      [targetNodeId]: { ...prev[targetNodeId], placedCard: card },
    }));
    setHand((prev) => prev.filter((c) => String(c.id) !== String(card.id)));
    setPlayerScore((prev) => prev + pointsEarned);
    setSuccessNotif(
      t('arena.card_ok', { card: card.name, pts: pointsEarned }),
    );
    return true;
  };

  // Guía paso a paso: al seleccionar la primera carta avanza al paso 2;
  // el paso 3 (felicitación) se cierra solo a los 4.5s.
  useEffect(() => {
    if (guideStep === 1 && selectedCardInHand) setGuideStep(2);
  }, [selectedCardInHand, guideStep]);
  useEffect(() => {
    if (guideStep !== 3) return;
    const t = setTimeout(finishGuided, 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideStep]);

  // useCallback: referencia estable para que React.memo en ArcadeNode y
  // BoardConsole sí evite re-renders por tick de timers/voz.
  const handleNodeClick = useCallback(
    (nodeId) => {
      const node = nodes[nodeId];
      if (!node) return;

      // Si el jugador tiene una carta seleccionada en la mano (modo táctil / Tap-to-Place)
      if (selectedCardInHand && !node.placedCard) {
        const cardToPlay = selectedCardInHand;
        const success = attemptPlayCard(cardToPlay.id, nodeId);
        if (success) {
          setSelectedCardInHand(null);
          return;
        }
      }

      // De lo contrario, abrir modal de lectura detallada del reactivo
      setSelectedNodeForQuestion(node);
    },
    // attemptPlayCard lee nodes/hand del render actual: depende de ambos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, hand, selectedCardInHand],
  );

  const handleCardClick = (card) => {
    // Modo Táctil / Accesibilidad: si tocas una carta ya seleccionada, deseleccionar
    if (selectedCardInHand?.id === card.id) {
      setSelectedCardInHand(null);
      setSelectedCardForDetail(null);
    } else {
      sfx.flip();
      setSelectedCardInHand(card);
      // Mostrar la respuesta completa en el panel lateral para leerla
      setSelectedCardForDetail(card);
      setSuccessNotif(
        t('arena.card_selected', { card: card.name }),
      );
    }
  };

  // Selección por TECLADO: tras elegir la carta con Enter, el foco salta a
  // la primera casilla vacía para colocarla con otro Enter — flujo sin
  // mouse completo (Tab entre casillas, Enter para colocar).
  const handleCardKeySelect = (card) => {
    const wasSelected = selectedCardInHand?.id === card.id;
    handleCardClick(card);
    if (!wasSelected) {
      setTimeout(() => {
        const empty = Object.values(nodes).find((n) => !n.placedCard);
        if (empty)
          document.querySelector(`[data-node-id="${empty.id}"]`)?.focus();
      }, 60);
    }
  };

  // Hit-test compartido: ¿sobre qué casilla está el punto (x, y)?
  // Radio generoso para perdón de puntería en drag y preview en vivo.
  const findNodeAtPoint = (x, y, radius = 80) => {
    const elements = document.querySelectorAll("[data-node-id]");
    let matchedNodeId = null;
    let shortestDist = Infinity;

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dist = Math.hypot(x - centerX, y - centerY);

      const inExpandedArea =
        x >= rect.left - radius &&
        x <= rect.right + radius &&
        y >= rect.top - radius &&
        y <= rect.bottom + radius;

      if (inExpandedArea && dist < shortestDist) {
        shortestDist = dist;
        matchedNodeId = el.getAttribute("data-node-id");
      }
    });
    return matchedNodeId;
  };

  // PREVIEW EN VIVO DEL DROP: al arrastrar sobre una casilla se muestra
  // el resultado antes de soltar (naranja si encaja, rojo tenue si no).
  const handleDragMove = (cardId, info) => {
    const nodeId = findNodeAtPoint(info.point.x, info.point.y, 60);
    if (!nodeId) return setDragPreviewIfChanged(null);
    const card = hand.find((c) => String(c.id) === String(cardId));
    const node = nodes[nodeId];
    setDragPreviewIfChanged({
      cardId,
      nodeId,
      correct: Boolean(
        node && !node.placedCard && cardMatchesNode(card, node),
      ),
    });
  };

  const handleDragEnd = (cardId, info) => {
    setDragPreviewIfChanged(null);
    const matchedNodeId = findNodeAtPoint(info.point.x, info.point.y, 80);
    if (matchedNodeId) {
      attemptPlayCard(cardId, matchedNodeId);
    }
  };

  // Carta "activa" para la affordance de drop: la seleccionada por toque
  // o la que se está arrastrando. Todas las casillas vacías muestran el
  // anillo de "suelta aquí" por igual — sin marcar la compatible.
  const activeCardForDrop =
    selectedCardInHand ||
    (dragPreview
      ? hand.find((c) => String(c.id) === String(dragPreview.cardId))
      : null);
  const matchNodeId = null;

  // Pistas efectivas: durante el onboarding apuntan al objetivo del
  // primer movimiento; terminada la guía vuelven a la pista de inactividad.
  const effHintCardId =
    guideStep > 0 && guideStep < 3
      ? guideTarget?.cardId || hintCardId
      : hintCardId;
  const effHintNodeId =
    guideStep > 0 && guideStep < 3
      ? guideTarget?.nodeId || hintNodeId
      : hintNodeId;

  // Estado macro consolidado de Hubzi (3.2) — burbuja, mood y badge
  // leen siempre del mismo valor.
  const hubziStatus = deriveHubziStatus({
    capyMood,
    capySpeech,
    isCapySad,
    isSpeaking: isCapySpeaking,
    isListening,
    isThinking: isThinkingHint,
  });

  // OVERLAY + TOASTS compartidos: la generación puede lanzarse desde el mapa
  // (onSelectLevel) o desde la demo de bienvenida — sin esto corría invisible.
  const generationOverlay = (isGeneratingArena || genError) && (
    <GenerationOverlay
      stage={genError ? "error" : genStage}
      progress={genProgress}
      errorMessage={genError?.message}
      onCancel={handleCancelGeneration}
      onRetry={genError ? handleRetryGeneration : null}
    />
  );

  const notificationToasts = (
    <AnimatePresence>
      {errorNotif && (
        <motion.div
          key="error-notif"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 px-5 py-3 rounded-arcade bg-rose-600/95 border-2 border-rose-300/60 text-white text-sm font-bold shadow-[0_8px_30px_rgba(244,63,94,0.35)] max-w-lg"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorNotif}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Confirmación de cierre de sesión — se abre desde el botón de cuenta
  // de la bienvenida y desde el modal de perfil.
  const logoutConfirmModal = (
    <AnimatePresence>
      {isLogoutConfirmOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[var(--color-arcade-navy-dark)]/70 backdrop-blur-sm"
          onClick={() => setIsLogoutConfirmOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 25, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-arcade-lg border-4 border-[var(--color-arcade-navy)] shadow-modal p-6 text-center"
          >
            <div className="w-14 h-14 mx-auto rounded-arcade bg-rose-100 border-2 border-rose-300 flex items-center justify-center mb-3">
              <LogOut className="w-7 h-7 text-rose-500" />
            </div>
            <h3 className="text-lg font-black text-[var(--color-arcade-navy)] uppercase tracking-wide mb-1">
              {t('arena.logout_q')}
            </h3>
            <p className="text-xs text-slate-500 font-medium mb-5 leading-relaxed">
{t('arena.logout_body', { name: currentUser?.username || currentUser?.email || t('arena.your_account') })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-arcade bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-700 font-black text-xs uppercase tracking-wide cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setIsLogoutConfirmOpen(false);
                  handleLogout();
                }}
                className="flex-1 py-2.5 rounded-arcade bg-rose-500 hover:bg-rose-600 border-b-arcade border-rose-700 text-white font-black text-xs uppercase tracking-wide cursor-pointer transition-all active:translate-y-0.5 active:border-b-arcade-xs"
              >
                {t('arena.logout_yes')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // SI LA PANTALLA DE BIENVENIDA ESTÁ ACTIVA, SE MUESTRA EXCLUSIVAMENTE ELLA (SIN EL TABLERO NI EL JUEGO ABAJO)
  // Sin sesión la bienvenida es obligatoria: es la única puerta de entrada (login/registro).
  const showWelcome = !currentUser || isWelcomeScreenVisible;
  if (showWelcome) {
    return (
      <div className="relative w-screen h-[100dvh] overflow-hidden select-none">
        <WelcomeScreen
          isLoggedIn={Boolean(currentUser)}
          username={currentUser?.username || currentUser?.email?.split("@")[0]}
          user={currentUser}
          onOpenLogin={() => {
            if (currentUser) setIsLogoutConfirmOpen(true);
            else setIsAuthModalOpen(true);
          }}
          onOpenTutorial={() => setIsTutorialOpen(true)}
          onContinue={() => {
            if (!currentUser) {
              // Si no inició sesión, abre el modal de login
              setIsAuthModalOpen(true);
              return;
            }
            setIsWelcomeScreenVisible(false);
            setIsFolderModalOpen(true);
          }}
          onOpenLegal={handleOpenLegal}
        />

        {/* Modal de Tutorial cuando se abre desde la bienvenida */}
        <TutorialModal
          isOpen={isTutorialOpen}
          onClose={() => setIsTutorialOpen(false)}
        />

        {/* Modal de Login cuando se toca Iniciar Sesión desde la bienvenida */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => {
            // Al presionar la X, permanece en la pantalla de bienvenida y NO entra al juego
            setIsAuthModalOpen(false);
            setIsWelcomeScreenVisible(true);
          }}
          onAuthSuccess={(user) => {
            setCurrentUser(user);
            setIsAuthModalOpen(false);
            capyVoice.currentUser = user;
            setIsWelcomeScreenVisible(false);
            setIsFolderModalOpen(true);
          }}
        />

        {/* Modal Legal y de Transparencia */}
        <LegalModal
          isOpen={isLegalModalOpen}
          onClose={() => setIsLegalModalOpen(false)}
          initialTab={legalModalTab}
        />

        {logoutConfirmModal}

        {/* Banner de Consentimiento de Cookies */}
        <CookieConsentBanner onOpenLegal={handleOpenLegal} />
      </div>
    );
  }

  // RENDERIZADO DEL MAPA DE AVENTURA (MUNDOS E ISLAS ESTILO MONSTER LEGENDS)
  if (isMapVisible) {
    return (
      <div className="arena-stage relative w-screen h-[100dvh] overflow-hidden select-none">
        <AdventureMap
          folderName={
            activeIsland
              ? `${activeFolder?.name || "Carpeta"} · ${activeIsland.name}`
              : activeFolder?.name || "Mundo de Aprendizaje"
          }
          documentTitle={
            activeIsland?.name ||
            boardInfo?.theme ||
            activeFolder?.documents?.[0]?.name ||
            "Tema de Estudio"
          }
          levels={activeLevels}
          currentLevel={currentLevel}
          unlockedLevel={unlockedLevel}
          levelStars={levelStars}
          studyStreak={
            (activeIsland
              ? activeIsland.campaign_progress?.study_streak
              : activeFolder?.campaign_progress?.study_streak) || 0
          }
          onSelectLevel={async (lvlNum) => {
            setCurrentLevel(lvlNum);
            persistCampaignProgress({
              level_stars: levelStars,
              unlocked_level: unlockedLevel,
              current_level: lvlNum,
            });
            if (activeFolder) {
              await loadGameForLevel(lvlNum, activeFolder, false);
            }
            // Entrar directamente al tablero de ese nivel
            setIsMapVisible(false);
          }}
          onBackToFolders={() => {
            setIsFolderModalOpen(true);
          }}
          onOpenTutorial={() => setIsTutorialOpen(true)}
          onResetCampaign={handleResetCampaign}
        />

        {/* Modal del Baúl de Carpetas accesible directamente desde el Mapa */}
        <StudyFolderManagerModal
          isOpen={isFolderModalOpen}
          currentUser={currentUser}
          onClose={closeFolderModal}
          onUpgradeToPro={() => {
            setIsSubscriptionModalOpen(true);
          }}
          onBackToMenu={() => {
            setIsFolderModalOpen(false);
            setIsMapVisible(false);
            setIsWelcomeScreenVisible(true);
          }}
          onSelectFolder={async (folder) => {
            lockLandscape();
            const island = folder.selectedIsland || null;
            hydrateCachedBoards(folder);
            setActiveFolder(folder);
            setActiveIsland(island);
            setIsFolderModalOpen(false);

            if (
              folder.playDirectly &&
              folder.documents &&
              folder.documents.filter((d) => !d.isUploading).length > 0
            ) {
              // Reanudar donde quedó el jugador (progreso persistente)
              const resumeLevel = getResumeLevel(folder, island);
              setCurrentLevel(resumeLevel);
              setIsMapVisible(true);
              await loadGameForLevel(resumeLevel, folder, false, island);
            }
          }}
        />

        {/* Modal de Tutorial accesible desde el Mapa */}
        <TutorialModal
          isOpen={isTutorialOpen}
          onClose={() => setIsTutorialOpen(false)}
        />

        {/* Overlay/toasts: la generación desde el mapa también es visible */}
        {generationOverlay}
        {notificationToasts}
      </div>
    );
  }

  return (
    <div
      className={`arena-stage relative w-screen h-[100dvh] overflow-hidden flex flex-col justify-between select-none${
        ""
      }`}
    >
      {/* 0. MODAL PRINCIPAL DE AUTENTICACIÓN (LOGIN Y REGISTRO CON CORREO Y CONTRASEÑA) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthModalOpen(false);
          capyVoice.currentUser = user;
          setIsFolderModalOpen(true);
        }}
      />

      {/* 0.1 MODAL DE EDICIÓN DE PERFIL / VOZ ADAPTATIVA DE Hubzi */}
      <UserAuthModal
        isOpen={isUserModalOpen}
        currentUser={currentUser}
        onUserSaved={(user) => {
          setCurrentUser(user);
          setIsUserModalOpen(false);
          capyVoice.currentUser = user;
        }}
        onLogout={() => {
          setIsUserModalOpen(false);
          setIsLogoutConfirmOpen(true);
        }}
      />

      {/* -1. PANEL PREVIO DE CARPETAS Y ASIGNATURAS DE ESTUDIO (AISLADO POR USUARIO) */}
      <StudyFolderManagerModal
        isOpen={isFolderModalOpen}
        currentUser={currentUser}
        onClose={closeFolderModal}
        onUpgradeToPro={() => {
          setIsSubscriptionModalOpen(true);
        }}
        onBackToMenu={() => {
          setIsFolderModalOpen(false);
          setIsWelcomeScreenVisible(true);
        }}
        onSelectFolder={async (folder) => {
          lockLandscape();
          const island = folder.selectedIsland || null;
          hydrateCachedBoards(folder);
          setActiveFolder(folder);
          setActiveIsland(island);
          setIsFolderModalOpen(false);

          if (
            folder.playDirectly &&
            folder.documents &&
            folder.documents.filter((d) => !d.isUploading).length > 0
          ) {
            // Reanudar donde quedó el jugador (progreso persistente)
            const resumeLevel = getResumeLevel(folder, island);
            const islandCap = island?.total_levels || 20;
            setCurrentLevel(resumeLevel);
            const success = await loadGameForLevel(
              resumeLevel,
              folder,
              false,
              island,
            );
            if (success) {
              // Tras cargar el nivel actual, pre-generar en segundo plano los
              // 4 siguientes para transición instantánea entre niveles
              (async () => {
                for (
                  let lvl = resumeLevel + 1;
                  lvl <= Math.min(resumeLevel + 4, islandCap);
                  lvl++
                ) {
                  try {
                    const lvlInfo = GAME_LEVELS.find((l) => l.level === lvl);
                    const key = lvlCacheKey(lvl, island);
                    if (folder.cached_boards && folder.cached_boards[key])
                      continue;
                    const res = await fetchWithAuth(
                      `/api/v1/folders/${folder.id}/generate-game?level=${lvl}&question_count=${lvlInfo.questions}&difficulty=${lvlInfo.difficulty}${islandQuery(island)}`,
                      { method: "POST" },
                    );
                    if (res.ok) {
                      const data = await res.json();
                      if (!folder.cached_boards) folder.cached_boards = {};
                      folder.cached_boards[key] = data;
                      // Guardar en localStorage
                      try {
                        const userStorageKey = currentUser?.id
                          ? `hubzy_user_study_folders_${currentUser.id}`
                          : "hubzy_user_study_folders";
                        const savedFolders = JSON.parse(
                          localStorage.getItem(userStorageKey) || "[]",
                        );
                        const idx = savedFolders.findIndex(
                          (f) => f.id === folder.id,
                        );
                        if (idx !== -1) {
                          savedFolders[idx].cached_boards =
                            folder.cached_boards;
                          localStorage.setItem(
                            userStorageKey,
                            JSON.stringify(savedFolders),
                          );
                        }
                      } catch {}
                    }
                  } catch (preloadErr) {
                    console.debug(
                      `Pre-carga nivel ${lvl} omitida o en segundo plano:`,
                      preloadErr,
                    );
                  }
                }
              })();

              // Enviar directamente al Mapa de Aventura de 20 niveles
              setIsMapVisible(true);
            } else {
              setIsFolderModalOpen(true);
            }
          } else {
            setIsFolderModalOpen(true);
          }
        }}
      />

      {/* 1.9 PANEL INSTITUCIONAL (COLEGIOS: GRADOS, MATERIAS, PANEL DOCENTE) */}
      <InstitutionModal
        isOpen={isInstitutionModalOpen}
        onClose={() => setIsInstitutionModalOpen(false)}
      />

      {/* 2. ACTIVIDAD DE RESPIRACIÓN Y RELAJACIÓN ZEN (HUBZI ZEN CON VOZ ELEVENLABS) */}
      <ZenRelaxModal
        isOpen={isRelaxModalOpen}
        onComplete={() => {
          setIsRelaxModalOpen(false);
          setWellbeing({ stage: 0 });
          // Abre el mapa de niveles para que el estudiante elija su nivel
          setIsMapVisible(true);
        }}
        onSkip={() => {
          setIsRelaxModalOpen(false);
          setWellbeing({ stage: 0 });
          // Abre el mapa de niveles
          setIsMapVisible(true);
        }}
      />

      {/* OVERLAY DE PROCESAMIENTO PROFUNDO DE DOCUMENTOS CON IA */}
      {generationOverlay}

      {/* TOASTS DE NOTIFICACIÓN — feedback visible de éxito y error */}
      {notificationToasts}

      {/* REVELACIÓN DE CARTA TRAMPA — micro-animación de "descubrimiento"
          al colocar una distractora: explica qué era falso y se desvanece */}
      <AnimatePresence>
        {trapReveal && (
          <motion.div
            key="trap-reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ rotateY: 90, scale: 0.7, opacity: 0 }}
              animate={{ rotateY: 0, scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0, y: -30 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="w-64 sm:w-72 p-4 rounded-arcade-lg bg-gradient-to-b from-slate-800 via-slate-900 to-black border-2 border-slate-500/80 shadow-[0_0_50px_rgba(15,23,42,0.9)] text-center"
            >
              <div className="w-12 h-12 mx-auto rounded-arcade bg-slate-950 border border-slate-600 flex items-center justify-center mb-2">
                <EyeOff className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-rose-300 mb-1">
                {t('arena.trap_reveal_t')}
              </p>
              <p className="text-sm font-black text-white uppercase leading-tight mb-1.5">
                "{trapReveal.card.name}"
              </p>
              <p className="text-[10.5px] text-slate-300 leading-snug font-medium">
{t('arena.trap_reveal_b', { node: trapReveal.nodeLabel })}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. MODAL DE PREGUNTA */}
      <QuestionModal
        isOpen={!!selectedNodeForQuestion}
        node={selectedNodeForQuestion}
        ageBand={userAgeBand}
        onClose={() => {
          const targetNode = selectedNodeForQuestion;
          setSelectedNodeForQuestion(null);
          if (targetNode?.hint) {
            triggerCapyVoice("hint", {
              customText: `Te doy una pista: ${targetNode.hint}`,
            });
          }
        }}
      />

      {/* 3.1 MODAL DE DETALLE DE CARTA (VISUALIZACIÓN DE RESPUESTA) */}
      <CardDetailModal
        isOpen={!!selectedCardForDetail}
        card={selectedCardForDetail}
        onClose={closeCardDetail}
      />

      {/* ENTORNO 3D & ILUMINACIÓN ATMOSFÉRICA CARD CLASH */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[700px] h-48 bg-radial from-white/40 via-sky-300/15 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute right-0 top-1/3 w-64 h-64 bg-radial from-amber-300/20 via-orange-400/10 to-transparent blur-3xl pointer-events-none" />

      {/* GUARDIÁN TÁCTICO 3D ZEN INTERACTIVO / SÓLO VISIBLE CUANDO EL TABLERO YA FUE GENERADO */}
      {Object.keys(nodes).length > 0 && (
        <CapyCompanion
          capySpeech={capySpeech}
          capyMood={capyMood}
          isCapySad={isCapySad}
          isCapySpeaking={isCapySpeaking}
          isListening={isListening}
          isThinkingHint={isThinkingHint}
          isCapyMuted={isCapyMuted}
          isAmbientPlaying={isAmbientPlaying}
          zenOffer={{ ...wellbeing, show: wellbeing.stage === 1 }}
          idleBlinkSeq={idleBlinkSeq}
          hubziStatus={hubziStatus}
          chatOpen={isChatOpen}
          nodes={nodes}
          currentLevel={currentLevel}
          boardInfo={boardInfo}
          activeFolder={activeFolder}
          currentUser={currentUser}
          onCapyClick={handleCapyClick}
          onHintButton={acceptHintOffer}
          onToggleMicrophone={toggleMicrophone}
          onToggleMute={setGlobalMuted}
          onToggleChat={() => setIsChatOpen((o) => !o)}
          onZenAccept={() => {
            setWellbeing((w) => ({ ...w, stage: 2 }));
            setIsRelaxModalOpen(true);
          }}
          onZenDismiss={() => setWellbeing({ stage: 0 })}
        />
      )}

      {/* CHAT VISIBLE DE HUBZI (3.1): historial persistente en panel */}
      {Object.keys(nodes).length > 0 && (
        <HubziChatPanel
          open={isChatOpen}
          messages={chatLog}
          username={currentUser?.username}
          onClose={() => setIsChatOpen(false)}
        />
      )}

      {/* RACHA DE ACIERTOS EN VIVO — feedback positivo, nunca castigo */}
      {streak >= 2 && (
        <motion.div
          key={`streak-${streak}`}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          className="absolute top-16 left-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-arcade bg-[var(--color-arcade-navy-dark)]/90 border-2 border-[var(--color-arcade-orange)]/70 shadow-btn-arcade pointer-events-none"
          title={t('arena.streak_title')}
        >
          <Flame className="w-4 h-4 text-[var(--color-arcade-orange)] fill-current" />
          <span className="text-sm font-black text-white">x{streak}</span>
        </motion.div>
      )}

      {/* GUÍA PASO A PASO DE LA PRIMERA PARTIDA — overlay sobre el tablero
          real (no modal de texto). Solo aparece una vez en la vida del jugador. */}
      <AnimatePresence>
        {guideStep > 0 && Object.keys(nodes).length > 0 && !isFolderModalOpen && (
          <motion.div
            key={`guide-${guideStep}`}
            initial={{ opacity: 0, y: 12, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 8, x: "-50%" }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="absolute left-1/2 bottom-[150px] sm:bottom-[160px] z-50 w-72 p-3 rounded-arcade bg-[var(--color-arcade-navy-dark)]/97 border-2 border-amber-400/80 shadow-[0_10px_30px_rgba(0,0,0,0.55)] text-center pointer-events-auto"
          >
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-300 mb-1">
              {t('arena.guide_step', { step: guideStep })}
            </p>
            <p className="text-[11.5px] font-bold text-white leading-snug">
{guideStep === 1 && t('arena.guide_1')}
{guideStep === 2 && t('arena.guide_2')}
{guideStep === 3 && t('arena.guide_3')}
            </p>
            {guideStep < 3 && (
              <button
                onClick={finishGuided}
                className="mt-1.5 text-[9px] font-bold text-slate-400 hover:text-white underline cursor-pointer"
              >
                {t('arena.guide_skip')}
              </button>
            )}
            {/* Flecha apuntando al mazo/tablero */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 bg-[var(--color-arcade-navy-dark)] border-r-2 border-b-arcade-xs border-amber-400/80" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* BARRA SUPERIOR CON CONTROLES LIMPIOS ESTILO CARD CLASH */}
      <div className="absolute top-2.5 right-3 z-40 flex items-center gap-2">
        {/* BOTÓN VOLVER AL MAPA DE NIVELES — solo con partida en curso */}
        {Object.keys(nodes).length > 0 && (
          <button
            onClick={() => setIsMapVisible(true)}
            className="px-3.5 py-2 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-2 border-[var(--color-arcade-navy-light)] border-b-arcade border-b-[var(--color-arcade-ink)] text-[var(--color-arcade-green)] text-xs font-black uppercase tracking-wide transition-all flex items-center gap-1.5 shadow-btn-green active:translate-y-1 active:shadow-none cursor-pointer"
            title={t('arena.map_title')}
          >
            <Compass className="w-4 h-4 text-[var(--color-arcade-green)]" />
            <span className="hidden sm:inline">{t('arena.map_btn')}</span>
          </button>
        )}

        {/* BOTÓN VOLVER AL MENÚ PRINCIPAL */}
        <button
          onClick={() => {
            setIsFolderModalOpen(false);
            setIsWelcomeScreenVisible(true);
          }}
          className="px-3.5 py-2 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-2 border-[var(--color-arcade-navy-light)] border-b-arcade border-b-[var(--color-arcade-ink)] text-[var(--color-arcade-yellow)] text-xs font-black uppercase tracking-wide transition-all flex items-center gap-1.5 shadow-btn-arcade active:translate-y-1 active:shadow-none cursor-pointer"
          title={t('arena.menu_title')}
        >
          <Home className="w-4 h-4 text-[var(--color-arcade-yellow)]" />
          <span className="hidden sm:inline">{t('arena.menu_btn')}</span>
        </button>

        {/* ACCESIBILIDAD: alto contraste y texto grande */}
        <A11yControls />

        {/* BOTÓN CARPETAS / MATERIALES */}
        <button
          onClick={() => setIsFolderModalOpen(true)}
          className="px-3.5 py-2 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-2 border-[var(--color-arcade-navy-light)] border-b-arcade border-b-[var(--color-arcade-ink)] text-white text-xs font-black uppercase tracking-wide transition-all flex items-center gap-1.5 shadow-btn-arcade active:translate-y-1 active:shadow-none cursor-pointer"
          title={t('arena.folders_title')}
        >
          <FolderIcon className="w-4 h-4 text-[var(--color-arcade-cyan)]" />
          <span className="hidden lg:inline">{t('arena.folders_btn')}</span>
        </button>

        {/* BOTÓN REINICIAR — solo cuando hay una partida que reiniciar */}
        {Object.keys(nodes).length > 0 && (
          <button
            onClick={handleRestartWithNewQuestions}
            className="px-3.5 py-2 rounded-arcade bg-[var(--color-arcade-green)] hover:bg-[#3bb82b] border-2 border-[var(--color-arcade-green-light)] border-b-arcade border-b-[var(--color-arcade-green-shadow)] text-white text-xs font-black uppercase tracking-wide transition-all flex items-center gap-2 shadow-[0_4px_0_var(--color-arcade-navy)] active:translate-y-1 active:shadow-none cursor-pointer"
            title={t('arena.restart_title')}
          >
            <RotateCcw className="w-4 h-4 text-white" />
            <span className="hidden sm:inline font-black tracking-wide">
              {t('arena.restart_btn')}
            </span>
          </button>
        )}
      </div>

      {/* Marcadores de Nivel y Progreso — solo con partida en curso */}
      {Object.keys(nodes).length > 0 && (
      <div className="absolute left-4 top-3 z-30 flex items-center gap-2 sm:gap-2.5">
        {/* Indicador de Nivel 1 a 20 */}
        {(() => {
          const lvlInfo =
            GAME_LEVELS.find((l) => l.level === currentLevel) || GAME_LEVELS[0];
          return (
            <div
              className="hud-chip flex items-center gap-1.5 bg-[var(--color-arcade-navy)] border-2 border-[var(--color-arcade-navy-light)] border-b-arcade-sm border-b-[var(--color-arcade-navy-dark)] px-3.5 py-1.5 rounded-arcade shadow-hud"
              title={t('arena.level_of', { level: currentLevel, max: 20, name: levelName(lvlInfo, t) })}
            >
              <Trophy className="w-4 h-4 text-[var(--color-arcade-yellow)] animate-bounce" />
              <span className="text-[10px] font-black uppercase text-[var(--color-arcade-yellow)] tracking-wider">
                {t('arena.level_tag', { level: currentLevel, max: 20 })}
              </span>
              <span className="text-xs font-black text-white uppercase tracking-wide">
                ({lvlInfo.questions})
              </span>
              {/* Estrellas ganadas en ESTE nivel (HUD de campaña, 3.5) */}
              <span
                className="flex items-center gap-0.5 ml-0.5"
                title={t('arena.stars_here', { count: levelStars[currentLevel] || 0 })}
              >
                {[1, 2, 3].map((s) => (
                  <Star
                    key={s}
                    className={`w-3 h-3 ${
                      s <= (levelStars[currentLevel] || 0)
                        ? "text-[var(--color-arcade-yellow)] fill-[var(--color-arcade-yellow)]"
                        : "text-slate-600"
                    }`}
                  />
                ))}
              </span>
            </div>
          );
        })()}

        {/* CARPETA ACTIVA + NIVEL — nombre de la carpeta y nivel en curso */}
        {(activeFolder?.name || boardInfo?.theme) && (
          <div
            className="hud-chip flex items-center gap-1.5 bg-[var(--color-arcade-navy)] border-2 border-[var(--color-arcade-navy-light)] border-b-arcade-sm border-b-[var(--color-arcade-navy-dark)] px-3.5 py-1.5 rounded-arcade shadow-hud max-w-[280px]"
            title={boardInfo?.title}
          >
            <FolderIcon className="w-3.5 h-3.5 text-[var(--color-arcade-cyan)] shrink-0" />
            <span className="text-[10px] font-black uppercase text-white tracking-wider truncate">
              {activeFolder?.name || boardInfo?.theme}
            </span>
            <span className="text-[10px] font-black uppercase text-[var(--color-arcade-yellow)] tracking-wider whitespace-nowrap">
              · {t('arena.level_tag', { level: currentLevel, max: 20 })}
            </span>
          </div>
        )}

        {/* SIGUIENTE NIVEL SIEMPRE VISIBLE (3.5): acceso directo al mapa
            cuando ya está desbloqueado */}
        {unlockedLevel > currentLevel && currentLevel < maxLevel && (
          <button
            onClick={() => setIsMapVisible(true)}
            className="hud-chip flex items-center gap-1 bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-2 border-[var(--color-arcade-green)]/70 border-b-arcade-sm border-b-[var(--color-arcade-navy-dark)] px-3 py-1.5 rounded-arcade shadow-hud cursor-pointer transition-all"
            title={t('arena.next_level', { level: currentLevel + 1 })}
          >
            <SkipForward className="w-3.5 h-3.5 text-[var(--color-arcade-green)]" />
            <span className="text-[10px] font-black uppercase text-[var(--color-arcade-green)] tracking-wider">
              {t('arena.level_n', { level: currentLevel + 1 })}
            </span>
          </button>
        )}

        {(() => {
          const totalN = Object.keys(nodes).length || 3;
          const doneN = Object.values(nodes).filter((n) =>
            Boolean(n.placedCard),
          ).length;
          const pct = Math.min(100, Math.round((doneN / totalN) * 100));
          return (
            <div
              className="hud-chip flex items-center gap-2 bg-[var(--color-arcade-navy)] border-2 border-[var(--color-arcade-navy-light)] border-b-arcade-sm border-b-[var(--color-arcade-navy-dark)] px-3.5 py-1.5 rounded-arcade shadow-hud"
              title={t('arena.progress_t', { done: doneN, total: totalN, pct })}
            >
              <span className="text-[10px] font-black uppercase text-[var(--color-arcade-green)] tracking-wider">
                {t('arena.progress')}
              </span>
              {/* BARRA DE PROGRESO DEL NIVEL — fill animado + ARIA */}
              <div
                role="progressbar"
                aria-valuenow={doneN}
                aria-valuemin={0}
                aria-valuemax={totalN}
                aria-label={t('arena.progress_aria', { done: doneN, total: totalN })}
                className="relative w-20 sm:w-24 h-3 rounded-full bg-[var(--color-arcade-ink)] border border-[var(--color-arcade-navy-light)] overflow-hidden shadow-inner"
              >
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--color-arcade-green)] to-emerald-300"
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 160, damping: 22 }}
                />
                {pct >= 100 && (
                  <span className="absolute inset-0 rounded-full bg-emerald-300/40 animate-pulse" />
                )}
              </div>
              <span className="text-sm font-black text-white tabular-nums">
                {doneN}/{totalN}
              </span>
            </div>
          );
        })()}
      </div>
      )}

      {/* CARTA VOLADORA EN VIVO (MOVIMIENTO EN TIEMPO REAL AL JUGAR LA MÁQUINA O EL RIVAL) */}
      <AnimatePresence>
        {flyingCard && (
          <motion.div
            initial={{
              top: "8%",
              left: "50%",
              x: "-50%",
              scale: 0.9,
              opacity: 1,
              zIndex: 100,
            }}
            animate={{
              top: flyingCard.targetPos?.top || "50%",
              left: flyingCard.targetPos?.left || "50%",
              x: "-50%",
              y: "-50%",
              scale: 0.5,
              opacity: [1, 1, 0.95],
            }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
            className="fixed pointer-events-none z-50 w-28 h-40 rounded-arcade border-2 border-cyan-400 bg-slate-900 shadow-[0_0_30px_rgba(34,211,238,0.9)] p-2 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono font-bold text-cyan-300 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-400">
                {(flyingCard.card.isTrap || flyingCard.card.isDistractor) ? t('arena.flying_domain') : (flyingCard.card.domain?.toUpperCase() || t('arena.flying_domain'))}
              </span>
              <span className="text-[10px] font-bold text-amber-300 font-mono">
                {flyingCard.card.cost || "+1"}
              </span>
            </div>
            <div className="w-full h-20 rounded-arcade-sm bg-cyan-950/60 border border-cyan-400/40 flex flex-col items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-300 animate-spin" />
              <span className="text-[9px] text-cyan-200 font-bold mt-1">
                {t('arena.flying_placing')}
              </span>
            </div>
            <div className="w-full py-1 px-1.5 rounded-lg bg-slate-950 border border-slate-700 text-center">
              <p className="text-[9px] font-black text-white truncate uppercase">
                {flyingCard.card.name}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TABLERO Y MANO — SOLO CON PARTIDA ACTIVA (sin partida: solo cielo + barra) */}
      {Object.keys(nodes).length > 0 && (
        <>
          {/* TABLERO — consola frontal en todas las pantallas */}
          <BoardConsole
            boardInfo={boardInfo}
            currentLevel={currentLevel}
            nodes={nodes}
            hintNodeId={effHintNodeId}
            nodeFx={nodeFx}
            hasActiveCard={Boolean(activeCardForDrop)}
            matchNodeId={matchNodeId}
            dragPreview={dragPreview}
            onNodeClick={handleNodeClick}
          />

          {/* MANO DE CARTAS EN ABANICO — SOLO SI HAY PARTIDA ACTIVA */}
          <HandTray
            hand={hand}
            handPage={handPage}
            setHandPage={setHandPage}
            hintCardId={effHintCardId}
            selectedCardInHand={selectedCardInHand}
            isActualTurn={isActualTurn}
            theme={boardInfo?.theme}
              onCardClick={(card) => {
              registerUserActivity();
              handleCardClick(card);
            }}
            onCardKeyActivate={(card) => {
              registerUserActivity();
              handleCardKeySelect(card);
            }}
            onCardDrag={handleDragMove}
            onCardDragEnd={(id, info) => {
              registerUserActivity();
              handleDragEnd(id, info);
            }}
          />
        </>
      )}

      {/* MODAL DE TUTORIAL RÁPIDO INTERACTIVO */}
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />

      {logoutConfirmModal}

      {/* MODAL ¡ERES PRO! — confirmación visible tras volver de Stripe */}
      <AnimatePresence>
        {isProModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[var(--color-arcade-navy-dark)]/80 backdrop-blur-sm"
            onClick={() => setIsProModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 12 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-arcade-lg bg-gradient-to-b from-[var(--color-arcade-navy)] to-[var(--color-arcade-navy-dark)] border-4 border-amber-400 shadow-modal-2xl p-6 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-400 border-4 border-amber-200 shadow-[0_0_30px_rgba(251,191,36,0.7)] flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-[var(--color-arcade-navy-dark)]" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-widest text-amber-300">
                {t('arena.pro_title')}
              </h2>
              <p className="mt-2 text-sm font-bold text-slate-200 leading-snug">
                {t('arena.pro_body')}
              </p>
              <button
                onClick={() => setIsProModalOpen(false)}
                className="mt-4 w-full py-3 rounded-arcade bg-[var(--color-arcade-green)] hover:bg-[#3bb82b] border-2 border-[var(--color-arcade-green-light)] border-b-arcade border-b-[var(--color-arcade-green-shadow)] text-white font-black uppercase tracking-widest text-sm shadow-btn-arcade active:translate-y-1 active:shadow-none transition-all cursor-pointer"
              >
                {t('arena.pro_cta')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL DE VICTORIA Y ESTRELLAS CON EFECTO CONFETTI */}
      <VictoryModal
        isOpen={isVictoryModalOpen}
        level={currentLevel}
        accuracy={victoryStats.accuracy}
        totalQuestions={victoryStats.totalQuestions}
        streak={streak}
        campaignCompleted={currentLevel === maxLevel}
        weakNodes={victoryStats.weakNodes || []}
        firstTry={victoryStats.firstTry ?? null}
        masteredConcepts={Object.values(nodes)
          .map((n) => n.placedCard)
          .filter(Boolean)}
        onNextLevel={() => {
          setIsVictoryModalOpen(false);
          setIsLevelTransitioning(false);
          // Persistir victoria apuntando al nivel siguiente como actual
          persistVictoryProgress(Math.min(currentLevel + 1, maxLevel));
          if (currentLevel < maxLevel) setCurrentLevel((prev) => prev + 1);
          // Regresar al mapa de aventura con el nuevo nivel listo
          setIsMapVisible(true);
        }}
        onRetry={() => {
          setIsVictoryModalOpen(false);
          setIsLevelTransitioning(false);
          // Persistir la victoria actual ANTES de regenerar: las estrellas
          // y el XP ganados no se abandonan por querer otro intento.
          persistVictoryProgress(currentLevel);
          handleRestartWithNewQuestions();
        }}
        onGoToMenu={() => {
          setIsVictoryModalOpen(false);
          setIsLevelTransitioning(false);
          // Cualquier victoria (incluso 1★) desbloquea y se registra — antes
          // solo se guardaba con ≥2★ y el progreso se perdía al salir.
          persistVictoryProgress(
            currentLevel < maxLevel ? currentLevel + 1 : currentLevel,
          );
          setIsMapVisible(true);
        }}
        onReview={() => {
          setIsVictoryModalOpen(false);
          setIsLevelTransitioning(false);
          persistVictoryProgress(currentLevel);
        }}
      />

      {/* MODAL DE OPCIONES DE REINICIO (OPCIÓN A: REPETIR MISMO EXAMEN VS OPCIÓN B: NUEVAS PREGUNTAS CON IA) */}
      <RestartOptionsModal
        open={isRestartOptionsModalOpen}
        onClose={() => setIsRestartOptionsModalOpen(false)}
        onSameExam={handleResetCurrentBoard}
        onNewQuestions={handleRegenerateWithNewQuestions}
      />

      {/* MODAL DE SUSCRIPCIÓN STRIPE CHECKOUT (HUBZY PRO) */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        currentUser={currentUser}
        onSubscriptionSuccess={() => {
          setIsSubscriptionModalOpen(false);
          setSuccessNotif(t('arena.pro_active'));
        }}
      />

      {/* MODAL LEGAL Y DE TRANSPARENCIA (TÉRMINOS, PRIVACIDAD, REEMBOLSOS) */}
      <LegalModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        initialTab={legalModalTab}
      />

      {/* BANNER DE CONSENTIMIENTO DE COOKIES */}
      <CookieConsentBanner onOpenLegal={handleOpenLegal} />
    </div>
  );
}
