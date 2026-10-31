import React from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { getDomainIcon, DOMAIN_ICONS, resolveDynamicIcon } from '../utils/domainIcons';

// Paleta de cartas / fichas 100% fiel a la imagen de referencia:
// Ficha A: Coral/Naranja cálido suave
// Ficha B: Morado/Púrpura vibrante
// Ficha C: Azul/Índigo cósmico con trofeo
// Ficha D: Azul noche / Pizarra oscuro con bombilla
// Ficha E: Salmón / Melocotón
// Ficha F: Crema / Blanco aperlado con casco/avatar
const CARD_THEMES = {
  orange: {
    gradient: 'from-[#ff9f68] via-[#f97316] to-[#ea580c]',
    shadow: '0 6px 0 #c2410c, 0 10px 15px rgba(234, 88, 12, 0.4)',
    border: 'border-[#fed7aa]',
    textColor: 'text-white',
    subTextColor: 'text-orange-100',
    iconColor: 'text-white',
  },
  purple: {
    gradient: 'from-[#c084fc] via-[#9333ea] to-[#7e22ce]',
    shadow: '0 6px 0 #6b21a8, 0 10px 15px rgba(147, 51, 234, 0.4)',
    border: 'border-[#f3e8ff]',
    textColor: 'text-white',
    subTextColor: 'text-purple-100',
    iconColor: 'text-white',
  },
  blue: {
    gradient: 'from-[#818cf8] via-[#4f46e5] to-[#3730a3]',
    shadow: '0 6px 0 #312e81, 0 10px 15px rgba(79, 70, 229, 0.4)',
    border: 'border-[#e0e7ff]',
    textColor: 'text-white',
    subTextColor: 'text-indigo-100',
    iconColor: 'text-white',
  },
  dark: {
    gradient: 'from-[#334155] via-[#1e293b] to-[#0f172a]',
    shadow: '0 6px 0 #020617, 0 10px 15px rgba(15, 23, 42, 0.5)',
    border: 'border-[#64748b]',
    textColor: 'text-white',
    subTextColor: 'text-slate-300',
    iconColor: 'text-amber-300',
  },
  salmon: {
    gradient: 'from-[#fca5a5] via-[#f87171] to-[#ef4444]',
    shadow: '0 6px 0 #b91c1c, 0 10px 15px rgba(239, 68, 68, 0.4)',
    border: 'border-[#fee2e2]',
    textColor: 'text-white',
    subTextColor: 'text-rose-100',
    iconColor: 'text-white',
  },
  white: {
    gradient: 'from-[#ffffff] via-[#f8fafc] to-[#e2e8f0]',
    shadow: '0 6px 0 #94a3b8, 0 10px 15px rgba(148, 163, 184, 0.35)',
    border: 'border-white',
    textColor: 'text-slate-800',
    subTextColor: 'text-slate-500',
    iconColor: 'text-indigo-600',
  },
  // Fallbacks de compatibilidad
  red: {
    gradient: 'from-[#fca5a5] via-[#f87171] to-[#ef4444]',
    shadow: '0 6px 0 #b91c1c, 0 10px 15px rgba(239, 68, 68, 0.4)',
    border: 'border-[#fee2e2]',
    textColor: 'text-white',
    subTextColor: 'text-rose-100',
    iconColor: 'text-white',
  },
  emerald: {
    gradient: 'from-[#6ee7b7] via-[#10b981] to-[#047857]',
    shadow: '0 6px 0 #065f46, 0 10px 15px rgba(16, 185, 129, 0.4)',
    border: 'border-[#d1fae5]',
    textColor: 'text-white',
    subTextColor: 'text-emerald-100',
    iconColor: 'text-white',
  },
  yellow: {
    gradient: 'from-[#fde047] via-[#eab308] to-[#ca8a04]',
    shadow: '0 6px 0 #a16207, 0 10px 15px rgba(234, 179, 8, 0.4)',
    border: 'border-[#fef9c3]',
    textColor: 'text-white',
    subTextColor: 'text-amber-100',
    iconColor: 'text-white',
  },
};

