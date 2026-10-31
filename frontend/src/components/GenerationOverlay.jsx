import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from "react-i18next";

/**
 * Overlay de generación de tablero.
 * - Con `stage` real (del job async del backend) muestra la etapa actual.
 * - Sin `stage`, rota fases cosméticas para que la espera no se sienta rota.
 * - `onCancel` permite abortar la espera (AbortController en el llamador).
 */
const GENERATION_STEPS = ['gen.s1', 'gen.s2', 'gen.s3', 'gen.s4', 'gen.s5'];

// Etapas reales reportadas por el job del backend → texto de UI
const STAGE_LABELS = {
  queued: 'gen.queued',
  reading: 'gen.reading',
  cache: 'gen.cache',
  generating: 'gen.generating',
  saving: 'gen.saving',
  done: 'gen.done',
  error: 'gen.error',
};

const STEP_MS = 2600;

export default function GenerationOverlay({ stage = null, progress = null, errorMessage = null, onCancel = null, onRetry = null }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const isError = stage === 'error';

  useEffect(() => {
    if (stage) return; // con etapa real no rotamos fases cosméticas
    const id = setInterval(() => {
      setStep((s) => Math.min(s + 1, GENERATION_STEPS.length - 1));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [stage]);

  const label = t(stage ? STAGE_LABELS[stage] || 'gen.processing' : GENERATION_STEPS[step]);
  // Con job real: % exacto reportado por el backend (fallback al mapa por
  // etapa si el campo aún no llega). Sin job: rotación cosmética.
  const progressPct = stage
    ? (typeof progress === 'number' ? progress
      : { queued: 8, reading: 25, cache: 35, generating: 65, saving: 90, done: 100, error: 100 }[stage] ?? 50)
    : ((step + 1) / GENERATION_STEPS.length) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label={isError ? t('gen.aria_err') : t('gen.aria_gen')}
    >
      <div className={`flex flex-col items-center max-w-md w-full mx-4 p-8 bg-slate-900/90 border rounded-arcade ${
        isError
          ? 'border-rose-500/50 shadow-[0_0_50px_rgba(244,63,94,0.25)]'
          : 'border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.25)]'
      }`}>
        {isError ? (
          <div className="w-16 h-16 rounded-full bg-rose-500/15 border-2 border-rose-500/40 flex items-center justify-center mb-5">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
          </div>
        ) : (
          /* SKELETON del tablero en formación — shimmer sobre siluetas de
             nodos y cartas: la espera "percibe" el contenido que viene */
          <div className="w-full mb-5 flex flex-col items-center gap-3" aria-hidden="true">
            <div className="flex items-center gap-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-12 h-14 rounded-arcade-sm skeleton-shimmer border border-cyan-500/25"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-9 h-12 rounded-lg skeleton-shimmer border border-cyan-500/20"
                  style={{ animationDelay: `${0.3 + i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.h3
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="text-lg font-black tracking-wide text-cyan-300 mb-4 uppercase text-center"
          >
            {label}
          </motion.h3>
        </AnimatePresence>

        {/* Barra de progreso por fases */}
        <div className="w-full flex items-center gap-2 mb-4">
          <div
            className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(progressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('gen.progress_aria')}
          >
            <motion.div
              className={`h-full rounded-full ${isError ? 'bg-rose-400' : 'bg-cyan-400'}`}
              initial={{ width: '5%' }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          {stage && !isError && (
            <span className="text-[10px] font-black font-mono text-cyan-300/90 tabular-nums w-8 text-right">
              {Math.round(progressPct)}%
            </span>
          )}
        </div>

        {isError ? (
          <p className="text-[12px] text-rose-200/90 mt-1 text-center leading-relaxed font-semibold">
            {errorMessage || t('gen.err_default')}
          </p>
        ) : (
          <p className="text-[11px] text-slate-400 mt-1 text-center leading-relaxed">
{t('gen.wait_note')}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3 flex-wrap justify-center">
          {isError && onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-5 py-2 rounded-arcade-sm bg-emerald-500/90 hover:bg-emerald-400 border border-emerald-400/50 text-slate-950 text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-[0_3px_0_#065f46]"
            >
              <RefreshCw className="w-4 h-4" />
              {t('gen.retry')}
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-5 py-2 rounded-arcade-sm bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95"
            >
              <XCircle className="w-4 h-4" />
              {isError ? t('gen.close') : t('gen.cancel')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
