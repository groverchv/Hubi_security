import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import GameCard from "./GameCard";
import { useTranslation } from "react-i18next";

const CARDS_PER_PAGE = 7;

/**
 * Bandeja física de cartas "El Mazo" con paginación inteligente.
 * Salta automáticamente a la página donde está la carta sugerida por la pista.
 */
export default function HandTray({
  hand,
  handPage,
  setHandPage,
  hintCardId,
  selectedCardInHand,
  isActualTurn,
  theme,
  compact = false, // móvil: deck horizontal deslizable sin paginación
  onCardClick,
  onCardKeyActivate,
  onCardDrag,
  onCardDragEnd,
}) {
  const { t } = useTranslation();
  if (!hand.length) return null;

  const totalPages = compact ? 1 : Math.ceil(hand.length / CARDS_PER_PAGE);
  // Si la carta sugerida por la pista está en otra página, saltar a ella
  const hintedIndex = hintCardId
    ? hand.findIndex((c) => c.id === hintCardId)
    : -1;
  const activePage =
    hintedIndex >= 0
      ? Math.floor(hintedIndex / CARDS_PER_PAGE)
      : Math.min(handPage, Math.max(0, totalPages - 1));
  const visibleCards =
    totalPages > 1
      ? hand.slice(
          activePage * CARDS_PER_PAGE,
          (activePage + 1) * CARDS_PER_PAGE,
        )
      : hand;

  return (
    <div
      className={`relative w-full flex flex-col items-center justify-center pb-2 z-40 transition-all duration-300 overflow-visible ${
        !isActualTurn
          ? "opacity-50 grayscale-[35%] pointer-events-none cursor-not-allowed"
          : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-1.5">
        {/* Controles de página para niveles con muchas cartas (Niveles 4 y 5) */}
        {totalPages > 1 && (
          <div className="flex items-center gap-3 px-3 py-1 rounded-full bg-[var(--color-arcade-navy)] border border-[var(--color-arcade-navy-light)] shadow-md z-50">
            <button
              type="button"
              onClick={() => setHandPage((prev) => Math.max(0, prev - 1))}
              disabled={activePage === 0}
              className={`touch-target p-1 rounded-lg border transition-all cursor-pointer ${
                activePage === 0
                  ? "opacity-30 border-transparent text-slate-500 cursor-not-allowed"
                  : "bg-[var(--color-arcade-navy-hover)] border-[#294c8b] text-[var(--color-arcade-yellow)] hover:scale-110"
              }`}
              title={t('hand.prev')}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="text-[10px] font-mono font-black text-slate-200 uppercase tracking-wider">
              {t('hand.deck', { page: activePage + 1, total: totalPages })}{' '}
              <span className="text-amber-400">{t('hand.deck_count', { count: hand.length })}</span>
            </span>

            <button
              type="button"
              onClick={() =>
                setHandPage((prev) => Math.min(totalPages - 1, prev + 1))
              }
              disabled={activePage >= totalPages - 1}
              className={`touch-target p-1 rounded-lg border transition-all cursor-pointer ${
                activePage >= totalPages - 1
                  ? "opacity-30 border-transparent text-slate-500 cursor-not-allowed"
                  : "bg-[var(--color-arcade-navy-hover)] border-[#294c8b] text-[var(--color-arcade-yellow)] hover:scale-110"
              }`}
              title={t('hand.next')}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className={`hand-tray relative px-4 ${compact ? "py-1.5" : "py-3"} rounded-arcade bg-[#e2e8f0] border-2 border-[#cbd5e1] shadow-[0_12px_24px_rgba(0,0,0,0.18),0_4px_0_#94a3b8,inset_0_2px_4px_rgba(255,255,255,0.9)] flex items-center justify-center max-w-full`} role="group" aria-label={t('hand.aria', { count: hand.length })}>
          <div className={`flex items-center gap-2.5 px-1 py-0.5 ${
            compact
              ? "overflow-x-auto overflow-y-visible w-full max-w-[86vw]"
              : "overflow-visible"
          }`}>
            {visibleCards.map((card, idx) => {
              const isHinted = hintCardId === card.id;
              const isHandSelected = selectedCardInHand?.id === card.id;
              return (
                <div
                  key={`slot-${card.id || idx}`}
                  className={`hand-slot relative rounded-arcade p-1 transition-all ${
                    isHandSelected
                      ? "bg-cyan-400/40 border-2 border-cyan-400 shadow-[0_0_22px_#22d3ee] scale-105"
                      : isHinted
                        ? "bg-amber-400/40 border-2 border-amber-400 shadow-[0_0_20px_#f59e0b]"
                        : "bg-[#cbd5e1]/40 border border-[#94a3b8]/40 shadow-inner"
                  } ${hintCardId && !isHinted && !isHandSelected ? "opacity-35" : ""} flex items-center justify-center`}
                >
                  {/* FLECHA ANIMADA DE PISTA (ANTI-DESÁNIMO TRAS 30 SEGUNDOS) */}
                  {isHinted && (
                    <div className="absolute -top-11 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none animate-bounce">
                      <span className="px-2 py-0.5 rounded-full bg-[var(--color-arcade-orange)] text-white font-black text-[9px] uppercase tracking-wider shadow-md whitespace-nowrap border border-white">
                        {t('hand.use_this')}
                      </span>
                      <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[var(--color-arcade-orange)]" />
                    </div>
                  )}

                  <GameCard
                    id={card.id}
                    name={card.name}
                    cost={card.cost}
                    type={card.type}
                    sourceType={card.sourceType}
                    domain={card.domain}
                    theme={card.theme || theme}
                    index={card.cardIndex ?? idx}
                    rotation={0}
                    zIndex={
                      isHandSelected ? 60 : isHinted ? 50 : card.zIndex
                    }
                    isDraggable={isActualTurn}
                    isSelected={isHinted || isHandSelected}
                    isTrap={Boolean(card.isTrap || card.isDistractor)}
                    compact={compact}
                    onDrag={onCardDrag}
                    onDragEnd={onCardDragEnd}
                    onClick={() => onCardClick(card)}
                    onKeyActivate={() =>
                      onCardKeyActivate ? onCardKeyActivate(card) : onCardClick(card)
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
