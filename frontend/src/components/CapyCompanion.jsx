import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Wind,
  X,
  MessageCircle,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Music,
  Music2,
  Crown,
  Heart,
  AlertTriangle,
  Zap,
  Brain,
  PartyPopper,
  Star,
} from "lucide-react";
import CoachMark from "./CoachMark";
import capyFallback from "../assets/mascots/capy_escolar_nino_m.webp";
import { hubziAmbient } from "../utils/hubziAmbient";
import { getMascotByDomain } from "../utils/mascotCatalog";
import { useTranslation } from "react-i18next";

/**
 * Guardián táctico 3D Zen interactivo: la mascota Hubzi con su bocadillo de
 * diálogo, overlays por mood, barra de vida del jefe (nivel 20), controles
 * de micrófono/voz/música y el banner de pausa Zen.
 */
export default function CapyCompanion({
  capySpeech,
  capyMood,
  isCapySad,
  isCapySpeaking,
  isListening,
  isThinkingHint,
  isCapyMuted,
  isAmbientPlaying,
  compact = false, // móvil: versión reducida pegada al borde inferior
  zenOffer,
  hubziStatus = "idle", // estado macro consolidado (3.2)
  chatOpen = false,
  idleBlinkSeq,
  nodes,
  currentLevel,
  boardInfo,
  activeFolder,
  currentUser,
  onCapyClick,
  onHintButton,
  onToggleMicrophone,
  onToggleMute,
  onToggleChat,
  onZenAccept,
  onZenDismiss,
}) {
  const { t } = useTranslation();
  return (
      <div
        className={`capy-companion absolute z-40 flex flex-col items-center select-none pointer-events-auto ${
          compact
            ? "left-0.5 bottom-[118px] top-auto scale-[0.62] origin-bottom-left"
            : "left-2 sm:left-4 top-1/2 -translate-y-1/2"
        }`}
      >
        {/* BOCADILLO DE DIÁLOGO FLOTANTE (ESTILO CÓMIC NEÓN CON TEXTO SINTÉTICO Y MOTIVADOR) */}
        <AnimatePresence>
          {capySpeech.isVisible && capySpeech.text && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className={`absolute -top-26 sm:-top-28 left-0 sm:left-2 w-64 sm:w-72 p-3 rounded-arcade border-2 shadow-2xl backdrop-blur-md z-50 text-left ${
                capyMood === "encouraging" || isCapySad
                  ? "bg-rose-950/98 border-rose-400 text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.45)]"
                  : capyMood === "happy"
                    ? "bg-emerald-950/98 border-emerald-400 text-emerald-100 shadow-[0_0_25px_rgba(52,211,153,0.45)]"
                    : capyMood === "hint"
                      ? "bg-[#101b2b]/98 border-amber-400 text-amber-100 shadow-[0_0_25px_rgba(251,191,36,0.45)]"
                      : "bg-slate-900/98 border-cyan-400 text-slate-100 shadow-[0_0_25px_rgba(6,182,212,0.45)]"
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[8.5px] font-mono font-black uppercase flex items-center gap-1 ${
                      capySpeech.interim
                        ? "text-rose-300"
                        : capyMood === "encouraging" || isCapySad
                        ? "text-rose-300"
                        : capyMood === "happy"
                          ? "text-emerald-300"
                          : capyMood === "hint"
                            ? "text-amber-300"
                            : "text-cyan-300"
                    }`}
                  >
                    {capySpeech.interim ? (
                      <Mic className="w-2.5 h-2.5 text-rose-400 animate-pulse" />
                    ) : (
                      <Sparkles className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                    )}
                    <span>
                      {capySpeech.interim ? (
                        t('hubzi.listening')
                      ) : (
                        <>
                          HUBZI{" "}
                          {capyMood === "hint"
                            ? t('hubzi.says_hint')
                            : capyMood === "happy"
                              ? t('hubzi.says_celebrate')
                              : capyMood === "encouraging"
                                ? t('hubzi.says_cheer')
                                : t('hubzi.says')}
                          :
                        </>
                      )}
                    </span>
                  </span>
                </div>

                {/* Ondas / ecualizador de voz animado */}
                {isCapySpeaking ? (
                  <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-black/40">
                    <motion.span
                      animate={{ height: [4, 12, 4] }}
                      transition={{ repeat: Infinity, duration: 0.35 }}
                      className="w-1 bg-cyan-400 rounded-full"
                    />
                    <motion.span
                      animate={{ height: [6, 16, 6] }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.4,
                        delay: 0.1,
                      }}
                      className="w-1 bg-amber-400 rounded-full"
                    />
                    <motion.span
                      animate={{ height: [4, 14, 4] }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.3,
                        delay: 0.2,
                      }}
                      className="w-1 bg-cyan-300 rounded-full"
                    />
                  </div>
                ) : (
                  <span className="text-[7.5px] text-cyan-400/80 font-mono">
                    {t('hubzi.local_voice')}
                  </span>
                )}
              </div>

              <p
                className={`text-[10.5px] sm:text-[11.5px] leading-snug break-words ${
                  capySpeech.interim ? "italic font-semibold opacity-90" : "font-medium"
                }`}
              >
                {capySpeech.interim ? `“${capySpeech.text}”` : capySpeech.text}
              </p>

              {/* BOTÓN DE PISTA DIRECTA — aparece tras 2 fallos seguidos
                  ("este tema está difícil — ¿quieres una pista?") */}
              {capySpeech.showHintButton && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onHintButton) onHintButton();
                  }}
                  className="mt-2 w-full py-1.5 px-3 rounded-arcade-sm bg-amber-400 hover:bg-amber-300 border-2 border-amber-200 border-b-arcade border-b-amber-600 text-amber-950 font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer active:translate-y-0.5 active:border-b-arcade-xs transition-all"
                >
                  <Sparkles className="w-3 h-3" />
                  {t('hubzi.give_hint')}
                </button>
              )}

              {/* Flecha cómic del bocadillo */}
              <div
                className={`absolute -bottom-2 left-8 w-3.5 h-3.5 rotate-45 border-r-2 border-b-arcade-xs ${
                  capyMood === "encouraging" || isCapySad
                    ? "bg-rose-950 border-rose-400"
                    : capyMood === "happy"
                      ? "bg-emerald-950 border-emerald-400"
                      : capyMood === "hint"
                        ? "bg-[#101b2b] border-amber-400"
                        : "bg-slate-900 border-cyan-400"
                }`}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* BANNER INTERACTIVO DE APOYO DE ESTUDIO */}
        <AnimatePresence>
          {zenOffer.show && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute bottom-28 right-0 z-50 p-3 w-64 rounded-arcade bg-gradient-to-br from-[var(--color-arcade-navy)] via-[var(--color-arcade-navy-dark)] to-slate-900 border-3 border-[var(--color-arcade-navy-light)] shadow-[0_8px_0_var(--color-arcade-ink)] backdrop-blur-md flex flex-col gap-2 pointer-events-auto text-left text-white"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-[var(--color-arcade-yellow)] font-mono flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-[var(--color-arcade-yellow)] animate-pulse" />
                  {t('hubzi.zen_banner')}
                </span>
                <button
                  onClick={onZenDismiss}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  title={t('hubzi.close')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[10.5px] text-slate-200 leading-snug font-bold">
                {zenOffer.distortion
                  ? t('hubzi.zen_distort')
                  : t('hubzi.zen_default')}
              </p>
              <button
                onClick={() => {
                  onZenDismiss();
                  onZenAccept();
                }}
                className="w-full py-2 px-3 rounded-arcade-sm bg-[var(--color-arcade-green)] hover:bg-[#57d847] border-2 border-[var(--color-arcade-green-light)] border-b-arcade-sm border-b-[var(--color-arcade-green-shadow)] text-white font-black text-[10px] tracking-wide uppercase shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:translate-y-0.5 transition-all"
              >
                <Sparkles className="w-3 h-3 text-white" />
                {t('hubzi.zen_cta')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          animate={
            capyMood === "dancing"
              ? {
                  x: [0, -14, 14, -10, 10, -6, 6, 0],
                  rotateZ: [-12, 12, -12, 12, -8, 8, 0],
                  scale: [1, 1.08, 0.95, 1.08, 1],
                  y: [0, -8, 0, -8, 0],
                }
              : capyMood === "celebrating"
                ? {
                    y: [0, -20, 0, -15, 0, -10, 0],
                    scale: [1, 1.12, 0.9, 1.12, 1],
                    rotateZ: [-5, 5, -5, 5, 0],
                  }
                : capyMood === "love"
                  ? {
                      scale: [1, 1.06, 1, 1.06, 1],
                      y: [0, -5, 0, -5, 0],
                      rotateZ: [-2, 2, -2, 2, 0],
                    }
                  : capyMood === "happy"
                    ? {
                        y: [0, -12, 0, -8, 0],
                        scale: [1, 1.08, 1],
                        rotateZ: [-3, 3, -3],
                      }
                    : capyMood === "thinking"
                      ? {
                          rotateZ: [-3, 3, -3],
                          y: [0, -4, 0],
                          scale: [1, 1.02, 1],
                        }
                      : capyMood === "surprised"
                        ? {
                            y: [0, -18, 4, 0],
                            scale: [1, 1.15, 0.92, 1],
                            rotateZ: [-6, 6, -3, 0],
                          }
                        : isCapySad
                          ? {
                              x: [0, -8, 8, -8, 8, -5, 5, 0],
                              y: [0, 4, 0, 4, 0],
                              rotateZ: [-4, 4, -4, 4, 0],
                              scale: [1, 0.96, 1],
                            }
                          : isCapySpeaking
                            ? {
                                y: [0, -6, 0],
                                scale: [1, 1.05, 1],
                                rotateZ: [-1.5, 1.5, -1.5],
                              }
                            : {
                                y: [0, -10, 0],
                                rotateZ: [-2, 2, -2],
                                scale: [1, 1.03, 1],
                              }
          }
          transition={
            capyMood === "dancing"
              ? { repeat: Infinity, duration: 0.55, ease: "easeInOut" }
              : capyMood === "celebrating"
                ? { repeat: Infinity, duration: 0.7, ease: "easeInOut" }
                : capyMood === "love"
                  ? { repeat: Infinity, duration: 1.8, ease: "easeInOut" }
                  : capyMood === "happy"
                    ? { repeat: Infinity, duration: 0.6, ease: "easeInOut" }
                    : capyMood === "thinking"
                      ? { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
                      : capyMood === "surprised"
                        ? { duration: 0.5, repeat: 2, ease: "easeOut" }
                        : isCapySad
                          ? { duration: 0.6, repeat: 2, ease: "easeInOut" }
                          : isCapySpeaking
                            ? {
                                repeat: Infinity,
                                duration: 0.45,
                                ease: "easeInOut",
                              }
                            : {
                                repeat: Infinity,
                                duration: 3.8,
                                ease: "easeInOut",
                              }
          }
          whileHover={{ scale: 1.15, rotate: 4 }}
          whileTap={{ scale: 0.92 }}
          onClick={onCapyClick}
          className="relative group cursor-pointer flex flex-col items-center"
          title={t('hubzi.click_hint')}
        >
          {/* Base Holográfica — brillo en los pies según mood */}
          <div
            className={`w-32 h-7 rounded-full blur-md -mb-4 transition-colors duration-300 ${
              isCapySad
                ? "bg-rose-500/40"
                : capyMood === "dancing"
                  ? "bg-purple-500/60"
                  : capyMood === "celebrating"
                    ? "bg-amber-400/60"
                    : capyMood === "love"
                      ? "bg-rose-400/50"
                      : capyMood === "happy"
                        ? "bg-emerald-400/50"
                        : capyMood === "thinking"
                          ? "bg-cyan-400/40"
                          : capyMood === "surprised"
                            ? "bg-indigo-400/50"
                            : isCapySpeaking
                              ? "bg-amber-400/50"
                              : "bg-cyan-400/40"
            }`}
          />

          {/* Mascota de Cuerpo Completo (sin recorte circular ni bordes oscuros) */}
          <motion.div
            className={`relative w-28 h-36 sm:w-32 sm:h-40 flex items-center justify-center transition-all duration-500 ${
              isCapySad
                ? "drop-shadow-[0_10px_20px_rgba(244,63,94,0.7)]"
                : capyMood === "dancing"
                  ? "drop-shadow-[0_10px_25px_rgba(168,85,247,0.85)]"
                  : capyMood === "celebrating"
                    ? "drop-shadow-[0_10px_30px_rgba(251,191,36,0.9)]"
                    : capyMood === "love"
                      ? "drop-shadow-[0_10px_25px_rgba(251,113,133,0.8)]"
                      : capyMood === "happy"
                        ? "drop-shadow-[0_10px_25px_rgba(52,211,153,0.75)]"
                        : capyMood === "thinking"
                          ? "drop-shadow-[0_10px_20px_rgba(34,211,238,0.6)]"
                          : capyMood === "surprised"
                            ? "drop-shadow-[0_10px_25px_rgba(99,102,241,0.8)]"
                            : isCapySpeaking
                              ? "drop-shadow-[0_10px_25px_rgba(251,191,36,0.8)]"
                              : "drop-shadow-[0_10px_20px_rgba(52,211,153,0.5)] group-hover:drop-shadow-[0_12px_28px_rgba(34,211,238,0.8)]"
            }`}
          >
            {/* CORONA Y BARRA DE VIDA DE JEFE FINAL (NIVEL 20) */}
            {currentLevel === 20 && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
                <Crown className="w-8 h-8 text-[var(--color-arcade-yellow)] fill-[var(--color-arcade-yellow)] drop-shadow-[0_3px_6px_rgba(0,0,0,0.8)] animate-bounce" />
                <div className="w-24 h-2 bg-slate-900 border border-amber-400 rounded-full overflow-hidden shadow-md mt-0.5">
                  {(() => {
                    const totalNodes = Object.keys(nodes).length || 20;
                    const solvedNodes = Object.values(nodes).filter((n) =>
                      Boolean(n.placedCard),
                    ).length;
                    const remainingHpPct = Math.max(
                      0,
                      Math.round(
                        ((totalNodes - solvedNodes) / totalNodes) * 100,
                      ),
                    );
                    return (
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 transition-all duration-500"
                        style={{ width: `${remainingHpPct}%` }}
                      />
                    );
                  })()}
                </div>
                <span className="text-[8px] font-black uppercase tracking-wider text-amber-300 drop-shadow">
                  {t('hubzi.boss_hp')}
                </span>
              </div>
            )}

            {(() => {
              const activeTheme =
                boardInfo?.theme || activeFolder?.name || "general";
              const resolvedMascot = getMascotByDomain(
                activeTheme,
                currentUser?.gender,
              );
              const mascotSrc = resolvedMascot?.image || capyFallback;
              const mascotTitle = resolvedMascot?.name || t('hubzi.mascot_default');

              return (
                <motion.img
                  /* PARPADEO DE COMPAÑÍA: idleBlinkSeq cambia con cada nudge
                     de inactividad (>40s) → remonta y re-anim una vez */
                  key={`mascot-blink-${idleBlinkSeq ?? 0}`}
                  initial={{ scaleY: 1 }}
                  animate={{ scaleY: [1, 0.82, 1] }}
                  transition={{ duration: 0.85, ease: "easeInOut" }}
                  src={mascotSrc}
                  alt={mascotTitle}
                  title={`${mascotTitle} - ${resolvedMascot?.role || t('hubzi.mascot_role')}`}
                  className={`w-full h-full object-contain object-bottom pointer-events-none select-none transition-all duration-300 ${
                    isCapySad
                      ? "brightness-90 saturate-85"
                      : capyMood === "love"
                        ? "brightness-105 saturate-110"
                        : capyMood === "celebrating"
                          ? "brightness-110 saturate-120"
                          : "group-hover:scale-105"
                  }`}
                />
              );
            })()}


            {/* ===== OVERLAYS POR MOOD ===== */}

            {/* OVERLAY DANCING: notas musicales */}
            {capyMood === "dancing" && (
              <div className="absolute inset-0 pointer-events-none z-20">
                {[Music, Music2, Music, Music2].map((NoteIcon, i) => (
                  <motion.span
                    key={i}
                    className="absolute"
                    style={{ left: `${15 + i * 20}%`, top: "10%" }}
                    animate={{
                      y: [0, -30],
                      opacity: [0, 1, 0],
                      scale: [0.8, 1.2, 0.8],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      delay: i * 0.25,
                    }}
                  >
                    <NoteIcon className="w-3 h-3 text-purple-300" />
                  </motion.span>
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-purple-950/50 via-transparent to-transparent" />
              </div>
            )}

            {/* OVERLAY CELEBRATING: estrellas y destellos */}
            {capyMood === "celebrating" && (
              <div className="absolute inset-0 pointer-events-none z-20">
                {[Star, Sparkles, Star, Sparkles, Zap].map((StarIcon, i) => (
                  <motion.span
                    key={i}
                    className="absolute"
                    style={{
                      left: `${5 + i * 18}%`,
                      top: `${10 + (i % 3) * 15}%`,
                    }}
                    animate={{
                      y: [0, -25],
                      x: [i % 2 === 0 ? 5 : -5],
                      opacity: [0, 1, 1, 0],
                      scale: [0.5, 1.3, 0.5],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.8,
                      delay: i * 0.16,
                    }}
                  >
                    <StarIcon className="w-3.5 h-3.5 text-amber-300 fill-amber-300/60" />
                  </motion.span>
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-amber-950/40 via-transparent to-transparent" />
              </div>
            )}

            {/* OVERLAY LOVE: corazones flotando */}
            {capyMood === "love" && (
              <div className="absolute inset-0 pointer-events-none z-20">
                {["text-rose-400", "text-sky-400", "text-rose-300", "text-pink-300", "text-rose-500"].map((heartColor, i) => (
                  <motion.span
                    key={i}
                    className="absolute"
                    style={{ left: `${8 + i * 18}%`, bottom: "5%" }}
                    animate={{
                      y: [0, -50],
                      opacity: [0, 1, 1, 0],
                      x: [0, i % 2 === 0 ? 8 : -8],
                      scale: [0.7, 1.1, 0.7],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.6,
                      delay: i * 0.32,
                    }}
                  >
                    <Heart className={`w-3 h-3 ${heartColor} fill-current`} />
                  </motion.span>
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-rose-950/40 via-transparent to-transparent" />
              </div>
            )}

            {/* OVERLAY HAPPY: chispas verdes */}
            {capyMood === "happy" && !isCapySad && (
              <div className="absolute inset-0 pointer-events-none z-20">
                {[...Array(4)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full bg-emerald-400"
                    style={{ left: `${15 + i * 20}%`, top: "20%" }}
                    animate={{ y: [0, -20], opacity: [1, 0], scale: [1, 0.5] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.7,
                      delay: i * 0.18,
                    }}
                  />
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/30 via-transparent to-transparent" />
              </div>
            )}

            {/* OVERLAY THINKING: burbujas de pensamiento */}
            {capyMood === "thinking" && (
              <div className="absolute inset-0 pointer-events-none z-20">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full bg-cyan-400/70"
                    style={{
                      width: `${6 + i * 3}px`,
                      height: `${6 + i * 3}px`,
                      top: `${20 + i * 12}%`,
                      right: `${10 + i * 5}%`,
                    }}
                    animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1 + i * 0.3,
                      delay: i * 0.2,
                    }}
                  />
                ))}
                <Brain className="absolute top-2 right-2 w-3.5 h-3.5 text-cyan-300" />
              </div>
            )}

            {/* OVERLAY SURPRISED: destellos de sorpresa */}
            {capyMood === "surprised" && (
              <div className="absolute inset-0 pointer-events-none z-20">
                <motion.span
                  className="absolute top-2 left-1/2 -translate-x-1/2"
                  animate={{ scale: [0.8, 1.4, 0.8], opacity: [0.7, 1, 0.7] }}
                  transition={{ repeat: Infinity, duration: 0.6 }}
                >
                  <Zap className="w-5 h-5 text-indigo-300" />
                </motion.span>
                {[...Array(4)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1.5 h-6 bg-indigo-400 rounded-full"
                    style={{
                      top: "30%",
                      left: "50%",
                      transformOrigin: "50% 100%",
                      rotate: `${i * 90}deg`,
                    }}
                    animate={{ scaleY: [0.3, 1, 0.3], opacity: [0.4, 1, 0.4] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.5,
                      delay: i * 0.12,
                    }}
                  />
                ))}
              </div>
            )}

            {/* OVERLAY SAD: lágrimas (existente mejorado) */}
            {isCapySad && (
              <div className="absolute inset-0 flex flex-col items-center justify-between p-2 pointer-events-none z-20">
                <div className="relative w-full h-full">
                  <motion.div
                    animate={{ y: [0, 40], opacity: [1, 0], scale: [0.8, 1.2] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.45,
                      ease: "easeIn",
                    }}
                    className="absolute top-1/4 left-[28%] w-1.5 h-4 rounded-full bg-cyan-300 shadow-glow-cyan-sm"
                  />
                  <motion.div
                    animate={{ y: [0, 40], opacity: [1, 0], scale: [0.8, 1.2] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.5,
                      delay: 0.12,
                      ease: "easeIn",
                    }}
                    className="absolute top-1/4 right-[28%] w-1.5 h-4 rounded-full bg-cyan-300 shadow-glow-cyan-sm"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-rose-950/80 via-transparent to-black/30 pointer-events-none" />
                <AlertTriangle className="w-6 h-6 text-rose-300 animate-bounce drop-shadow-md z-10" />
              </div>
            )}


          </motion.div>

          {/* Badge 3D interactivo con estado — refleja todos los moods.
              Los controles van en su propia fila (más grandes, táctiles) */}
          <div className="mt-2 flex flex-col items-center gap-2 z-20">
            <div
              className={`px-3 py-0.5 rounded-full bg-slate-900/95 shadow-lg text-center backdrop-blur-sm border transition-colors duration-500 ${
                isCapySad
                  ? "border-rose-500/80"
                  : capyMood === "dancing"
                    ? "border-purple-400/80"
                    : capyMood === "celebrating"
                      ? "border-amber-400/80"
                      : capyMood === "love"
                        ? "border-rose-400/80"
                        : capyMood === "happy"
                          ? "border-emerald-400/80"
                          : capyMood === "thinking"
                            ? "border-cyan-400/80"
                            : capyMood === "surprised"
                              ? "border-indigo-400/80"
                              : isCapySpeaking
                                ? "border-cyan-400"
                                : "border-emerald-400/80"
              }`}
            >
              <span
                className={`text-[9px] font-black font-mono tracking-wider flex items-center gap-1 justify-center transition-colors duration-300 ${
                  isCapySad
                    ? "text-rose-300"
                    : capyMood === "dancing"
                      ? "text-purple-300"
                      : capyMood === "celebrating"
                        ? "text-amber-300"
                        : capyMood === "love"
                          ? "text-rose-300"
                          : capyMood === "happy"
                            ? "text-emerald-300"
                            : capyMood === "thinking"
                              ? "text-cyan-300"
                              : capyMood === "surprised"
                                ? "text-indigo-300"
                                : isCapySpeaking
                                  ? "text-cyan-300"
                                  : "text-emerald-300"
                }`}
              >
                {isCapySad ? (
                  <>
                    <Sparkles className="w-2.5 h-2.5 text-rose-400 animate-pulse" />{" "}
                    {t('hubzi.st_support')}
                  </>
                ) : capyMood === "dancing" ? (
                  <>
                    <Music className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />{" "}
                    {t('hubzi.st_motivated')}
                  </>
                ) : capyMood === "celebrating" ? (
                  <>
                    <PartyPopper className="w-2.5 h-2.5 text-amber-400 animate-pulse" />{" "}
                    {t('hubzi.st_celebrate')}
                  </>
                ) : capyMood === "love" ? (
                  <>
                    <Heart className="w-2.5 h-2.5 text-rose-400 animate-pulse" />{" "}
                    {t('hubzi.st_with_you')}
                  </>
                ) : capyMood === "happy" ? (
                  <>
                    <Sparkles className="w-2.5 h-2.5 text-emerald-400" />{" "}
                    {t('hubzi.st_great')}
                  </>
                ) : capyMood === "thinking" ? (
                  <>
                    <Brain className="w-2.5 h-2.5 text-cyan-300 animate-pulse" />{" "}
                    {t('hubzi.st_thinking')}
                  </>
                ) : capyMood === "surprised" ? (
                  <>
                    <Zap className="w-2.5 h-2.5 text-indigo-400 animate-pulse" />{" "}
                    {t('hubzi.st_amazed')}
                  </>
                ) : isCapySpeaking ? (
                  <>
                    <MessageCircle className="w-2.5 h-2.5 text-cyan-300 animate-pulse" />{" "}
                    HUBZY
                  </>
                ) : (
                  <>
                    <Sparkles className="w-2.5 h-2.5 text-amber-400 animate-pulse" />{" "}
                    HUBZY
                  </>
                )}
              </span>
            </div>

          {/* CONTROLES 2x2 — micrófono, voz, música y respiración */}
          <div className="grid grid-cols-2 gap-2.5 place-items-center">
            {/* Botón Micrófono para hablar por voz con Hubzi */}
            <span className="relative inline-flex">
              <CoachMark id="mic" position="top">
                {t('hubzi.coachmark_mic')}
              </CoachMark>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMicrophone();
              }}
              className={`p-2.5 rounded-full border-2 transition-all duration-300 shadow-md cursor-pointer flex items-center justify-center ${
                isListening
                  ? "bg-rose-600 border-rose-400 text-white ring-4 ring-rose-400/60 animate-pulse shadow-[0_0_15px_#f43f5e]"
                  : isThinkingHint
                    ? "bg-amber-600 border-amber-400 text-white ring-4 ring-amber-400/60 animate-spin"
                    : "bg-slate-900/90 border-cyan-400/70 hover:border-cyan-300 text-cyan-300 hover:scale-110 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
              }`}
              title={
                isListening
                  ? t('hubzi.mic_stop')
                  : t('hubzi.mic_talk')
              }
              aria-label={
                isListening ? t('hubzi.mic_stop') : t('hubzi.mic_aria')
              }
            >
              {isListening ? (
                <MicOff className="w-5 h-5 text-white" />
              ) : (
                <Mic className="w-5 h-5 text-cyan-300" />
              )}
            </button>
            </span>

            {/* Botón Silenciar / Activar TODO el sonido (persistente) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMute(!isCapyMuted);
              }}
              className="p-2.5 rounded-full bg-slate-900/90 border-2 border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 transition-colors shadow-md cursor-pointer"
              title={
                isCapyMuted
                  ? t('hubzi.sound_on')
                  : t('hubzi.sound_off')
              }
              aria-label={
                isCapyMuted ? t('hubzi.sound_on_s') : t('hubzi.sound_off_s')
              }
            >
              {isCapyMuted ? (
                <VolumeX className="w-5 h-5 text-rose-400" />
              ) : (
                <Volume2 className="w-5 h-5 text-cyan-300" />
              )}
            </button>

            {/* Botón Música Ambient Calmante */}
            <button
              data-ambient-toggle
              onClick={(e) => {
                e.stopPropagation();
                hubziAmbient.toggle();
              }}
              className={`p-2.5 rounded-full border-2 transition-all duration-300 shadow-md cursor-pointer ${
                isAmbientPlaying
                  ? "bg-purple-900/90 border-purple-400 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.6)] ring-2 ring-purple-400/40"
                  : "bg-slate-900/90 border-slate-700 hover:border-purple-400 text-slate-400 hover:text-purple-300"
              }`}
              title={
                isAmbientPlaying
                  ? t('hubzi.music_stop')
                  : t('hubzi.music_play')
              }
            >
              {isAmbientPlaying ? (
                <Music2 className="w-5 h-5 text-purple-300 animate-pulse" />
              ) : (
                <Music className="w-5 h-5" />
              )}
            </button>

            {/* Botón CHAT — historial visible de la conversación (3.1) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleChat?.();
              }}
              className={`p-2.5 rounded-full border-2 transition-all duration-300 shadow-md cursor-pointer ${
                chatOpen
                  ? "bg-cyan-900/90 border-cyan-400 text-cyan-200 ring-2 ring-cyan-400/40"
                  : "bg-slate-900/90 border-slate-700 hover:border-cyan-400 text-slate-400 hover:text-cyan-300"
              }`}
              title={t('hubzi.chat_view')}
              aria-label={t('hubzi.chat_open')}
            >
              <MessageCircle className="w-5 h-5" />
            </button>

            {/* BOTÓN RESPIRA — acceso directo a la pausa Zen, junto a Hubzi,
                mientras la oferta anti-estrés está activa (3 fallos seguidos) */}
            {zenOffer?.show && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onZenAccept) onZenAccept();
                }}
                className="col-span-2 px-2 py-1 rounded-full bg-emerald-600/95 border border-emerald-300 text-white text-[8px] font-black uppercase tracking-wider shadow-[0_0_14px_rgba(52,211,153,0.7)] animate-pulse cursor-pointer flex items-center gap-1"
                title={t('hubzi.breathe_t')}
              >
                <Wind className="w-3 h-3" />
                {t('hubzi.breathe')}
              </motion.button>
            )}
          </div>
          </div>

          {/* Micro-pista interactiva al pasar el mouse */}
          <span
            className={`text-[7.5px] font-mono mt-1 text-center transition-colors ${
              isListening
                ? "text-rose-400 font-bold animate-pulse"
                : "text-cyan-300/80 group-hover:text-cyan-200"
            }`}
          >
            {hubziStatus === "listening"
              ? t('hubzi.st_listening')
              : hubziStatus === "thinking"
                ? t('hubzi.st_think_warm')
                : hubziStatus === "alert"
                  ? t('hubzi.st_alert')
                  : t('hubzi.st_idle')}
          </span>
        </motion.div>
      </div>
  );
}
