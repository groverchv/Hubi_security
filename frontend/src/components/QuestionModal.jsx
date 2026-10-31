import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, Sparkles, ArrowRight, CheckCircle2, Lightbulb } from 'lucide-react';
import KaTeXText from './KaTeXText';
import { isMinor } from '../utils/ageConfig';
import { useTranslation } from "react-i18next";

export default function QuestionModal({ isOpen, node, onClose, ageBand = null }) {
  const { t } = useTranslation();
  if (!isOpen || !node) return null;

  const kidMode = isMinor(ageBand);
  const badge = t(kidMode ? 'modals.question.badge_kid' : 'modals.question.badge_adult');
  const heading = t(kidMode ? 'modals.question.title_kid' : 'modals.question.title_adult');
  const hintText = node.answerSpec?.hint || node.hint;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-lg rounded-arcade-lg bg-[#0f172a] border border-slate-700 shadow-2xl overflow-hidden text-slate-100 p-6 sm:p-7 flex flex-col"
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-arcade-sm bg-sky-950 border border-sky-500/50 flex items-center justify-center text-sky-400 font-bold shadow-sm">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  {badge}
                </span>
                <h3 className="text-sm font-bold text-white mt-0.5">
                  {heading}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-arcade-sm bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Cuerpo: Pregunta Formulada */}
          <div className="my-5 p-4 rounded-arcade bg-slate-900/90 border border-slate-800 shadow-inner">
            <p className="text-xs font-mono uppercase text-amber-400 font-bold tracking-wider mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {kidMode ? t('modals.question.mission_kid') : t('modals.question.mission_adult')}
            </p>
            <p className="text-sm sm:text-base font-medium text-slate-100 leading-relaxed whitespace-pre-line">
              "{node.question || t('modals.question.default_q')}"
            </p>
            {node.questionLatex && (
              <div className="mt-3 text-cyan-100 text-base overflow-x-auto">
                <KaTeXText tex={node.questionLatex} displayMode />
              </div>
            )}
            {hintText && (
              <p className="mt-3 text-[11px] text-slate-400 flex items-start gap-1.5 border-t border-slate-800 pt-2.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{hintText}</span>
              </p>
            )}
          </div>

          {/* Estado de la Carta si ya fue colocada */}
          {node.placedCard && (
            <div className="mt-4 p-3 rounded-arcade-sm bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-between text-xs text-emerald-300">
              <span className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {t('modals.question.placed', { card: node.placedCard.name })}
              </span>
            </div>
          )}

          {/* Botón Entendido */}
          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              onClick={() => {
                if (onClose) onClose();
              }}
              className="w-full py-3 rounded-arcade-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-950 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{kidMode ? t('modals.question.ok_kid') : t('modals.question.ok_adult')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
