import React, { useState, useEffect, useRef } from 'react';
import { fetchWithAuth, uploadWithProgress } from '../lib/api';
import { track } from '../utils/uxTelemetry';
import i18n from '../i18n';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderPlus,
  Folder,
  Sparkles,
  Plus,
  Trash2,
  Layers,
  PlayCircle,
  ChevronRight,
  FolderArchive,
  UploadCloud,
  FileText,
  FileAudio,
  Image as ImageIcon,
  ArrowLeft,
  Gamepad2,
  CheckCircle2,
  Zap,
  Loader2,
  X,
  Home,
  AlertCircle,
  Palmtree,
  Pin,
  School,
  Waves,
  Star,
  RotateCw,
  Pencil,
  AlertTriangle
} from 'lucide-react';
import { resolveDynamicIcon } from '../utils/domainIcons';

const STORAGE_KEY = 'hubzy_user_study_folders';

// Paleta rotativa de identidad visual por isla: cada isla del archipiélago
// recibe su propio color + el icono se resuelve por el tema de su nombre.
const ISLAND_STYLES = [
  { icon: 'text-white', blob: 'from-cyan-400 to-cyan-500/85 border-cyan-500/60',       ring: 'hover:border-cyan-400',    badge: 'bg-cyan-50 text-cyan-700 border-cyan-300' },
  { icon: 'text-white', blob: 'from-violet-400 to-violet-500/85 border-violet-500/60', ring: 'hover:border-violet-400',  badge: 'bg-violet-50 text-violet-700 border-violet-300' },
  { icon: 'text-white', blob: 'from-orange-400 to-orange-500/85 border-orange-500/60', ring: 'hover:border-orange-400',  badge: 'bg-orange-50 text-orange-700 border-orange-300' },
  { icon: 'text-white', blob: 'from-emerald-400 to-emerald-500/85 border-emerald-500/60', ring: 'hover:border-emerald-400', badge: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  { icon: 'text-white', blob: 'from-rose-400 to-rose-500/85 border-rose-500/60',       ring: 'hover:border-rose-400',    badge: 'bg-rose-50 text-rose-700 border-rose-300' },
  { icon: 'text-white', blob: 'from-amber-400 to-amber-500/85 border-amber-500/60',    ring: 'hover:border-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-300' },
];
// Clave de storage por usuario: las carpetas de una cuenta logueada NUNCA
// se escriben en la clave genérica — las filtraría a quien use el navegador
// después con otra sesión.
const folderStorageKey = (user) =>
  user?.id ? `${STORAGE_KEY}_${user.id}` : STORAGE_KEY;

// Fecha ISO "2026-10-28T00:48:55+00:00" → "28 oct 2026"
const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const loc = { es: 'es-ES', en: 'en-US', pt: 'pt-BR' }[i18n.language?.split('-')[0]] || 'es-ES';
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
};

// Modo degradado (backend sin Mongo): la respuesta puede llegar vacía y
// pisaría las carpetas guardadas en localStorage — unir por id, backend gana.
const mergeSavedFolders = (backendList, storageKey) => {
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(storageKey) || '[]') || [];
  } catch {}
  const list = (backendList || []).filter((f) => f?.id !== 'folder_administracion_default');
  const ids = new Set(list.map((f) => f.id));
  return [
    ...list,
    ...saved.filter((f) => f?.id && f.id !== 'folder_administracion_default' && !ids.has(f.id)),
  ];
};

// "22447.4 KB" → "22.4 MB" (auto-escala KB→MB→GB)
const formatDocSize = (size) => {
  if (!size) return '';
  const m = /^([\d.]+)\s*(KB|MB|GB|B)?/i.exec(String(size));
  if (!m) return String(size);
  let n = parseFloat(m[1]);
  let unit = (m[2] || 'KB').toUpperCase();
  if (unit === 'KB' && n >= 1024) { n /= 1024; unit = 'MB'; }
  if (unit === 'MB' && n >= 1024) { n /= 1024; unit = 'GB'; }
  return `${Number.isInteger(n) ? n : n.toFixed(1)} ${unit}`;
};

