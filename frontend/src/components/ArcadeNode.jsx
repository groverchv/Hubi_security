import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, HelpCircle, Sparkles, Star } from 'lucide-react';
import { getDomainIcon, DOMAIN_ICONS, resolveDynamicIcon } from '../utils/domainIcons';
import KaTeXText from './KaTeXText';
import { useTranslation } from "react-i18next";

function ArcadeNode({
  id,
  icon = null,
  color = "blue",
  shape = "card",
  active = true,
  placedCard = null,
  isOver = false,
  label = "",
  domain = "",
  theme = "",
  question = "",
  questionLatex = null,
  hint = "",
  index = 0,
  style = {},
  fx = null, // { kind: 'correct'|'wrong', seq, points } — feedback empático del último intento
  afford = null, // 'match'|'open' — affordance de drop con carta seleccionada/en arrastre
  preview = null, // 'correct'|'wrong' — preview en vivo del resultado si se suelta aquí
  onClick
}) {
  const { t } = useTranslation();
  // Resolución 100% dinámica de icono adaptada a la temática del documento (abogacía, medicina, psicología, etc.)
  const IconComp = resolveDynamicIcon({
    label: label || (typeof icon === 'string' ? icon : ''),
    question,
    hint,
    theme: theme || domain,
    index
  }) || Sparkles;

  return (
    <div 
      data-node-id={id}
      onClick={() => { if (onClick) onClick(id); }}
      role="button"
      tabIndex={0}
      aria-label={t('board.cell_aria', { label: label || id, status: placedCard ? t('board.cell_done', { card: placedCard.name }) : t('board.cell_empty'), question: question || t('board.cell_action') })}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick(id);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          // Navegación por flechas entre casillas (input sin mouse)
          e.preventDefault();
          const cells = [...document.querySelectorAll('[data-node-id][role="button"]')];
          const idx = cells.indexOf(e.currentTarget);
          if (idx === -1 || !cells.length) return;
          const step = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
          cells[(idx + step + cells.length) % cells.length]?.focus();
        }
      }}
      className="relative flex flex-col items-center select-none cursor-pointer group focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/80 rounded-arcade-sm"
      style={{ zIndex: 1 }}
    >
      {/* HEXAGONAL SLOT — matches the reference image honeycomb cells */}
      <motion.div
        data-node-id={id}
        style={style}
        whileHover={{ scale: 1.12, y: -4, zIndex: 40 }}
        whileTap={{ scale: 0.95 }}
        className="relative"
      >
        {/* SACUDIDA SUAVE AL FALLAR — el key remonta y re-dispara la animación
            en cada intento fallido sobre este nodo */}
        <motion.div
          key={fx?.kind === 'wrong' ? `shake-${fx.seq}` : 'idle'}
          animate={fx?.kind === 'wrong' ? { x: [0, -6, 6, -4, 2, 0] } : { x: 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          className="relative"
        >
        {/* AFFORDANCE DE MATCH — con una carta seleccionada/en arrastre:
            la casilla compatible pulsa ámbar suave (pista sutil) y las
            demás vacías muestran un anillo tenue de "puedes soltar aquí". */}
        {afford === 'match' && !placedCard && (
          <motion.div
            className="absolute -inset-2.5 rounded-full border-[3px] border-amber-400/80 pointer-events-none z-20"
            style={{ boxShadow: '0 0 14px rgba(251,191,36,0.55)' }}
            animate={{ opacity: [0.45, 1, 0.45], scale: [0.96, 1.04, 0.96] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
          />
        )}
        {afford === 'open' && !placedCard && (
          <div className="absolute -inset-1.5 rounded-full border-2 border-dashed border-cyan-400/50 pointer-events-none z-20 animate-pulse" />
        )}

        {/* PULSO ÁMBAR EMPÁTICO — "casi, ese no es": nunca rojo agresivo */}
        {fx?.kind === 'wrong' && (
          <motion.div
            key={`pulse-${fx.seq}`}
            className="absolute -inset-3 rounded-full border-4 border-amber-400/90 pointer-events-none z-20"
            style={{ boxShadow: '0 0 18px rgba(251,191,36,0.65)' }}
            initial={{ opacity: 0.9, scale: 0.72 }}
            animate={{ opacity: 0, scale: 1.45 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          />
        )}

        {/* MICRO-CELEBRACIÓN: estrella que salta del nodo al acertar +
            puntos ganados flotando hacia arriba */}
        {fx?.kind === 'correct' && fx?.points > 0 && (
          <motion.div
            key={`pts-${fx.seq}`}
            className="absolute left-1/2 -top-2 z-40 pointer-events-none"
            initial={{ opacity: 0, y: 6, x: '-50%', scale: 0.7 }}
            animate={{ opacity: [0, 1, 1, 0], y: [6, -26, -40, -46], scale: [0.7, 1.15, 1, 1], x: '-50%' }}
            transition={{ duration: 1.15, ease: 'easeOut' }}
          >
            <span className="px-2 py-0.5 rounded-full bg-emerald-500 border border-emerald-200 text-white text-[10px] font-black shadow-[0_0_12px_rgba(52,211,153,0.8)] whitespace-nowrap">
              +{fx.points} pts
            </span>
          </motion.div>
        )}
        {fx?.kind === 'correct' && (
          <motion.div
            key={`star-${fx.seq}`}
            className="absolute left-1/2 top-0 z-40 pointer-events-none"
            initial={{ opacity: 0, scale: 0.3, y: 10, x: '-50%' }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.3, 1.5, 1.15, 1.15],
              y: [10, -30, -44, -44],
              x: '-50%',
            }}
            transition={{ duration: 0.95, ease: 'easeOut' }}
          >
            <Star className="w-7 h-7 text-amber-400 fill-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
          </motion.div>
        )}

        {/* Outer hexagonal bezel — white/light with shadow (the board slot) */}
        <svg
          width="60"
          height="68"
          viewBox="0 0 60 68"
          className="absolute inset-0"
          style={{ filter: preview === 'wrong' ? 'drop-shadow(0 0 8px #fb7185)' : isOver || preview === 'correct' ? 'drop-shadow(0 0 8px #f97316)' : placedCard ? 'drop-shadow(0 0 6px #22c55e)' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))' }}
        >
          {/* Outer filled hexagon — bezel */}
          <polygon
            points="30,2 58,17 58,51 30,66 2,51 2,17"
            fill={placedCard ? '#dcfce7' : preview === 'wrong' ? '#ffe4e6' : isOver || preview === 'correct' ? '#fff7ed' : '#f1f5f9'}
            stroke={placedCard ? '#22c55e' : preview === 'wrong' ? '#fb7185' : isOver || preview === 'correct' ? '#f97316' : '#cbd5e1'}
            strokeWidth="2.5"
          />
          {/* Inner inset hexagon — the "slot hole" */}
          <polygon
            points="30,12 50,23 50,45 30,56 10,45 10,23"
            fill={placedCard ? '#bbf7d0' : preview === 'wrong' ? '#fecdd3' : '#e2e8f0'}
            stroke={placedCard ? '#16a34a' : preview === 'wrong' ? '#fb7185' : '#94a3b8'}
            strokeWidth="1.5"
          />
          {/* Corner rivet dots */}
          <circle cx="30" cy="4" r="2.5" fill="var(--color-amber-400)" />
          <circle cx="56" cy="17" r="2.5" fill="var(--color-amber-400)" />
          <circle cx="56" cy="51" r="2.5" fill="var(--color-amber-400)" />
          <circle cx="30" cy="64" r="2.5" fill="var(--color-amber-400)" />
          <circle cx="4" cy="51" r="2.5" fill="var(--color-amber-400)" />
          <circle cx="4" cy="17" r="2.5" fill="var(--color-amber-400)" />
        </svg>

        {/* RECTANGULAR CARD DROP AREA — inside the hexagon, where the card sits */}
        <div
          className={`relative z-10 w-[46px] h-[44px] mx-auto mt-[12px] rounded-lg flex flex-col items-center justify-center overflow-hidden transition-all duration-200 ${
            placedCard
              ? 'bg-green-100 border-2 border-green-400'
              : preview === 'wrong'
              ? 'bg-rose-100 border-2 border-rose-400 border-dashed'
              : isOver || preview === 'correct'
              ? 'bg-orange-100 border-2 border-orange-400 border-dashed'
              : 'bg-slate-200/80 border-2 border-dashed border-slate-400/60 group-hover:border-slate-500'
          }`}
          style={{ minHeight: 44, minWidth: 46 }}
        >
          {placedCard ? (
            /* La carta "aterriza" con rebote al colocarse bien */
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            >
              <CheckCircle2 className="w-5 h-5 text-green-600 drop-shadow-sm" />
            </motion.div>
          ) : (
            <IconComp className="w-4 h-4 text-slate-600 group-hover:text-slate-700 transition-colors" />
          )}
        </div>

        {/* Spacer to fill SVG height */}
        <div style={{ height: 68, width: 60 }} className="invisible pointer-events-none" />
        </motion.div>
      </motion.div>

      {/* NOMBRE DE LA RESPUESTA COLOCADA — visible bajo la casilla */}
      {placedCard?.name && (
        <span
          className="mt-1 max-w-[130px] text-center text-[8.5px] font-black leading-tight text-green-800 bg-green-100/95 border border-green-300 rounded-md px-1.5 py-0.5 shadow-sm line-clamp-2"
          title={placedCard.name}
        >
          {placedCard.name}
        </span>
      )}

      {/* HOVER TOOLTIP FLOTANTE DE LECTURA RÁPIDA (SIEMPRE LEGIBLE) */}
      {question && (
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 sm:w-72 p-3 rounded-arcade bg-[var(--color-arcade-navy)]/98 border-2 border-amber-400/80 shadow-[0_12px_32px_rgba(0,0,0,0.85)] text-slate-100 opacity-0 scale-90 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto z-50 backdrop-blur-md">
          <p className="text-amber-300 font-black text-[9px] uppercase tracking-wider mb-1 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>{label ? t('board.cell_label', { label }) : t('board.cell_item')}</span>
          </p>
          <p className="leading-snug text-slate-200 font-semibold text-[10.5px] max-h-24 overflow-y-auto">{question}</p>
          {placedCard?.name && (
            <p className="mt-1.5 text-[10px] font-black text-green-300 border-t border-green-500/30 pt-1">
              {t('board.cell_answer', { card: placedCard.name })}
            </p>
          )}
          {questionLatex && (
            <div className="mt-1.5 text-cyan-100 text-[11px] overflow-x-auto">
              <KaTeXText tex={questionLatex} displayMode />
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-between border-t border-slate-700/60 pt-1 text-[8px] font-mono text-cyan-300">
            <span>{t('board.cell_drop')}</span>
            <span className="text-amber-400 font-bold">{t('board.cell_expand')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Memo: la arena re-renderiza ~1/s (timers, voz, hints) y cada nodo es un
// sub-árbol con SVG + motion — sin memo los 20 nodos se recalculan por tick.
export default React.memo(ArcadeNode);