export default function GameCard({ 
  id, 
  name, 
  cost = "+1", 
  type = "blue",
  sourceType = "document", 
  domain = "",
  theme = "",
  index = 0,
  rotation = 0,
  zIndex = 10,
  isDraggable = true,
  isSelected = false,
  isTrap = false,
  compact = false, // layout móvil sin escala: el drag nativo ya es preciso
  onDrag,
  onDragEnd,
  onClick,
  onKeyActivate,
  className = ""
}) {
  const IconComponent = resolveDynamicIcon({
    label: name,
    theme: theme || domain,
    index
  }) || getDomainIcon(domain || name) || DOMAIN_ICONS[sourceType] || Sparkles;
  const cardTheme = CARD_THEMES[type] || CARD_THEMES.blue;

  // En móvil horizontal el escenario usa transform: scale(0.55) — el drag
  // nativo de framer-motion no corrige los deltas y la carta se separa del
  // dedo. Se reemplaza por pan manual compensado por el factor de escala.
  const zoomedMobile =
    !compact &&
    typeof window !== "undefined" &&
    window.matchMedia?.("(orientation: landscape) and (max-height: 640px)").matches;
  const panX = useMotionValue(0);
  const panY = useMotionValue(0);
  const [isPanning, setIsPanning] = React.useState(false);
  const manualDragProps =
    isDraggable && zoomedMobile
      ? {
          onPanStart: () => setIsPanning(true),
          onPan: (_e, info) => {
            panX.set(panX.get() + info.delta.x / 0.55);
            panY.set(panY.get() + info.delta.y / 0.55);
            if (onDrag) onDrag(id, { point: { x: info.point.x, y: info.point.y } });
          },
          onPanEnd: (_e, info) => {
            setIsPanning(false);
            if (onDragEnd)
              onDragEnd(id, {
                point: { x: info.point.x, y: info.point.y },
                offset: { x: panX.get(), y: panY.get() },
              });
            animate(panX, 0, { type: "spring", stiffness: 400, damping: 30 });
            animate(panY, 0, { type: "spring", stiffness: 400, damping: 30 });
          },
        }
      : {};

  return (
    <motion.div
      drag={isDraggable && !zoomedMobile}
      dragSnapToOrigin={true}
      dragElastic={0.15}
      whileHover={{ scale: 1.13, y: -24, zIndex: 80 }}
      whileDrag={{
        scale: 0.9,
        zIndex: 9999,
        opacity: 0.97,
        boxShadow: '0 0 38px rgba(251,146,60,0.9)'
      }}
      animate={isPanning ? { scale: 0.9 } : { scale: 1 }}
      style={{
        rotate: `${rotation}deg`,
        zIndex: isPanning ? 9999 : isSelected ? 90 : zIndex,
        x: panX,
        y: panY,
      }}
      {...manualDragProps}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      onTap={() => { if (onClick) onClick(id); }}
      onDrag={(e, info) => { if (onDrag) onDrag(id, info); }}
      onDragEnd={(e, info) => { if (onDragEnd) onDragEnd(id, info); }}
      role="button"
      tabIndex={0}
      aria-label={`Carta ${name || id}. Pulsa Enter para seleccionarla y luego toca una casilla del tablero.`}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && (onKeyActivate || onClick)) {
          e.preventDefault();
          // Activación por teclado: además de seleccionar, el foco salta a
          // las casillas del tablero para colocar con Enter (flujo sin mouse).
          if (onKeyActivate) onKeyActivate(id);
          else onClick(id);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          // Flechas: mover el foco entre cartas del mazo
          e.preventDefault();
          const cards = [...document.querySelectorAll('[data-card-id]')];
          const idx = cards.indexOf(e.currentTarget);
          if (idx === -1 || !cards.length) return;
          const step = e.key === 'ArrowRight' ? 1 : -1;
          cards[(idx + step + cards.length) % cards.length]?.focus();
        }
      }}
      data-card-id={id}
      className={`relative flex-shrink-0 cursor-grab active:cursor-grabbing select-none focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/80 rounded-arcade ${className}`}
    >
      {/* Selected badge */}
      {isSelected && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 rounded-full bg-orange-400 text-white text-[8px] font-black tracking-widest uppercase shadow-lg animate-bounce whitespace-nowrap">
          LISTA PARA COLOCAR
        </div>
      )}

      {/* ── CARD BODY (FICHA DE JUEGO 3D) ── */}
      <div
        className={`game-card relative ${compact ? "w-[58px] h-[72px]" : "w-[78px] sm:w-[84px] h-[96px] sm:h-[104px]"} rounded-arcade bg-gradient-to-b ${cardTheme.gradient} border-2 ${cardTheme.border} p-2 flex flex-col items-center justify-between overflow-hidden transition-all duration-200 cursor-pointer touch-none`}
        style={{ 
          boxShadow: isSelected 
            ? '0 0 25px rgba(249, 115, 22, 0.9), 0 8px 0 #ea580c' 
            : cardTheme.shadow,
          transform: isSelected ? 'translateY(-14px)' : undefined
        }}
      >
        {/* Brillo especular superior simulando plástico curvo de ficha */}
        <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-b from-white/35 to-transparent rounded-t-arcade pointer-events-none" />

        {/* Contenedor de Icono en relieve + nombre de la respuesta */}
        <div className="flex-1 flex flex-col items-center justify-center w-full gap-1 min-h-0">
          <div className="game-card-icon w-10 h-10 rounded-arcade-sm bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-inner shrink-0">
            <IconComponent className={`w-6 h-6 ${cardTheme.iconColor} drop-shadow-md`} />
          </div>
          {name && (
            <span
              className={`game-card-name w-full text-center font-black leading-[1.1] ${cardTheme.textColor} drop-shadow-sm line-clamp-3`}
              style={{ fontSize: '8.5px' }}
              title={name}
            >
              {name}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
