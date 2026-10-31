import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Lock,
  Play,
  ArrowLeft,
  Folder,
  HelpCircle,
  Crown,
  Skull,
  Swords,
  RotateCcw,
  Flame,
  X,
} from "lucide-react";
import capyEscolar from "../assets/mascots/capy_escolar_nino_m.webp";
import { useTranslation } from "react-i18next";
import { levelName, levelDesc } from "../utils/gameConfig";

/**
 * AdventureMap - Mapa de Aventura de 20 Niveles
 * - Nivel K = K preguntas progresivas
 * - Niveles 3+ tienen cartas trampa 💀
 * - Nivel 20 es la batalla de Jefe Final contra Hubzi Boss 👑
 * - Requiere mínimo 2 estrellas para avanzar
 * - Scroll vertical fluido que asciende desde el Nivel 1 (costa) hasta el Nivel 20 (cumbre del volcán)
 */
export default function AdventureMap({
  folderName = null,
  documentTitle = null,
  levels = [],
  unlockedLevel = 1,
  levelStars = {},
  onSelectLevel,
  onBackToFolders,
  onOpenTutorial,
  onResetCampaign,
  studyStreak = 0,
}) {
  const { t } = useTranslation();
  const [selectedLevelModal, setSelectedLevelModal] = useState(null);
  const scrollContainerRef = useRef(null);

  // Generar los 20 niveles si no vienen provistos
  const mapLevels =
    levels && levels.length > 0
      ? levels
      : Array.from({ length: 20 }, (_, i) => {
          const lvl = i + 1;
          const isBoss = lvl === 20;
          const hasTraps = lvl >= 3;
          const trapCount = lvl < 8 ? 1 : lvl < 15 ? 2 : 3;
          return {
            level: lvl,
            name: null, // texto resuelto al pintar vía levelName()
            questions: lvl,
            hasTraps,
            trapCount: hasTraps ? trapCount : 0,
            isBoss,
            desc: null, // texto resuelto al pintar vía levelDesc()
          };
        });

  // Posiciones en zigzag vertical (de abajo hacia arriba, Nivel 1 en el fondo,
  // último nivel arriba). La altura es proporcional a la cantidad de niveles:
  // antes era 2800px fijo y una isla de 3 niveles quedaba con huecos de ~1200px.
  const LEVEL_GAP = 135; // separación vertical entre nodos consecutivos
  const TOTAL_HEIGHT = 320 + LEVEL_GAP * Math.max(1, mapLevels.length - 1);
  const levelCoords = mapLevels.map((lvl, idx) => {
    // Alternancia suave en onda senoidal
    const t = idx / (mapLevels.length - 1);
    const y = TOTAL_HEIGHT - 160 - t * (TOTAL_HEIGHT - 320);
    // Curva zigzag dinámica
    const xPct = 50 + Math.sin(idx * 0.95) * 32;
    return { level: lvl.level, xPct, y };
  });

  // Centrar scroll en el nivel actual del jugador al cargar
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeCoord = levelCoords.find(
        (c) => c.level === Math.min(unlockedLevel, 20),
      );
      if (activeCoord) {
        scrollContainerRef.current.scrollTop = Math.max(0, activeCoord.y - 350);
      }
    }
    // levelCoords es derivado estable de props; incluirlo re-dispararía
    // el scroll en cada render del mapa.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedLevel]);

  const handleNodeClick = (lvl) => {
    const isUnlocked = lvl.level <= unlockedLevel;
    if (!isUnlocked) return;
    setSelectedLevelModal(lvl);
  };

  const handleStartGame = () => {
    if (selectedLevelModal) {
      onSelectLevel(selectedLevelModal.level);
      setSelectedLevelModal(null);
    }
  };

  // Construir el path SVG curvo conectando del Nivel 1 al 20
  const pathD = levelCoords.reduce((acc, coord, i) => {
    const x = (coord.xPct * 8).toFixed(1); // Mapeado a un viewBox de 800 width
    const y = coord.y.toFixed(1);
    if (i === 0) return `M ${x} ${y}`;
    const prev = levelCoords[i - 1];
    const prevX = (prev.xPct * 8).toFixed(1);
    const prevY = prev.y.toFixed(1);
    const midY = ((parseFloat(prevY) + parseFloat(y)) / 2).toFixed(1);
    return `${acc} C ${prevX} ${midY}, ${x} ${midY}, ${x} ${y}`;
  }, "");

  return (
    <div className="relative w-full h-full overflow-hidden select-none font-sans bg-radial from-[#1e88e5] via-[#1565c0] to-[#0a2756]">
      {/* ── AMBIENTE DE FONDO CON NUBES FLOTANTES ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1.5px,transparent_1.5px)] [background-size:28px_28px]" />
      </div>

      {/* ── BARRA SUPERIOR FIJA (ESTILO MONSTER LEGENDS / ARCADE) ── */}
      <div className="absolute top-0 inset-x-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between bg-slate-950/70 border-b-arcade-xs border-[var(--color-arcade-navy-light)] backdrop-blur-md shadow-lg">
        {/* Botón Volver a Carpetas */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToFolders}
            className="group flex items-center gap-2 px-3.5 py-2 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-2 border-[var(--color-arcade-navy-light)] border-b-arcade border-b-[var(--color-arcade-ink)] text-white shadow-btn-orange-flat active:translate-y-1 active:shadow-none transition-all cursor-pointer"
            title={t('map.back_title')}
          >
            <ArrowLeft className="w-4 h-4 text-amber-400 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">
              {t('map.back_btn')}
            </span>
          </button>
        </div>

        {/* Banner Central: Título del Mundo / Documento */}
        <div className="flex flex-col items-center px-4 py-1.5 rounded-arcade bg-[var(--color-arcade-navy)]/90 border-2 border-[var(--color-arcade-navy-light)] shadow-sm">
          <div className="flex items-center gap-1.5">
            <Folder className="w-3 h-3 text-amber-400" />
            <span className="text-[9px] font-mono font-black uppercase text-amber-400 tracking-wider">
              {folderName || t('map.world')}
            </span>
          </div>
          <h1 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide truncate max-w-[200px] sm:max-w-md">
            {documentTitle || t('map.topic')} ({t('map.campaign')})
          </h1>
          {studyStreak >= 2 && (
            <span
              className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-400/50 text-[10px] font-black text-orange-300"
              title={t('map.streak_t', { count: studyStreak })}
            >
              <Flame className="w-3 h-3 text-orange-400" /> {t('map.streak', { count: studyStreak })}
            </span>
          )}
        </div>

        {/* Botones: Reiniciar Campaña + Cómo Jugar */}
        <div className="flex items-center gap-2">
          {onResetCampaign && unlockedLevel > 1 && (
            <button
              onClick={onResetCampaign}
              className="p-2 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-rose-900/80 border-2 border-[var(--color-arcade-navy-light)] border-b-arcade-sm border-b-[var(--color-arcade-ink)] text-rose-300 shadow-sm active:translate-y-1 transition-all cursor-pointer"
              title={t('map.reset_title')}
            >
              <RotateCcw className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
          {onOpenTutorial && (
            <button
              onClick={onOpenTutorial}
              className="p-2 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-2 border-[var(--color-arcade-navy-light)] border-b-arcade-sm border-b-[var(--color-arcade-ink)] text-amber-400 shadow-sm active:translate-y-1 transition-all cursor-pointer"
              title={t('map.how_to')}
            >
              <HelpCircle className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* ── LIENZO SCROLLABLE DEL MAPA (20 NIVELES EN CAMINO ASCENDENTE) ── */}
      <div
        ref={scrollContainerRef}
        className="relative w-full h-full overflow-y-auto overflow-x-hidden pt-20 pb-24 scroll-smooth"
      >
        <div
          className="relative w-full max-w-3xl mx-auto"
          style={{ height: `${TOTAL_HEIGHT}px` }}
        >
          {/* SVG para el Camino Curvo Punteado */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 800 ${TOTAL_HEIGHT}`}
            preserveAspectRatio="none"
          >
            <defs>
              <filter
                id="roadShadow"
                x="-10%"
                y="-10%"
                width="120%"
                height="120%"
              >
                <feDropShadow
                  dx="0"
                  dy="6"
                  stdDeviation="6"
                  floodColor="#05142b"
                  floodOpacity="0.7"
                />
              </filter>
            </defs>

            {/* Sombra del camino */}
            <path
              d={pathD}
              fill="none"
              stroke="#071b38"
              strokeWidth="12"
              strokeLinecap="round"
              filter="url(#roadShadow)"
            />

            {/* Línea punteada blanca brillante */}
            <path
              d={pathD}
              fill="none"
              stroke="#ffffff"
              strokeWidth="7"
              strokeDasharray="16 12"
              strokeLinecap="round"
              className="drop-shadow-[0_2px_4px_rgba(255,255,255,0.4)]"
            />
          </svg>

          {/* Islas de Soporte Decorativas a lo largo del mapa */}
          {[
            { y: TOTAL_HEIGHT - 260, label: t('map.zone1') },
            { y: TOTAL_HEIGHT - 880, label: t('map.zone2') },
            { y: TOTAL_HEIGHT - 1520, label: t('map.zone3') },
            { y: TOTAL_HEIGHT - 2160, label: t('map.zone4') },
            { y: 160, label: t('map.zone5') },
          ]
            .filter((island) => island.y > 0 && island.y < TOTAL_HEIGHT - 60)
            .map((island, idx) => (
            <div
              key={idx}
              style={{ top: `${island.y}px` }}
              className="absolute left-1/2 -translate-x-1/2 w-[85%] max-w-xl h-28 rounded-full bg-emerald-800/30 border-2 border-emerald-400/20 blur-xs pointer-events-none flex items-center justify-center"
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200/40">
                {island.label}
              </span>
            </div>
          ))}

          {/* ── RENDERIZADO DE LOS 20 NODOS DE NIVEL ── */}
          {mapLevels.map((lvl) => {
            const coord = levelCoords.find((c) => c.level === lvl.level);
            if (!coord) return null;

            const isUnlocked = lvl.level <= unlockedLevel;
            const isCurrent = lvl.level === unlockedLevel;
            const isBoss = lvl.isBoss || lvl.level === 20;
            const hasTraps = lvl.hasTraps;
            const stars = levelStars[lvl.level] || 0;

            return (
              <div
                key={lvl.level}
                style={{
                  left: `${coord.xPct}%`,
                  top: `${coord.y}px`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center cursor-pointer"
                onClick={() => handleNodeClick(lvl)}
              >
                {/* Avatar animado de Hubzi sobre el nivel actual activo */}
                {isCurrent && (
                  <motion.div
                    initial={{ y: 0 }}
                    animate={{ y: [-8, 0, -8] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.2,
                      ease: "easeInOut",
                    }}
                    className="absolute -top-16 z-30 flex flex-col items-center"
                  >
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border-3 border-[var(--color-arcade-yellow)] shadow-btn-arcade bg-[var(--color-arcade-navy-dark)]">
                      <img
                        src={capyEscolar}
                        alt="Hubzi Aquí"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="px-2 py-0.5 rounded-full bg-[var(--color-arcade-orange)] text-white font-black text-[8px] uppercase tracking-wider border border-[var(--color-arcade-navy-dark)] shadow-md -mt-1">
                      {t('map.here')}
                    </div>
                  </motion.div>
                )}

                {/* Corona y aura dorada para Hubzi Boss (Nivel 20) */}
                {isBoss && (
                  <div className="absolute -top-9 flex flex-col items-center text-[var(--color-arcade-yellow)] animate-bounce z-10">
                    <Crown className="w-8 h-8 fill-[var(--color-arcade-yellow)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]" />
                    <span className="text-[9px] font-black uppercase text-amber-300 bg-black/80 px-2 py-0.5 rounded-full border border-amber-400 -mt-1 shadow-md whitespace-nowrap">
                      {t('map.boss')}
                    </span>
                  </div>
                )}

                {/* Distintivo de Cartas Trampa para niveles 3+ */}
                {hasTraps && !isBoss && isUnlocked && (
                  <div
                    className="absolute -top-3 -right-2 z-10 p-1 rounded-full bg-rose-950 border border-rose-500 shadow-md"
                    title={t('map.traps_t', { count: lvl.trapCount })}
                  >
                    <Skull className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                )}

                {/* Estrellas ⭐⭐⭐ ganadas sobre el botón del nivel */}
                <div className="flex items-center gap-0.5 mb-1 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-xs border border-white/20 shadow-sm">
                  {[1, 2, 3].map((s) => (
                    <Star
                      key={s}
                      className={`w-3 h-3 ${
                        s <= stars
                          ? "text-[var(--color-arcade-yellow)] fill-[var(--color-arcade-yellow)] drop-shadow"
                          : "text-slate-600 fill-slate-800"
                      }`}
                    />
                  ))}
                </div>

                {/* Botón Circular 3D del Nivel */}
                <motion.button
                  whileHover={isUnlocked ? { scale: 1.15 } : {}}
                  whileTap={isUnlocked ? { scale: 0.95 } : {}}
                  disabled={!isUnlocked}
                  className={`relative ${isBoss ? "w-18 h-18 sm:w-20 sm:h-20" : "w-13 h-13 sm:w-15 sm:h-15"} rounded-full flex items-center justify-center border-4 text-white shadow-2xl transition-all cursor-pointer ${
                    !isUnlocked
                      ? "bg-gradient-to-b from-slate-600 to-slate-800 border-slate-900 shadow-[0_5px_0_#1e293b] opacity-80 cursor-not-allowed"
                      : isBoss
                        ? "bg-gradient-to-b from-[var(--color-arcade-orange)] via-[#ea580c] to-[#9a3412] border-[#ffedd5] shadow-[0_8px_0_#7c2d12,0_0_25px_rgba(249,115,22,0.9)] animate-pulse"
                        : hasTraps
                          ? "bg-gradient-to-b from-[var(--color-sky-400)] via-[#0284c7] to-[#0369a1] border-[#bae6fd] shadow-[0_6px_0_#075985,0_0_14px_rgba(56,189,248,0.6)]"
                          : "bg-gradient-to-b from-[#4ade80] via-[#16a34a] to-[#15803d] border-[#dcfce7] shadow-[0_6px_0_#166534,0_0_14px_rgba(74,222,128,0.6)]"
                  }`}
                >
                  {/* Brillo especular superior 3D */}
                  <div className="absolute top-1 inset-x-2 h-3.5 bg-gradient-to-b from-white/60 to-transparent rounded-full pointer-events-none" />

                  {isUnlocked ? (
                    <span
                      className={`${isBoss ? "text-2xl sm:text-3xl font-extrabold" : "text-lg sm:text-xl font-black"} font-sans drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}
                    >
                      {lvl.level}
                    </span>
                  ) : (
                    <Lock className="w-5 h-5 text-slate-300 drop-shadow" />
                  )}
                </motion.button>

                {/* Etiqueta inferior con el número de preguntas */}
                <div
                  className={`mt-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-md whitespace-nowrap ${
                    isUnlocked
                      ? isBoss
                        ? "bg-amber-950 border-amber-500 text-amber-200"
                        : "bg-[var(--color-arcade-navy)] border-[var(--color-arcade-navy-light)] text-white"
                      : "bg-slate-900/80 border-slate-700 text-slate-400"
                  }`}
                >
                  {lvl.questions}{" "}
                  {lvl.questions === 1 ? t('map.q_one') : t('map.q_many')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── POP-UP / MODAL DE MISIÓN DE NIVEL AL HACER CLIC EN UN BOTÓN ── */}
      <AnimatePresence>
        {selectedLevelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              className="relative w-full max-w-sm rounded-arcade-lg bg-[var(--color-arcade-navy)] border-4 border-[var(--color-arcade-navy-dark)] p-6 text-white shadow-[0_16px_0_var(--color-arcade-ink),0_25px_40px_rgba(0,0,0,0.8)] flex flex-col items-center text-center overflow-hidden"
            >
              {/* Glow decorativo */}
              <div
                className={`absolute -top-14 -right-14 w-36 h-36 ${selectedLevelModal.isBoss ? "bg-[var(--color-arcade-yellow)]/30" : "bg-[var(--color-arcade-orange)]/20"} rounded-full blur-2xl pointer-events-none`}
              />

              {/* Botón cerrar X */}
              <button
                onClick={() => setSelectedLevelModal(null)}
                className="absolute top-3 right-3 p-1.5 rounded-arcade-sm bg-[var(--color-arcade-navy-dark)] hover:bg-[var(--color-arcade-navy-hover)] border border-[var(--color-arcade-navy-light)] text-slate-400 hover:text-white transition-colors cursor-pointer"
                aria-label={t('map.close_detail')}
              >
                <X className="w-4 h-4" />
              </button>

              {/* Icono de Nivel / Jefe */}
              <div
                className={`w-16 h-16 rounded-arcade flex items-center justify-center text-white shadow-btn-arcade-lg mb-3 ${
                  selectedLevelModal.isBoss
                    ? "bg-gradient-to-b from-[var(--color-arcade-orange)] to-[var(--color-arcade-orange-shadow)] border-3 border-[var(--color-arcade-yellow)]"
                    : "bg-gradient-to-b from-[var(--color-arcade-green)] to-[var(--color-arcade-green-shadow)] border-3 border-[var(--color-arcade-green-light)]"
                }`}
              >
                {selectedLevelModal.isBoss ? (
                  <Crown className="w-9 h-9 fill-[var(--color-arcade-yellow)] text-white" />
                ) : (
                  <span className="text-3xl font-black">
                    {selectedLevelModal.level}
                  </span>
                )}
              </div>

              {/* Título de Nivel */}
              <div className="text-[10px] font-black uppercase text-[var(--color-arcade-yellow)] tracking-widest mb-0.5">
                {t('map.level_of', { level: selectedLevelModal.level, max: 20 })}
              </div>
              <h2 className="text-xl font-black text-white tracking-wide mb-2">
                {selectedLevelModal.name || levelName(selectedLevelModal, t)}
              </h2>

              {/* Descripción pedagógica */}
              <p className="text-xs text-slate-300 leading-relaxed mb-3 px-2">
                {selectedLevelModal.desc || levelDesc(selectedLevelModal, t)}
              </p>

              {/* Alerta de Cartas Trampa si aplica */}
              {selectedLevelModal.hasTraps && (
                <div className="w-full py-1.5 px-3 rounded-arcade-sm bg-rose-950/80 border border-rose-500/60 text-rose-200 text-[10px] font-bold flex items-center justify-center gap-1.5 mb-3">
                  <Skull className="w-3.5 h-3.5 text-rose-400 shrink-0" />
<span>{t('map.trap_alert', { count: selectedLevelModal.trapCount })}</span>
                </div>
              )}

              {/* Alerta de Requisito de 2 Estrellas */}
              <div className="w-full py-1 px-2.5 rounded-arcade-sm bg-amber-950/70 border border-amber-500/50 text-amber-300 text-[9.5px] font-bold flex items-center justify-center gap-1 mb-4">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                <span>{t('map.need_stars')}</span>
              </div>

              {/* Estadísticas del Nivel */}
              <div className="w-full grid grid-cols-2 gap-2 p-2.5 rounded-arcade bg-[var(--color-arcade-navy-dark)] border border-[var(--color-arcade-navy-light)] mb-5">
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">
                    {t('map.questions')}
                  </span>
                  <span className="text-sm font-black text-[var(--color-arcade-yellow)]">
                    {t('map.nodes_n', { count: selectedLevelModal.questions })}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">
                    {t('map.max_score')}
                  </span>
                  <span className="text-sm font-black text-[var(--color-arcade-green)]">
                    +{selectedLevelModal.questions * 10} pts
                  </span>
                </div>
              </div>

              {/* Botón Acción: JUGAR AHORA Y ENTRAR AL TABLERO */}
              <button
                onClick={handleStartGame}
                className="w-full py-3.5 rounded-arcade bg-[var(--color-arcade-orange)] hover:bg-[var(--color-arcade-orange-bright)] border-2 border-[var(--color-arcade-orange-light)] border-b-arcade-lg border-b-[var(--color-arcade-orange-shadow)] text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-btn-arcade-lg active:translate-y-1 active:shadow-none"
              >
                {selectedLevelModal.isBoss ? (
                  <Swords className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 fill-white" />
                )}
                <span>
                  {selectedLevelModal.isBoss
                    ? t('map.boss_fight')
                    : t('map.play')}
                </span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