export default function StudyFolderManagerModal({
  isOpen,
  currentUser,
  onClose,
  onBackToMenu,
  onSelectFolder,
  onUpgradeToPro
}) {
  const { t } = useTranslation();
  const userStorageKey = currentUser?.id ? `hubzy_user_study_folders_${currentUser.id}` : 'hubzy_user_study_folders';
  // Carpeta abierta al recargar: el baúl recuerda dentro de cuál estabas
  const folderViewKey = currentUser?.id ? `hubzy_folder_view_${currentUser.id}` : 'hubzy_folder_view';
  const restoredViewRef = useRef(false);

  const [folders, setFolders] = useState(() => {
    try {
      const saved = localStorage.getItem(userStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  
  // Vista activa: 'list' (viendo todas las carpetas) o 'detail' (adentro de una carpeta específica)
  const [activeFolderView, setActiveFolderView] = useState(null); // folder object or null
  const fileInputRef = useRef(null);

  // Estado de procesamiento de 5 segundos al iniciar juego
  const [isProcessingGame, setIsProcessingGame] = useState(false);
  const [processingCountdown, setProcessingCountdown] = useState(5);
  const processingTimerRef = useRef(null);

  // Errores de subida por archivo (reemplaza los alert() nativos)
  const [uploadErrors, setUploadErrors] = useState([]);
  // Cuota de almacenamiento de la cuenta (viene del backend en GET /folders)
  const [storageInfo, setStorageInfo] = useState({ used_mb: 0, limit_mb: null });

  // "Tu isla se está generando": tras una subida, el backend detecta temas
  // en background (~30s). Sondeamos /folders hasta que el archipiélago
  // aparezca — progreso real, no un spinner mudo.
  const [islandGenPending, setIslandGenPending] = useState(false);
  const islandGenPollRef = useRef(null);

  const stopIslandGenPoll = () => {
    if (islandGenPollRef.current) {
      clearInterval(islandGenPollRef.current);
      islandGenPollRef.current = null;
    }
    setIslandGenPending(false);
  };

  const startIslandGenPoll = (folderId) => {
    if (islandGenPollRef.current) clearInterval(islandGenPollRef.current);
    setIslandGenPending(true);
    const startedAt = Date.now();
    islandGenPollRef.current = setInterval(async () => {
      // Timeout suave: si el backend no detectó temas, igual se puede jugar
      // en modo mezclado — el banner simplemente se retira.
      if (Date.now() - startedAt > 75000) {
        stopIslandGenPoll();
        return;
      }
      try {
        const res = await fetchWithAuth('/api/v1/folders');
        if (!res.ok) return;
        const data = await res.json();
        const fresh = (data?.folders || []).find((f) => f.id === folderId);
        if (fresh?.islands?.length) {
          stopIslandGenPoll();
          applyIslands(folderId, fresh.islands);
        }
      } catch {}
    }, 3000);
  };

  // Detección de temas en curso para la carpeta abierta (archipiélago)
  const [detectingTopics, setDetectingTopics] = useState(false);
  // Selector de islas: solo se revela al pulsar "Iniciar juego" — la carpeta
  // muestra documentos, y el archipiélago se crea/muestra al iniciar.
  const [showIslandPicker, setShowIslandPicker] = useState(false);
  // Regeneración: re-detección de temas (islas) e invalidación de preguntas por isla
  const [regeneratingIslands, setRegeneratingIslands] = useState(false);
  const [regeneratingIslandId, setRegeneratingIslandId] = useState(null);
  // Toast de celebración cuando la detección revela temas nuevos
  const [topicsToast, setTopicsToast] = useState(null);

  // Limpiar temporizador al desmontar o cerrar modal
  useEffect(() => {
    return () => {
      if (processingTimerRef.current) clearInterval(processingTimerRef.current);
      if (islandGenPollRef.current) clearInterval(islandGenPollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setIsProcessingGame(false);
      setProcessingCountdown(5);
      setShowIslandPicker(false);
      setDetectingTopics(false);
      stopIslandGenPoll();
      if (processingTimerRef.current) clearInterval(processingTimerRef.current);
    }
  }, [isOpen]);

  // Al abrir una carpeta con documentos pero sin islas detectadas, pedir al
  // backend la detección de temas (el upload ya la lanza en background; este
  // endpoint es idempotente — solo analiza docs sin topic_sections).
  // Aplica las islas devueltas por detect-topics y anuncia con un toast
  // cuando aparecen temas nuevos (momento "wow" del archipiélago).
  const applyIslands = (folderId, islands) => {
    const hadCount =
      activeFolderView?.id === folderId && Array.isArray(activeFolderView.islands)
        ? activeFolderView.islands.length
        : 0;
    setActiveFolderView((prev) =>
      prev?.id === folderId ? { ...prev, islands } : prev,
    );
    setFolders((prev) =>
      prev.map((x) => (x.id === folderId ? { ...x, islands } : x)),
    );
    const named = (islands || []).filter((i) => i?.name && i.name !== 'General');
    if (named.length && (islands?.length || 0) > hadCount) {
      setTopicsToast({
        count: named.length,
        names: named.slice(0, 3).map((i) => i.name),
      });
    }
  };

  // El toast se auto-oculta tras unos segundos
  useEffect(() => {
    if (!topicsToast) return;
    const t = setTimeout(() => setTopicsToast(null), 6500);
    return () => clearTimeout(t);
  }, [topicsToast]);

  // Cargar las carpetas privadas del usuario activo desde el backend o localStorage
  useEffect(() => {
    if (!isOpen) {
      restoredViewRef.current = false;
      return;
    }
    const currentKey = folderStorageKey(currentUser);
    const savedViewId = localStorage.getItem(folderViewKey) || '';
    const restoreView = (list) => {
      if (restoredViewRef.current || !savedViewId) return;
      const match = (list || []).find((f) => f.id === savedViewId);
      if (match) {
        setActiveFolderView(match);
        restoredViewRef.current = true;
      }
    };
    try {
      const saved = localStorage.getItem(currentKey);
      if (saved) {
        // Migración: purga la carpeta demo estática (ya no existe el backend)
        const cleaned = JSON.parse(saved).filter(
          (f) => f?.id !== 'folder_administracion_default',
        );
        setFolders(cleaned);
        restoreView(cleaned);
      } else {
        setFolders([]);
      }
    } catch {
      setFolders([]);
    }

    const userIdParam = currentUser?.id ? `?user_id=${currentUser.id}` : '';
    fetchWithAuth(`/api/v1/folders${userIdParam}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.folders) {
          const list = data.folders.filter(
            (f) => f?.id !== 'folder_administracion_default',
          );
          // Modo degradado (backend sin Mongo): la respuesta llega vacía
          // y pisaría las carpetas guardadas en localStorage — unir por id.
          const list_merged = mergeSavedFolders(list, currentKey);
          setFolders(list_merged);
          localStorage.setItem(currentKey, JSON.stringify(list_merged));
          setStorageInfo({
            used_mb: data.storage_used_mb ?? 0,
            limit_mb: data.storage_limit_mb ?? null,
          });
          restoreView(list);
        }
      })
      .catch(() => {});
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentUser]);

  // Recordar dentro de qué carpeta estabas (para volver ahí tras recargar)
  useEffect(() => {
    if (!currentUser) return;
    try {
      localStorage.setItem(folderViewKey, activeFolderView?.id || '');
    } catch {}
  }, [activeFolderView, currentUser, folderViewKey]);

  const saveFolders = (updatedList) => {
    setFolders(updatedList);
    localStorage.setItem(
      folderStorageKey(currentUser),
      JSON.stringify(updatedList),
    );
  };

  // Plan del usuario: pro/school son premium (sin límites)
  const isPremiumUser =
    currentUser?.plan === 'pro' || currentUser?.plan === 'school';
  const FREE_FOLDER_LIMIT = 1;

  // Crear nueva carpeta
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    // Límite del plan gratis: 1 carpeta (el backend también lo exige con 402)
    if (!isPremiumUser && folders.length >= FREE_FOLDER_LIMIT) {
      if (onUpgradeToPro) onUpgradeToPro();
      return;
    }

    const folderItem = {
      id: `folder_${Date.now()}`,
      name: newFolderName.trim(),
      description: newFolderDesc.trim() || t('folders.def_desc'),
      created_at: new Date().toLocaleDateString({ es: 'es-ES', en: 'en-US', pt: 'pt-BR' }[i18n.language?.split('-')[0]] || 'es-ES', { day: '2-digit', month: 'short' }),
      user_id: currentUser?.id || null,
      documents: [],
      games: []
    };

    try {
      const res = await fetchWithAuth('/api/v1/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderItem.name,
          description: folderItem.description,
          user_id: currentUser?.id
        })
      });
      if (res.ok) {
        const savedDoc = await res.json();
        folderItem.id = savedDoc.id || folderItem.id;
      } else if (res.status === 402) {
        // Límite del plan alcanzado: no guardar local y ofrecer Pro
        if (onUpgradeToPro) onUpgradeToPro();
        return;
      }
    } catch (err) {
      console.warn("MongoDB no respondió, guardando en local storage privado:", err);
    }

    const updated = [folderItem, ...folders];
    saveFolders(updated);
    track("folder_created", { folder: folderItem.id });
    setNewFolderName('');
    setNewFolderDesc('');
    setIsCreating(false);
    // Abrir directamente la carpeta creada
    setActiveFolderView(folderItem);
  };

  // Estado de los modales de confirmación y edición
  const [confirmState, setConfirmState] = useState(null); // {type:'delete', folder} | {type:'save'}
  const [editingFolder, setEditingFolder] = useState(null); // {id, name, description}
  const [savingEdit, setSavingEdit] = useState(false);

  // Eliminar carpeta (solo se invoca tras confirmar en el modal)
  const handleDeleteFolder = async (folderId) => {
    const updated = folders.filter(f => f.id !== folderId);
    saveFolders(updated);
    if (activeFolderView?.id === folderId) {
      setActiveFolderView(null);
    }
    try {
      await fetchWithAuth(`/api/v1/folders/${folderId}`, { method: 'DELETE' });
    } catch {}
  };

  // Guardar edición de nombre/descripción (tras confirmar en el modal)
  const handleUpdateFolder = async () => {
    if (!editingFolder) return;
    const { id, name, description } = editingFolder;
    setSavingEdit(true);
    const applyLocal = () => {
      const updated = folders.map(f =>
        f.id === id ? { ...f, name, description } : f
      );
      saveFolders(updated);
      if (activeFolderView?.id === id) {
        setActiveFolderView(prev => ({ ...prev, name, description }));
      }
    };
    applyLocal();
    try {
      await fetchWithAuth(`/api/v1/folders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, description }),
      });
    } catch {}
    setSavingEdit(false);
    setEditingFolder(null);
  };

  // Ejecuta la acción pendiente tras confirmar en el modal
  const handleConfirmAction = async () => {
    if (!confirmState) return;
    const action = confirmState;
    setConfirmState(null);
    if (action.type === 'delete') {
      await handleDeleteFolder(action.folder.id);
    } else if (action.type === 'deleteDoc') {
      await handleDeleteDoc(action.doc.id || action.doc.name);
    } else if (action.type === 'save') {
      await handleUpdateFolder();
    }
  };

  // Sincronizar activeFolderView automáticamente cuando folders cambie desde el backend
  useEffect(() => {
    if (activeFolderView && folders.length > 0) {
      const match = folders.find(f => f.id === activeFolderView.id);
      if (match) {
        setActiveFolderView(prev => {
          const uploadingDocs = (prev?.documents || []).filter(d => d.isUploading);
          const serverDocs = (match.documents || []).map(d => ({ ...d, isUploading: false }));
          const cleanDocs = [
            ...uploadingDocs,
            ...serverDocs.filter(sd => !uploadingDocs.some(ud => ud.name === sd.name))
          ];
          return {
            ...match,
            documents: cleanDocs
          };
        });
      }
    }
    // Solo reacciona a cambios de `folders`; incluir activeFolderView crearía un bucle.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [folders]);

  // Sube UN archivo con progreso real vía XHR. Errores quedan en
  // `uploadErrors` como {name, message, file} para reintento individual.
  const uploadOne = async (file, folderId) => {
    const updateTempDoc = (docId, patch) =>
      setActiveFolderView(prev => ({
        ...prev,
        documents: (prev.documents || []).map(d =>
          d.id === docId ? { ...d, ...patch } : d
        ),
      }));
    const removeTempDoc = (docId) =>
      setActiveFolderView(prev => ({
        ...prev,
        documents: (prev.documents || []).filter(d => d.id !== docId),
      }));

    const tempDoc = {
      id: `uploading_${Date.now()}_${file.name}`,
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      type: file.name.split('.').pop().toLowerCase(),
      uploaded_at: t('folders.upload_start'),
      isUploading: true,
      progress: 0,
    };
    setActiveFolderView(prev => ({
      ...prev,
      documents: [tempDoc, ...(prev.documents || []).filter(d => d.name !== file.name)],
    }));

    const formData = new FormData();
    formData.append('file', file);
    try {
      const uploaded = await uploadWithProgress(
        `/api/v1/folders/${folderId}/upload-document`,
        formData,
        {
          onProgress: (p) =>
            updateTempDoc(tempDoc.id, {
              progress: p,
              uploaded_at: p < 100 ? t('folders.uploading_p', { pct: p }) : t('folders.extracting'),
            }),
        },
      );
      updateTempDoc(tempDoc.id, {
        uploaded_at: t('folders.processed'),
        isUploading: false,
        progress: 100,
        prompt_injection_detected: Boolean(uploaded?.prompt_injection_detected),
        prompt_injection_fragments: uploaded?.prompt_injection_fragments || [],
        virustotal_status: uploaded?.virustotal_status || '',
        virustotal_malicious: uploaded?.virustotal_malicious || 0,
      });
      track("doc_uploaded", { folder: folderId });
    } catch (upErr) {
      removeTempDoc(tempDoc.id);
      if (upErr.status === 402) {
        if (onUpgradeToPro) onUpgradeToPro();
        else {
          setUploadErrors(prev => [
            ...prev,
            { name: file.name, message: upErr.message || t('folders.err_limit'), file },
          ]);
        }
        return;
      }
      const friendly =
        upErr.status === 413
          ? t('folders.err_413')
          : upErr.status === 415
            ? t('folders.err_415')
            : upErr.status === 422
              ? t('folders.err_422')
              : upErr.message || t('folders.err_generic');
      setUploadErrors(prev => [...prev, { name: file.name, message: friendly, file }]);
    }
  };

  // Reintentar una subida fallida sin obligar al usuario a re-seleccionar.
  const retryUpload = async (idx) => {
    const entry = uploadErrors[idx];
    if (!entry?.file || !activeFolderView) return;
    setUploadErrors(prev => prev.filter((_, i) => i !== idx));
    await uploadOne(entry.file, activeFolderView.id);
    const refreshRes = await fetchWithAuth('/api/v1/folders').catch(() => null);
    if (refreshRes?.ok) {
      const data = await refreshRes.json();
      if (data?.folders) setFolders(mergeSavedFolders(data.folders, userStorageKey));
    }
  };

  // Subir documentos REALES a la carpeta actualmente abierta.
  // Subida paralela acotada (3 a la vez) con progreso real por archivo vía XHR.
  // El límite freemium lo impone el backend (402 → modal de upgrade).
  const handleUploadFilesToFolder = async (e) => {
    let files = Array.from(e.target.files || []);
    if (!files.length || !activeFolderView) return;
    // Las materias de colegio son de solo lectura para estudiantes
    if (activeFolderView.is_school_folder && activeFolderView.user_id !== currentUser?.id) return;
    e.target.value = '';
    setUploadErrors([]);
    const folderId = activeFolderView.id;

    // Pre-check de cuota de almacenamiento (el backend vuelve a validar con 402):
    // solo se sube lo que quepa; lo que exceda queda listado en uploadErrors.
    if (storageInfo.limit_mb != null && !activeFolderView.is_school_folder) {
      const limitBytes = storageInfo.limit_mb * 1048576;
      let acc = storageInfo.used_mb * 1048576;
      const fits = [];
      const skipped = [];
      for (const f of files) {
        if (acc + f.size <= limitBytes) {
          fits.push(f);
          acc += f.size;
        } else {
          skipped.push(f);
        }
      }
      if (skipped.length) {
        setUploadErrors(
          skipped.map(f => ({
            name: f.name,
            message: t('folders.err_quota', { mb: storageInfo.limit_mb }),
          })),
        );
      }
      if (!fits.length) {
        if (onUpgradeToPro) onUpgradeToPro();
        return;
      }
      files = fits;
    }

    const CONCURRENCY = 3;
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      await Promise.all(files.slice(i, i + CONCURRENCY).map(f => uploadOne(f, folderId)));
    }

    // Refrescar la lista una sola vez al final del lote (no por archivo)
    const refreshRes = await fetchWithAuth('/api/v1/folders').catch(() => null);
    if (refreshRes && refreshRes.ok) {
      const data = await refreshRes.json();
      if (data && data.folders) {
        const merged = mergeSavedFolders(data.folders, folderStorageKey(currentUser));
        setFolders(merged);
        localStorage.setItem(
          folderStorageKey(currentUser),
          JSON.stringify(merged),
        );
        setStorageInfo({
          used_mb: data.storage_used_mb ?? 0,
          limit_mb: data.storage_limit_mb ?? null,
        });
        const currentFolder = data.folders.find(f => f.id === folderId);
        if (currentFolder) {
          setActiveFolderView(prev => {
            if (!prev || prev.id !== folderId) return prev;
            const stillUploading = (prev.documents || []).filter(d => d.isUploading);
            return {
              ...currentFolder,
              documents: [
                ...stillUploading,
                ...(currentFolder.documents || []).map(d => ({ ...d, isUploading: false })),
              ],
            };
          });
          // Tras la subida el backend detecta temas en background — anunciar
          // que la isla se está generando y sondear hasta que aparezca.
          if (
            !(currentFolder.islands || []).length &&
            (currentFolder.documents || []).length > 0
          ) {
            startIslandGenPoll(folderId);
          }
        }
      }
    }
  };


  // Eliminar documento de la carpeta (Frontend y Backend MongoDB)
  const handleDeleteDoc = async (docIdentifier) => {
    if (!activeFolderView || !docIdentifier) return;
    // Las materias de colegio son de solo lectura para estudiantes
    if (activeFolderView.is_school_folder && activeFolderView.user_id !== currentUser?.id) return;

    // 1. Optimistic update inmediato en la interfaz
    const updatedDocs = (activeFolderView.documents || []).filter(
      d => d.id !== docIdentifier && d.name !== docIdentifier
    );
    const updatedFolder = {
      ...activeFolderView,
      documents: updatedDocs
    };
    setActiveFolderView(updatedFolder);
    const updatedFolders = folders.map(f => f.id === updatedFolder.id ? updatedFolder : f);
    saveFolders(updatedFolders);

    // 2. Eliminar del backend MongoDB y limpiar la caché de juego de la carpeta
    try {
      await fetchWithAuth(`/api/v1/folders/${activeFolderView.id}/documents/${encodeURIComponent(docIdentifier)}`, {
        method: 'DELETE'
      });

      // 3. Re-sincronizar con el backend
      const res = await fetchWithAuth('/api/v1/folders');
      if (res.ok) {
        const data = await res.json();
        if (data && data.folders) {
          const merged = mergeSavedFolders(data.folders, folderStorageKey(currentUser));
          setFolders(merged);
          localStorage.setItem(
            folderStorageKey(currentUser),
            JSON.stringify(merged),
          );
          const current = data.folders.find(f => f.id === activeFolderView.id);
          if (current) {
            setActiveFolderView({
              ...current,
              documents: (current.documents || []).map(d => ({ ...d, isUploading: false }))
            });
          }
        }
      }
    } catch (err) {
      console.warn('Error eliminando documento del servidor:', err);
    }
  };


  // Recargar islas: fuerza la re-detección de temas en el backend — las
  // islas se reconstruyen y las preguntas viejas se invalidan.
  const handleRegenerateIslands = async () => {
    if (!activeFolderView || regeneratingIslands) return;
    setRegeneratingIslands(true);
    try {
      const r = await fetchWithAuth(
        `/api/v1/folders/${activeFolderView.id}/detect-topics?force=true`,
        { method: 'POST' },
      );
      if (r.ok) {
        const d = await r.json();
        if (d?.islands) applyIslands(activeFolderView.id, d.islands);
      }
    } catch {} finally {
      setRegeneratingIslands(false);
    }
  };

  // Recargar preguntas de UNA isla: invalida sus tableros cacheados — la
  // próxima partida genera reactivos nuevos sobre el mismo tema. El progreso
  // (estrellas/XP) se conserva.
  const handleRegenerateIsland = async (e, islandId) => {
    e.stopPropagation();
    if (!activeFolderView || regeneratingIslandId) return;
    setRegeneratingIslandId(islandId);
    try {
      const r = await fetchWithAuth(
        `/api/v1/folders/${activeFolderView.id}/islands/${islandId}/regenerate`,
        { method: 'POST' },
      );
      if (r.ok) {
        const prefix = `${islandId}__`;
        const stripBoards = (f) => {
          if (!f?.cached_boards) return f;
          const boards = Object.fromEntries(
            Object.entries(f.cached_boards).filter(([k]) => !k.startsWith(prefix)),
          );
          const out = { ...f, cached_boards: boards };
          if ((f.cached_board_key || '').startsWith(prefix)) {
            delete out.cached_board;
            delete out.cached_board_key;
          }
          return out;
        };
        const updated = folders.map((f) =>
          f.id === activeFolderView.id ? stripBoards(f) : f,
        );
        saveFolders(updated);
        setActiveFolderView((prev) => (prev ? stripBoards(prev) : prev));
      }
    } catch {} finally {
      setRegeneratingIslandId(null);
    }
  };

  // Iniciar el juego: AQUÍ se crean las islas del archipiélago. La carpeta
  // solo muestra documentos; al pulsar Iniciar se detectan temas y se
  // muestran todas las islas para elegir campaña (o jugar mezclado).
  const handlePlayDirectly = async () => {
    if (!activeFolderView || isProcessingGame || detectingTopics) return;

    // 1. Islas ya existentes (campañas previas) → mostrarlas directo
    let islands = activeFolderView.islands || [];

    // 2. Sin islas todavía → detectar temas ahora (idempotente en el backend)
    const readyDocs = (activeFolderView.documents || []).filter(d => !d.isUploading);
    if (!islands.length && readyDocs.length > 0) {
      setDetectingTopics(true);
      try {
        const r = await fetchWithAuth(
          `/api/v1/folders/${activeFolderView.id}/detect-topics`,
          { method: 'POST' },
        );
        if (r.ok) {
          const d = await r.json();
          if (d?.islands?.length) {
            islands = d.islands;
            applyIslands(activeFolderView.id, d.islands);
          }
        }
      } catch {} finally {
        setDetectingTopics(false);
      }
    }

    // 3. Hay islas → el jugador elige su campaña
    if (islands.length > 0) {
      setShowIslandPicker(true);
      return;
    }

    // 4. Sin temas detectados → campaña general (contenido mezclado)
    const isAlreadyAnalyzed = Boolean(
      activeFolderView.cached_boards ||
      activeFolderView.cached_board
    );

    if (isAlreadyAnalyzed) {
      onSelectFolder({
        ...activeFolderView,
        playDirectly: true
      });
      return;
    }

    setIsProcessingGame(true);
    setProcessingCountdown(3);

    let secondsLeft = 3;
    if (processingTimerRef.current) clearInterval(processingTimerRef.current);

    processingTimerRef.current = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft > 0) {
        setProcessingCountdown(secondsLeft);
      } else {
        clearInterval(processingTimerRef.current);
        processingTimerRef.current = null;
        setIsProcessingGame(false);
        onSelectFolder({
          ...activeFolderView,
          playDirectly: true
        });
      }
    }, 1000);
  };


  // REPASO SUGERIDO: la isla con peor promedio de estrellas (proxy de
  // "donde más fallaste") se etiqueta "repasar". Solo islas ya jugadas
  // y con media < 3★ — repaso suave, nunca un reproche.
  const reviewIslandId = (() => {
    let worstId = null;
    let worstAvg = Infinity;
    for (const isl of activeFolderView?.islands || []) {
      const p = isl.campaign_progress || {};
      const vals = Object.values(p.level_stars || {}).filter(
        (v) => typeof v === 'number',
      );
      const played = (p.unlocked_level || 1) > 1 || vals.some((v) => v > 0);
      if (!vals.length || !played) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (avg < worstAvg) {
        worstAvg = avg;
        worstId = isl.id;
      }
    }
    return worstAvg < 3 ? worstId : null;
  })();

  const getDocIcon = (filename = '') => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return <FileText className="w-5 h-5 text-rose-400" />;
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    if (['mp3', 'wav', 'm4a'].includes(ext)) return <FileAudio className="w-5 h-5 text-amber-400" />;
    return <FileText className="w-5 h-5 text-cyan-400" />;
  };

  if (!isOpen) return null;

  return (
    <div
      className="folder-modal-wrap fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-2 md:p-4 bg-black/85 backdrop-blur-md select-none font-sans"
      role="dialog"
      aria-modal="true"
      aria-label={t('folders.aria')}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="folder-modal-panel relative w-full h-full max-w-7xl max-h-[96dvh] rounded-arcade sm:rounded-arcade-xl bg-[#f1f6fd] border-4 border-[var(--color-arcade-navy-dark)] shadow-[0_16px_0_var(--color-arcade-ink),0_25px_60px_rgba(0,0,0,0.8)] flex flex-col text-slate-800 overflow-hidden"
      >
        {/* INPUT OCULTO PARA SUBIR ARCHIVOS DIRECTO A LA CARPETA */}
        <input 
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.mp3,.wav,.m4a"
          className="hidden"
          onChange={handleUploadFilesToFolder}
        />

        {/* ============================================================ */}
        {/* VISTA 1: LISTADO GENERAL DE CARPETAS DE AVENTURA             */}
        {/* ============================================================ */}
        {!activeFolderView && (
          <>
            {/* Cabecera Estilo Taberna / Inventario de Videojuego */}
            <div className="p-3 sm:p-6 border-b-arcade-sm border-[#bfd2ea] bg-[#e2ecf9] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-arcade bg-[var(--color-arcade-yellow)] border-3 border-[var(--color-arcade-navy)] flex items-center justify-center text-[var(--color-arcade-navy)] shadow-btn-yellow">
                  <FolderArchive className="w-8 h-8 text-[var(--color-arcade-navy)]" />
                </div>
                <div>

                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-800 mt-1">
                    {t('folders.title')}
                  </h2>
                  <p className="text-xs text-slate-600 font-bold">
                    {t('folders.subtitle', { user: currentUser?.username || t('folders.your_account') })}
                  </p>

                </div>
              </div>

              <div className="flex items-center gap-2">
                {onBackToMenu && (
                  <button
                    onClick={onBackToMenu}
                    className="px-3.5 py-2.5 rounded-arcade bg-[var(--color-arcade-navy-dark)] hover:bg-[var(--color-arcade-navy-hover)] border-2 border-[var(--color-arcade-navy-light)] border-b-arcade border-b-[var(--color-arcade-ink)] text-[var(--color-arcade-yellow)] font-black text-xs uppercase tracking-wide flex items-center gap-1.5 shadow-btn-arcade active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                    title={t('folders.menu_t')}
                  >
                    <Home className="w-4 h-4 stroke-[2.5]" />
                    <span className="hidden sm:inline">{t('folders.menu')}</span>
                  </button>
                )}

                <button
                  onClick={() => setIsCreating(true)}
                  className="px-4 py-2.5 rounded-arcade bg-[var(--color-arcade-orange)] hover:bg-[var(--color-arcade-orange-bright)] border-2 border-[var(--color-arcade-orange-light)] border-b-arcade border-b-[var(--color-arcade-orange-shadow)] text-white font-black text-xs uppercase tracking-wide flex items-center gap-2 shadow-btn-arcade active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span className="hidden sm:inline">{t('folders.new_folder')}</span>
                </button>

                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-2.5 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-2 border-[var(--color-arcade-navy-light)] border-b-arcade border-b-[var(--color-arcade-ink)] text-slate-300 hover:text-white transition-all cursor-pointer shadow-btn-arcade active:translate-y-1 active:shadow-none"
                    title={t('folders.close_t')}
                  >
                    <X className="w-5 h-5 stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>

            {/* Contenido Principal con Tablero de Carpetas */}
            <div className="p-3 sm:p-6 flex-1 overflow-y-auto space-y-4 bg-[#eaf1fb]">
              
              {/* Formulario de Creación de Carpeta */}
              <AnimatePresence>
                {isCreating && (
                  <motion.form
                    initial={{ opacity: 0, scale: 0.95, height: 0 }}
                    animate={{ opacity: 1, scale: 1, height: 'auto' }}
                    exit={{ opacity: 0, scale: 0.95, height: 0 }}
                    onSubmit={handleCreateFolder}
                    className="overflow-hidden bg-white border-2 border-amber-400/60 rounded-arcade-lg p-5 shadow-xl mb-4 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-600 flex items-center gap-2">
                        <FolderPlus className="w-5 h-5 text-amber-500" />
                        {t('folders.create_title')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCreating(false)}
                        className="text-xs font-bold text-slate-600 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        {t('folders.cancel')}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder={t('folders.name_ph')}
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        className="bg-white border-2 border-slate-300 focus:border-amber-400 rounded-arcade-sm px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none transition-colors"
                      />
                      <input
                        type="text"
                        placeholder={t('folders.desc_ph')}
                        value={newFolderDesc}
                        onChange={(e) => setNewFolderDesc(e.target.value)}
                        className="bg-white border-2 border-slate-300 focus:border-amber-400 rounded-arcade-sm px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none transition-colors"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-arcade-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-btn-emerald active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>{t('folders.save_enter')}</span>
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Onboarding guiado: solo cuando el usuario aún no tiene
                  carpetas propias. */}
              {folders.length === 0 && (
                <div className="rounded-arcade-lg border-2 border-cyan-300 bg-gradient-to-r from-white to-sky-50 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider text-cyan-700 mb-1.5">
                      {t('folders.steps_title')}
                    </p>
                    <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-slate-600">
                      <li className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-cyan-50 border border-cyan-300 text-cyan-700 text-[10px] font-black inline-flex items-center justify-center">1</span>
                        {t('folders.step1')}
                      </li>
                      <li className="text-slate-500">→</li>
                      <li className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-cyan-50 border border-cyan-300 text-cyan-700 text-[10px] font-black inline-flex items-center justify-center">2</span>
                        {t('folders.step2')}
                      </li>
                      <li className="text-slate-500">→</li>
                      <li className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 text-[10px] font-black inline-flex items-center justify-center">3</span>
                        {t('folders.step3')}
                      </li>
                    </ol>
                  </div>
                  <button
                    onClick={() => setIsCreating(true)}
                    className="shrink-0 px-4 py-2.5 rounded-arcade bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wide flex items-center gap-2 shadow-btn-emerald active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4 stroke-[2.5]" />
                    <span>{t('folders.create_mine')}</span>
                  </button>
                </div>
              )}

              {/* Listado de Carpetas */}
              {folders.length === 0 ? (
                <div className="py-12 px-4 rounded-arcade-lg border-2 border-dashed border-slate-300 bg-white/70 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-arcade-lg bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
                    <Folder className="w-8 h-8 opacity-60 text-amber-500" />
                  </div>
                  <h3 className="text-base font-bold text-slate-700">
                    {t('folders.empty_t')}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm mb-4">
                    {t('folders.empty_p')}
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <button
                      onClick={() => setIsCreating(true)}
                      className="px-5 py-2.5 rounded-arcade bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wide flex items-center gap-2 shadow-[0_4px_0_#92400e] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>{t('folders.create_first')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                  {folders.map((folder) => {
                    const docsCount = folder.documents?.length || 0;
                    const gamesCount = folder.games?.length || 0;
                    const prog = folder.campaign_progress;
                    const progLevel = prog?.unlocked_level || 1;
                    const progStars = prog?.level_stars
                      ? Object.values(prog.level_stars).reduce((a, b) => a + b, 0)
                      : 0;

                    return (
                      <div
                        key={folder.id}
                        onClick={() => {
                          setActiveFolderView(folder);
                          setShowIslandPicker(false);
                          fetchWithAuth('/api/v1/folders')
                            .then(r => r.ok ? r.json() : null)
                            .then(data => {
                              if (data?.folders) {
                                setFolders(data.folders);
                              }
                            }).catch(() => {});
                        }}
                        className="relative p-5 rounded-arcade-lg border-2 border-slate-300 hover:border-amber-400 bg-white hover:bg-sky-50 transition-all cursor-pointer flex flex-col justify-between group shadow-md hover:scale-[1.01]"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-arcade flex items-center justify-center bg-amber-50 text-amber-500 border border-amber-300 shadow-inner group-hover:bg-amber-400 group-hover:text-slate-950 transition-all">
                                <Folder className="w-6 h-6 fill-current opacity-90" />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase truncate max-w-[170px]">
                                  {folder.name}
                                </h4>
                                <span className="text-[11px] text-slate-600 font-medium">
                                  {folder.created_at ? t('folders.created_on', { date: formatDate(folder.created_at) }) : t('folders.active_mission')}
                                </span>
                                {folder.is_school_folder && (
                                  <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-300 text-[9px] font-black text-emerald-700 uppercase tracking-wide align-middle">
                                    <School className="w-2.5 h-2.5" /> {t('folders.school')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Solo el dueño (docente) puede borrar la carpeta;
                                estudiantes ven la materia como solo-lectura. */}
                            {(!folder.is_school_folder || folder.user_id === currentUser?.id) && (
                              <span className="flex items-center gap-0.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingFolder({
                                      id: folder.id,
                                      name: folder.name,
                                      description: folder.description || '',
                                    });
                                  }}
                                  className="p-2 text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 rounded-arcade-sm transition-colors opacity-70 hover:opacity-100 cursor-pointer"
                                  title={t('folders.edit_t')}
                                  aria-label={t('folders.edit_aria', { name: folder.name })}
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmState({ type: 'delete', folder });
                                  }}
                                  className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-arcade-sm transition-colors opacity-70 hover:opacity-100 cursor-pointer"
                                  title={t('folders.delete_t')}
                                  aria-label={t('folders.delete_aria', { name: folder.name })}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </span>
                            )}
                          </div>

                          {/* Tarea asignada por el docente (badge informativo, sin presión) */}
                          {folder.assignment && (
                            <div className="mb-2 px-2.5 py-1.5 rounded-arcade-sm bg-amber-50 border border-amber-300 text-[10px] font-bold text-amber-700 flex items-center gap-1.5">
                              <Pin className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {folder.assignment.title}
                                {folder.assignment.due_date && t('folders.due', { date: folder.assignment.due_date })}
                              </span>
                            </div>
                          )}

                          <p className="text-xs text-slate-600 line-clamp-2 mt-1 pl-1">
                            {folder.description}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 text-xs">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-amber-700 min-w-0">
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <FileText className="w-3.5 h-3.5 text-amber-500" />
                              {docsCount} {docsCount === 1 ? t('folders.file_one') : t('folders.file_many')}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="flex items-center gap-1 text-cyan-700 whitespace-nowrap">
                              <Layers className="w-3.5 h-3.5 text-cyan-500" />
                              {t('folders.games_n', { count: gamesCount })}
                            </span>
                            {progLevel > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectFolder({
                                    ...folder,
                                    playDirectly: true,
                                  });
                                }}
                                className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
                                title={t('folders.cont_t', { level: progLevel })}
                              >
                                <PlayCircle className="w-3.5 h-3.5 text-emerald-500" />
                                {t('folders.level_n', { level: progLevel })} · <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{progStars}
                                {prog?.total_xp > 0 && ` · ${prog.total_xp} XP`}
                              </button>
                            )}
                          </span>

                          <span className="flex items-center gap-1 font-bold text-slate-600 group-hover:text-amber-600 transition-colors ml-auto whitespace-nowrap">
                            <span>{t('folders.enter')}</span>
                            <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pie informativo */}
            <div className="p-5 border-t-2 border-slate-200 bg-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span>{t('folders.hint_footer')}</span>
              </span>
              <span className="font-bold text-slate-700">
                {isPremiumUser
                  ? `${t('folders.total_pro', { count: folders.length })}${storageInfo.limit_mb != null ? ` · ${storageInfo.used_mb.toFixed(1)}/${storageInfo.limit_mb} MB` : ''}`
                  : `${t('folders.total_free', { count: folders.length, limit: FREE_FOLDER_LIMIT })}${storageInfo.limit_mb != null ? ` · ${storageInfo.used_mb.toFixed(1)}/${storageInfo.limit_mb} MB` : ''}`}
              </span>
            </div>
          </>
        )}


        {/* ============================================================ */}
        {/* VISTA 2: DENTRO DE UNA CARPETA (DOCUMENTOS + SUBIR + JUGAR)  */}
        {/* ============================================================ */}
        {activeFolderView && (
          <>
            {/* Cabecera Interior de la Carpeta */}
            <div className="p-3 sm:p-6 border-b-arcade-sm border-[#bfd2ea] bg-[#e2ecf9] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setActiveFolderView(null); setShowIslandPicker(false); }}
                  className="p-2.5 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-2 border-[var(--color-arcade-navy-light)] border-b-arcade border-b-[var(--color-arcade-ink)] text-white transition-all cursor-pointer flex items-center justify-center shadow-md active:translate-y-1 active:shadow-none"
                  title={t('folders.back_trunk')}
                >
                  <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[var(--color-arcade-orange)] text-white border-2 border-[var(--color-arcade-orange-shadow)]">
                      {t('folders.open_badge')}
                    </span>
                    <span className="text-xs text-slate-600 font-bold">
                      {t('folders.files_n', { count: activeFolderView.documents?.length || 0 })}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-800 mt-0.5">
                    {activeFolderView.name}
                  </h2>
                </div>
              </div>

              {/* Botón para Subir Más Archivos — oculto a estudiantes en carpetas de colegio
                  y cuando el archipiélago está visible (ahí solo se elige isla) */}
              {!showIslandPicker && (!activeFolderView.is_school_folder || activeFolderView.user_id === currentUser?.id) && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-arcade bg-[var(--color-arcade-orange)] hover:bg-[var(--color-arcade-orange-bright)] border-2 border-[var(--color-arcade-orange-light)] border-b-arcade border-b-[var(--color-arcade-orange-shadow)] text-white font-black text-xs uppercase tracking-wide flex items-center gap-2 shadow-btn-arcade active:translate-y-1 active:shadow-none transition-all cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-white stroke-[2.8]" />
                <span className="drop-shadow-sm">{t('folders.upload_more')}</span>
              </button>
              )}
            </div>

            {/* Listado de Documentos de la Carpeta */}
            <div className="p-3 sm:p-6 flex-1 overflow-y-auto space-y-4 bg-[#eaf1fb]">
              {/* "Tu isla se está generando" — detección de temas en curso
                  tras la subida; desaparece solo cuando el archipiélago
                  llega vía sondeo a /folders (o tras ~75s). */}
              {islandGenPending && (
                <div className="rounded-arcade border-2 border-cyan-200 bg-cyan-50/90 p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-cyan-600 animate-spin shrink-0" />
                    <p className="text-xs font-black uppercase tracking-wider text-cyan-700">
                      {t('folders.island_gen')}
                    </p>
                  </div>
                  <div className="w-full h-2 rounded-full bg-cyan-100 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-cyan-400"
                      initial={{ width: '5%' }}
                      animate={{ width: '92%' }}
                      transition={{ duration: 45, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-[11px] text-cyan-700/80 font-semibold">
{t('folders.island_gen_d')}
                  </p>
                </div>
              )}

              {/* ======= ARCHIPIÉLAGO DE ISLAS (un tema = una campaña) =======
                  Solo se revela al pulsar "Iniciar juego": ahí se crean las
                  islas y el jugador elige su campaña. */}
              {showIslandPicker && (activeFolderView.islands || []).length > 0 && (
                <div className="rounded-arcade-lg border-2 border-sky-200 bg-gradient-to-b from-white to-sky-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-cyan-500" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-cyan-700">
                      {t('folders.archipelago')}
                    </h3>
                    {detectingTopics && (
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {t('folders.detecting')}
                      </span>
                    )}
                    <button
                      onClick={handleRegenerateIslands}
                      disabled={regeneratingIslands}
                      className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 text-[10px] font-black uppercase tracking-wide text-cyan-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                      title={t('folders.reload_islands_t')}
                    >
                      <RotateCw className={`w-3 h-3 ${regeneratingIslands ? 'animate-spin' : ''}`} />
                      {regeneratingIslands ? t('folders.reloading') : t('folders.reload_islands')}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 mb-3">
                    {t('folders.arch_d')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {(activeFolderView.islands || []).map((isl, islIdx) => {
                      const p = isl.campaign_progress || {};
                      const style = ISLAND_STYLES[islIdx % ISLAND_STYLES.length];
                      const IslIcon = resolveDynamicIcon({
                        label: isl.name,
                        theme: activeFolderView.name,
                        index: islIdx,
                      });
                      const stars = Object.values(p.level_stars || {}).reduce((a, b) => a + b, 0);
                      const lvl = p.current_level || p.unlocked_level || 1;
                      return (
                        <div
                          key={isl.id}
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            onSelectFolder({
                              ...activeFolderView,
                              playDirectly: true,
                              selectedIsland: isl,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectFolder({
                                ...activeFolderView,
                                playDirectly: true,
                                selectedIsland: isl,
                              });
                            }
                          }}
                          className={`group text-left rounded-arcade border-2 border-slate-300 ${style.ring} bg-white hover:bg-sky-50 p-4 transition-all cursor-pointer shadow-[0_3px_0_#cbd5e1] active:translate-y-0.5 active:shadow-none`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className={`w-11 h-11 rounded-arcade-sm bg-gradient-to-br border flex items-center justify-center shrink-0 shadow-inner transition-transform group-hover:scale-110 ${style.blob}`}>
                              <IslIcon className={`w-5 h-5 ${style.icon}`} />
                            </span>
                            <span className="flex items-center gap-1.5">
                              {/* Recargar preguntas de esta isla */}
                              <button
                                onClick={(e) => handleRegenerateIsland(e, isl.id)}
                                disabled={Boolean(regeneratingIslandId)}
                                className="p-1 rounded-lg text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                                title={t('folders.reload_q_t', { name: isl.name })}
                                aria-label={t('folders.reload_q_aria', { name: isl.name })}
                              >
                                <RotateCw
                                  className={`w-3.5 h-3.5 ${regeneratingIslandId === isl.id ? 'animate-spin text-cyan-600' : ''}`}
                                />
                              </button>
                              {/* Tarea del docente dirigida a esta isla */}
                              {activeFolderView.assignment?.island_id === isl.id && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300"
                                  title={activeFolderView.assignment.title}
                                >
                                  <Pin className="w-2.5 h-2.5" /> {t('folders.homework')}
                                </span>
                              )}
                              {/* Repaso sugerido: la isla donde más te costó */}
                              {isl.id === reviewIslandId && (
                                <span
                                  className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 animate-pulse"
                                  title={t('folders.review_t')}
                                >
                                  {t('folders.review')}
                                </span>
                              )}
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${style.badge}`}>
                                {t('folders.levels_n', { count: isl.total_levels })}
                              </span>
                            </span>
                          </div>
                          <h4 className="mt-2 font-black text-slate-800 text-sm leading-tight line-clamp-2">
                            {isl.name}
                          </h4>
                          <div className="mt-2 flex items-center justify-between text-[11px] font-bold">
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              {stars > 0 ? (<><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {stars}</>) : t('folders.unexplored')}
                              {p.total_xp > 0 && <span className="text-slate-500"> · {p.total_xp} XP</span>}
                            </span>
                            <span className="flex items-center gap-1 text-emerald-600 group-hover:text-emerald-700">
                              <PlayCircle className="w-3.5 h-3.5" />
                              {lvl > 1 || stars > 0 ? t('folders.cont_n', { level: lvl }) : t('folders.play')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(activeFolderView.islands || []).length > 0 && (
                    <button
                      onClick={() =>
                        onSelectFolder({
                          ...activeFolderView,
                          playDirectly: true,
                          selectedIsland: null,
                        })
                      }
                      className="mt-3 w-full text-center text-[11px] font-bold text-slate-600 hover:text-cyan-700 py-1.5 rounded-arcade-sm border border-dashed border-slate-300 hover:border-cyan-400 transition-colors cursor-pointer"
                    >
                      <Waves className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" />{t('folders.play_mixed')}
                    </button>
                  )}
                </div>
              )}

              {/* La lista de archivos pertenece al paso anterior: se oculta
                  mientras el archipiélago está visible para elegir campaña. */}
              {!showIslandPicker && ((!activeFolderView.documents || activeFolderView.documents.length === 0) ? (
                <div className="py-12 px-4 rounded-arcade-lg border-2 border-dashed border-slate-300 bg-white/70 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-arcade-lg bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
                    <UploadCloud className="w-8 h-8 text-cyan-500" />
                  </div>
                  <h3 className="text-base font-bold text-slate-700">
                    {t('folders.no_docs_t')}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm mb-4">
                    {t('folders.no_docs_p')}
                  </p>
                  {(!activeFolderView.is_school_folder || activeFolderView.user_id === currentUser?.id) && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-5 py-2.5 rounded-arcade bg-[var(--color-arcade-orange)] hover:bg-[var(--color-arcade-orange-bright)] border-2 border-[var(--color-arcade-orange-light)] border-b-arcade border-b-[var(--color-arcade-orange-shadow)] text-white font-black text-xs uppercase tracking-wide flex items-center gap-2 shadow-btn-arcade active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>{t('folders.upload_now')}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const readyCount = (activeFolderView.documents || []).filter(d => !d.isUploading).length;
                    const uploadingCount = (activeFolderView.documents || []).filter(d => d.isUploading).length;
                    return (
                      <div className="flex items-center justify-between text-xs text-slate-600 font-bold uppercase px-1">
                        <span>
                          {uploadingCount > 0 ? (
                            <span className="text-sky-600 flex items-center gap-1.5 normal-case font-bold">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />
                              {t('folders.uploading_n', { count: uploadingCount })}
                            </span>
                          ) : (
                            t('folders.files_in', { count: readyCount })
                          )}
                        </span>
                        {uploadingCount > 0 ? (
                          <span className="text-[11px] text-sky-600 font-medium flex items-center gap-1 normal-case">
                            {t('folders.loading_file')}
                          </span>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t('folders.file_ready')}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Barra de almacenamiento del plan (cuota total de la cuenta) */}
                  {storageInfo.limit_mb != null && !activeFolderView.is_school_folder && (() => {
                    const pct = Math.min(100, (storageInfo.used_mb / storageInfo.limit_mb) * 100);
                    return (
                      <div className="px-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-1">
                          <span className="uppercase tracking-wide">{t('folders.storage_plan')}</span>
                          <span className={pct >= 100 ? 'text-rose-600' : pct >= 80 ? 'text-amber-600' : 'text-slate-600'}>
                            {storageInfo.used_mb.toFixed(1)} / {storageInfo.limit_mb} MB
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {(activeFolderView.documents || []).some((d) => d.prompt_injection_detected) && (
                    <div className="rounded-arcade-sm border border-amber-300 bg-amber-50 px-4 py-3 space-y-2">
                      {(activeFolderView.documents || [])
                        .filter((d) => d.prompt_injection_detected)
                        .map((d) => (
                          <div key={d.id} className="flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-amber-900 leading-snug">
                                {t('folders.injection_notice', { names: d.name })}
                              </p>
                              {(d.prompt_injection_fragments || []).map((fragment) => (
                                <p
                                  key={fragment}
                                  className="mt-1 rounded-md bg-white/80 border border-amber-200 px-2 py-1 font-mono text-[11px] text-amber-950 break-words"
                                >
                                  {t('folders.injection_fragment')}: “{fragment}”
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {uploadErrors.length > 0 && (
                    <div className="rounded-arcade-sm border border-rose-300 bg-rose-50 px-4 py-3 space-y-2">
                      {uploadErrors.map((err, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                          <p className="flex-1 min-w-0 text-[11px] font-semibold text-rose-700">
                            <span className="font-black text-rose-600">{err.name}</span>
                            <span className="text-rose-600/80"> — {err.message}</span>
                          </p>
                          <button
                            onClick={() => retryUpload(i)}
                            className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 border border-rose-300 text-[10px] font-black uppercase tracking-wide text-rose-700 transition-all cursor-pointer"
                          >
                            {t('folders.retry')}
                          </button>
                          <button
                            onClick={() => setUploadErrors(prev => prev.filter((_, j) => j !== i))}
                            className="shrink-0 p-1 text-rose-400 hover:text-rose-600 cursor-pointer"
                            aria-label={t('folders.dismiss_err', { name: err.name })}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {activeFolderView.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className={`p-3.5 rounded-arcade border-2 flex items-center justify-between group transition-all ${
                          doc.isUploading
                            ? 'bg-amber-50 border-amber-300 animate-pulse'
                            : 'bg-white border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-arcade-sm bg-slate-100 border border-slate-300 flex items-center justify-center shrink-0">
                            {doc.isUploading
                              ? <span className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                              : getDocIcon(doc.name)
                            }
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <h5 className="text-xs font-bold text-slate-800 truncate max-w-[170px]">
                                {doc.name}
                              </h5>
                              {doc.is_analyzed && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1" title={t('folders.reusable_t')}>
                                  <Zap className="w-2.5 h-2.5 text-emerald-500" />
                                  {t('folders.reusable')}
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] font-mono ${
                              doc.isUploading ? 'text-sky-600 font-bold' : 'text-slate-600'
                            }`}>
                              {doc.isUploading
                                ? (doc.uploaded_at || t('folders.upload_wait'))
                                : `${formatDocSize(doc.size) || t('folders.loaded')} • ${formatDate(doc.uploaded_at) || t('folders.ready')}`
                              }
                            </span>
                            {!doc.isUploading && doc.virustotal_status && doc.virustotal_status !== 'unavailable' && (
                              <span className={`block text-[10px] font-bold ${
                                doc.virustotal_status === 'malicious' || doc.virustotal_status === 'suspicious'
                                  ? 'text-rose-600'
                                  : doc.virustotal_status === 'clean'
                                    ? 'text-emerald-700'
                                    : 'text-slate-500'
                              }`}>
                                {t(`folders.vt_${doc.virustotal_status}`, { n: doc.virustotal_malicious || 0 })}
                              </span>
                            )}
                          </div>
                        </div>

                        {!doc.isUploading && (!activeFolderView.is_school_folder || activeFolderView.user_id === currentUser?.id) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmState({ type: 'deleteDoc', doc });
                            }}
                            className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-arcade-sm transition-all cursor-pointer border border-transparent hover:border-rose-200"
                            title={t('folders.remove_doc')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Barra Inferior con Opciones de Juego — oculta cuando el archipiélago está visible (ahí se elige isla) */}
            {!showIslandPicker && (
            <div className="p-5 border-t-2 border-slate-200 bg-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                {(() => {
                  if (isProcessingGame) return (
                    <span className="flex items-center gap-2 font-semibold text-emerald-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>{t('folders.gen_progress', { s: processingCountdown })}</span>
                    </span>
                  );
                  const readyDocs = (activeFolderView.documents || []).filter(d => !d.isUploading);
                  const uploadingDocs = (activeFolderView.documents || []).filter(d => d.isUploading);
                  if (uploadingDocs.length > 0) return (
                    <span className="flex items-center gap-2 font-semibold text-sky-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
                      <span>{t('folders.uploading_note')}</span>
                    </span>
                  );
                  if (readyDocs.length > 0) return (
                    <span className="flex items-center gap-2 font-semibold text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span>{t('folders.docs_ready', { count: readyDocs.length })}</span>
                    </span>
                  );
                  return (
                    <span className="text-slate-600">
                      {t('folders.need_doc')}
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {/* Iniciar el juego directamente con los archivos procesados de la carpeta (Estilo Card Clash) */}
                {(() => {
                  const readyCount = (activeFolderView.documents || []).filter(d => !d.isUploading).length;
                  const isDisabled = readyCount === 0 || isProcessingGame || detectingTopics;
                  const isBusy = isProcessingGame || detectingTopics;
                  return (
                    <button
                      disabled={isDisabled}
                      onClick={handlePlayDirectly}
                      className={`w-full sm:w-auto px-7 py-3 rounded-arcade font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 border-3 transition-all ${
                        isDisabled && !isBusy
                          ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed opacity-60'
                          : isBusy
                          ? 'bg-[var(--color-arcade-green)] border-[var(--color-arcade-navy-dark)] text-white shadow-[0_0_20px_rgba(72,200,56,0.6)] cursor-wait font-black'
                          : 'bg-[var(--color-arcade-green)] hover:bg-[#57d847] border-[var(--color-arcade-navy-dark)] border-b-arcade-lg border-b-[var(--color-arcade-green-shadow)] text-white shadow-btn-arcade-lg active:translate-y-1 active:shadow-none cursor-pointer'
                      }`}
                    >
                      {detectingTopics ? (
                        <>
                          <Loader2 className="w-5 h-5 stroke-[2.5] animate-spin text-white" />
                          <span>{t('folders.creating_islands')}</span>
                        </>
                      ) : isProcessingGame ? (
                        <>
                          <Loader2 className="w-5 h-5 stroke-[2.5] animate-spin text-white" />
                          <span>{t('folders.processing', { s: processingCountdown })}</span>
                        </>
                      ) : (
                        <>
                          <Gamepad2 className="w-5 h-5 stroke-[2.5] text-white" />
                          <span>{t('folders.play_btn')}</span>
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>
            )}
          </>
        )}

        {/* ======== MODAL: EDITAR CARPETA (nombre / descripción) ======== */}
        <AnimatePresence>
          {editingFolder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6"
              onClick={() => !savingEdit && setEditingFolder(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 12 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white rounded-arcade-lg border-2 border-cyan-300 p-6 shadow-2xl space-y-4"
              >
                <h3 className="text-base font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-cyan-600" /> {t('folders.edit_title')}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block mb-1">{t('folders.f_name')}</label>
                    <input
                      type="text"
                      value={editingFolder.name}
                      autoFocus
                      onChange={(e) => setEditingFolder(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-white border-2 border-slate-300 focus:border-cyan-400 rounded-arcade-sm px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block mb-1">{t('folders.f_desc')}</label>
                    <input
                      type="text"
                      value={editingFolder.description}
                      onChange={(e) => setEditingFolder(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-white border-2 border-slate-300 focus:border-cyan-400 rounded-arcade-sm px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={() => setEditingFolder(null)}
                    className="px-4 py-2.5 rounded-arcade-sm text-xs font-bold text-slate-600 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    {t('folders.cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={savingEdit || !editingFolder.name.trim()}
                    onClick={() => setConfirmState({ type: 'save' })}
                    className="px-5 py-2.5 rounded-arcade-sm bg-[var(--color-arcade-green)] hover:bg-[#57d847] text-white font-black text-xs uppercase tracking-wider shadow-btn-green active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {t('folders.save_changes')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ======== MODAL: CONFIRMACIÓN (eliminar / guardar) ======== */}
        <AnimatePresence>
          {confirmState && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-6"
              onClick={() => setConfirmState(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 12 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm bg-white rounded-arcade-lg border-2 border-slate-200 p-6 shadow-2xl text-center"
                role="alertdialog"
                aria-modal="true"
              >
                <div className={`w-14 h-14 mx-auto rounded-arcade flex items-center justify-center border-2 mb-3 ${
                  confirmState.type === 'save'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
                    : 'bg-rose-50 border-rose-300 text-rose-500'
                }`}>
                  {confirmState.type === 'save'
                    ? <CheckCircle2 className="w-7 h-7" />
                    : <AlertTriangle className="w-7 h-7" />}
                </div>
                <h3 className="text-base font-black text-slate-800">
                  {confirmState.type === 'save'
                    ? t('folders.confirm_save')
                    : confirmState.type === 'deleteDoc'
                    ? t('folders.confirm_del_doc')
                    : t('folders.confirm_del_folder')}
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {confirmState.type === 'save'
                    ? t('folders.save_body', { name: editingFolder?.name })
                    : confirmState.type === 'deleteDoc'
                    ? t('folders.del_doc_body', { name: confirmState.doc?.name })
                    : t('folders.del_folder_body', { name: confirmState.folder?.name })}
                </p>
                <div className="flex gap-2 mt-5">
                  <button
                    type="button"
                    onClick={() => setConfirmState(null)}
                    className="flex-1 px-4 py-2.5 rounded-arcade-sm text-xs font-bold text-slate-600 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    {t('folders.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAction}
                    className={`flex-1 px-4 py-2.5 rounded-arcade-sm text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer active:translate-y-0.5 ${
                      confirmState.type === 'save'
                        ? 'bg-[var(--color-arcade-green)] hover:bg-[#57d847] shadow-btn-green active:shadow-none'
                        : 'bg-rose-500 hover:bg-rose-400 shadow-[0_4px_0_#9f1239] active:shadow-none'
                    }`}
                  >
                    {confirmState.type === 'save' ? t('folders.yes_save') : t('folders.yes_del')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast: la detección de temas encontró islas nuevas */}
        <AnimatePresence>
          {topicsToast && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 max-w-md w-[92%] sm:w-auto rounded-arcade bg-emerald-50 border-2 border-emerald-300 shadow-[0_8px_30px_rgba(16,185,129,0.25)] px-5 py-4 flex items-start gap-3"
              role="status"
            >
              <Palmtree className="w-6 h-6 text-emerald-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-emerald-700">
{t('folders.topics', { count: topicsToast.count })}
                </p>
                <p className="text-xs text-emerald-600 mt-0.5 truncate">
                  {topicsToast.names.join(' · ')}
                  {topicsToast.count > 3 ? '…' : ''}{t('folders.topics_suf')}
                </p>
              </div>
              <button
                onClick={() => setTopicsToast(null)}
                className="p-1 rounded-lg text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100 cursor-pointer"
                aria-label={t('folders.close_note')}
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}
