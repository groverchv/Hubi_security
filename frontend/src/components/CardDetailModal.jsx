import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Zap } from 'lucide-react';
import { getDomainIcon, DOMAIN_ICONS, resolveDynamicIcon } from '../utils/domainIcons';
import { useTranslation } from "react-i18next";

function CardDetailModal({ isOpen, card, onClose }) {
  const { t } = useTranslation();
  if (!isOpen || !card) return null;

  const IconComponent = resolveDynamicIcon({
    label: card.name,
    theme: card.theme || card.domain,
    index: card.cardIndex ?? 0
  }) || getDomainIcon(card.domain || card.name) || DOMAIN_ICONS[card.sourceType] || Sparkles;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9, x: 20 }}
        animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
        exit={{ opacity: 0, y: 50, scale: 0.9, x: 20 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-6 sm:right-6 z-50 w-auto max-w-full sm:w-96 rounded-arcade-lg bg-gradient-to-b from-[#182338] via-[#101726] to-[#0a0f19] border-2 border-cyan-400 p-4 sm:p-5 shadow-[0_15px_40px_rgba(0,0,0,0.85),0_0_30px_rgba(6,182,212,0.4)] text-slate-100 flex flex-col select-none backdrop-blur-md"
      >
        {/* Luces decorativas */}
        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-amber-400 rounded-sm shadow-md" />
        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-400 rounded-sm shadow-md" />

        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-arcade-sm bg-cyan-950 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-inner">
              <IconComponent className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                {(card.isTrap || card.isDistractor) ? t('modals.cardDetail.domain') : (card.domain || t('modals.cardDetail.domain'))}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-arcade-sm bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={t('modals.cardDetail.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TÍTULO / CONCEPTO (LA RESPUESTA) */}
        <div className="my-3 text-center">
          <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-widest block mb-1.5 flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-300 animate-pulse" />
            <span>{t('modals.cardDetail.label')}</span>
          </span>
          <h2 className="text-base sm:text-lg font-black text-white tracking-tight uppercase px-3 py-2.5 rounded-arcade bg-slate-900/95 border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.25)] leading-snug break-words">
            {card.name}
          </h2>
        </div>

        {/* BOTÓN CERRAR / JUGAR */}
        <button
          onClick={onClose}
          className="w-full py-2 rounded-arcade-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-[11px] uppercase tracking-wider shadow-[0_3px_0_#0284c7] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5 fill-slate-950" />
          <span>{t('modals.cardDetail.play')}</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

export default React.memo(CardDetailModal);

