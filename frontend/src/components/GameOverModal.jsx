import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RotateCcw, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function GameOverModal({
  open,
  theme,
  playerScore,
  onRestart,
  onTerminate,
}) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md rounded-arcade-lg bg-[#141d2d] border-2 border-cyan-400 p-6 sm:p-8 text-center text-slate-100 shadow-[0_0_50px_rgba(6,182,212,0.5)]"
          >
            <div className="w-16 h-16 mx-auto rounded-arcade bg-cyan-950/80 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 mb-4 shadow-[0_0_20px_rgba(34,211,238,0.4)]">
              <Trophy className="w-8 h-8 text-amber-400" />
            </div>

            <h2 className="text-xl font-black uppercase tracking-wider text-white">
              {t('modals.gameover.title')}
            </h2>
            <p className="text-xs text-slate-400 mt-1 mb-6">
              {t('modals.gameover.dominated')}{' '}
              <strong className="text-cyan-300">
                {theme || t('modals.gameover.area_default')}
              </strong>
              .
            </p>

            <div className="flex items-center justify-center gap-6 py-3 px-4 rounded-arcade bg-slate-900 border border-slate-700 mb-6">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">
                  {t('modals.gameover.score')}
                </p>
                <p className="text-2xl font-black text-amber-400 font-mono">
                  {playerScore}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={onRestart}
                className="w-full py-3 rounded-arcade-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t('modals.gameover.next')}</span>
              </button>

              <button
                onClick={onTerminate}
                className="w-full py-3 rounded-arcade-sm bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>{t('modals.gameover.end')}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
