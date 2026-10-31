import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, Play, Volume2, VolumeX, Sparkles, ChevronRight } from 'lucide-react';
import { capyVoice } from '../utils/capyVoice';
import capyPsicologo from '../assets/mascots/capy_psicologo_m.webp';
import { fetchWithAuth } from '../lib/api';
import { useTranslation } from 'react-i18next';

/**
 * Técnica de Respiración Terapéutica 4-7-8 (Respaldada psicológicamente para reducir cortisol y ansiedad):
 * Inhala: 4 segundos (Estimula el sistema nervioso de forma controlada)
 * Retén: 7 segundos (Oxigena la sangre y reduce el ritmo cardíaco de forma profunda)
 * Exhala: 8 segundos (Activa el sistema nervioso parasimpático y calma la mente)
 *
 * Exactamente 2 ciclos para preparar al estudiante sin fatigarlo.
 */
const BREATH_PHASES = [
  {
    key: 'inhale',
    title: 'modals.zen.p_inhale_t',
    instruction: 'modals.zen.p_inhale_i',
    duration: 4,
    scale: 1.25,
    glow: 'rgba(186, 230, 253, 0.45)',
    borderColor: 'var(--color-sky-400)',
    textColor: '#0369a1',
    speakText: 'modals.zen.p_inhale_s'
  },
  {
    key: 'hold',
    title: 'modals.zen.p_hold_t',
    instruction: 'modals.zen.p_hold_i',
    duration: 7,
    scale: 1.25,
    glow: 'rgba(167, 243, 208, 0.45)',
    borderColor: '#34d399',
    textColor: '#047857',
    speakText: 'modals.zen.p_hold_s'
  },
  {
    key: 'exhale',
    title: 'modals.zen.p_exhale_t',
    instruction: 'modals.zen.p_exhale_i',
    duration: 8,
    scale: 0.92,
    glow: 'rgba(253, 230, 138, 0.45)',
    borderColor: 'var(--color-amber-400)',
    textColor: '#b45309',
    speakText: 'modals.zen.p_exhale_s'
  }
];

// Frases terapéuticas concisas y sincronizadas con los tiempos exactos de respiración (4s, 7s, 8s)
const ZEN_PHRASES = {
  inhale: "modals.zen.z_inhale",
  hold:   "modals.zen.z_hold",
  exhale: "modals.zen.z_exhale",
  cycle2: "modals.zen.z_cycle2",
  finish: "modals.zen.z_finish"
};

export default function ZenRelaxModal({ isOpen, onComplete, onSkip }) {
  const { t } = useTranslation();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(4);
  const [cycleCount, setCycleCount] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const totalCycles = 2; // Exactamente 2 repeticiones terapéuticas recomendadas
  const currentPhase = BREATH_PHASES[phaseIndex] || BREATH_PHASES[0];

  // Silenciar de inmediato cualquier voz en reproducción
  const stopAllAudio = () => {
    capyVoice.stop();
  };

  // Reproducción 100% LOCAL e instantánea de la voz terapéutica de Hubzi Zen
  const speakVoice = (text) => {
    if (isMuted || !text) return;
    capyVoice.stop();
    capyVoice.speak(text, {
      profile: 'zen',
      mood: 'zen',
      stress_level: 0.85
    });
  };

  // Inicio automático de la sesión al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setPhaseIndex(0);
      setTimeLeft(4);
      setCycleCount(1);
      setHasStarted(true);

      const startTimer = setTimeout(() => {
        speakVoice(t(ZEN_PHRASES.inhale));
      }, 400);

      return () => {
        clearTimeout(startTimer);
        stopAllAudio();
      };
    } else {
      setHasStarted(false);
      stopAllAudio();
    }
  }, [isOpen]);

  // Contador regresivo a 1 segundo exacto
  useEffect(() => {
    if (!isOpen || !hasStarted) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, hasStarted]);

  // Transición sincronizada entre fases cuando el segundero llega a 0
  useEffect(() => {
    if (!isOpen || !hasStarted || timeLeft > 0) return;

    if (phaseIndex === 0) {
      // Inhala (4s) terminado -> Pasar a Retén (7s)
      setPhaseIndex(1);
      setTimeLeft(7);
      speakVoice(t(ZEN_PHRASES.hold));
    } else if (phaseIndex === 1) {
      // Retén (7s) terminado -> Pasar a Exhala (8s)
      setPhaseIndex(2);
      setTimeLeft(8);
      speakVoice(t(ZEN_PHRASES.exhale));
    } else if (phaseIndex === 2) {
      // Exhala (8s) terminado
      if (cycleCount < totalCycles) {
        setCycleCount(c => c + 1);
        setPhaseIndex(0);
        setTimeLeft(4);
        speakVoice(t(ZEN_PHRASES.cycle2));
      } else {
        // Fin de los 2 ciclos terapéuticos
        setHasStarted(false);
        speakVoice(t(ZEN_PHRASES.finish));
        try {
          fetchWithAuth('/api/v1/zen/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              log_type: 'breathing_4_7_8',
              duration_seconds: 38,
              notes: 'Pausa activa terapéutica completada con Hubzi Zen'
            })
          }).catch(() => {});
        } catch (e) {}

        const completeTimer = setTimeout(() => {
          onComplete();
        }, 2800);
        return () => clearTimeout(completeTimer);
      }
    }
  }, [timeLeft, phaseIndex, cycleCount, totalCycles, isOpen, hasStarted]);

  const handleSkipNow = () => {
    setHasStarted(false);
    stopAllAudio();
    onSkip ? onSkip() : onComplete();
  };

  if (!isOpen) return null;


  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none"
      >
        {/* Fondo con aura zen respiratoria suave */}
        <motion.div
          animate={{
            scale: currentPhase.scale * 1.15,
            opacity: [0.2, 0.45, 0.2]
          }}
          transition={{ duration: 4, ease: 'easeInOut' }}
          style={{ background: currentPhase.glow }}
          className="absolute w-96 h-96 sm:w-[500px] sm:h-[500px] rounded-full blur-3xl pointer-events-none"
        />

        {/* Tarjeta Central Clara y Relajante */}
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg rounded-arcade-lg bg-[#0f172a] border border-slate-700/80 p-6 sm:p-9 text-center shadow-2xl flex flex-col items-center backdrop-blur-md"
        >
          {/* Header con Capibara Guía */}
          <div className="flex items-center justify-between w-full mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-arcade overflow-hidden border border-emerald-400 shadow-sm bg-slate-900">
                <img src={capyPsicologo} alt="Hubzi Zen" className="w-full h-full object-cover" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  {t('modals.zen.guide')}
                </h4>
                <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                  <span>{t('modals.zen.therapy')}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 font-semibold">{t('modals.zen.tagline')}</span>
                </p>
              </div>
            </div>

            {/* Controles de Sonido y Omitir */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const nextMuted = !isMuted;
                  setIsMuted(nextMuted);
                  if (nextMuted) {
                    stopAllAudio();
                  } else {
                    if (phaseIndex === 0) speakVoice(t(cycleCount === 1 ? ZEN_PHRASES.inhale : ZEN_PHRASES.cycle2));
                    else if (phaseIndex === 1) speakVoice(t(ZEN_PHRASES.hold));
                    else if (phaseIndex === 2) speakVoice(t(ZEN_PHRASES.exhale));
                  }
                }}
                className="p-2 rounded-arcade-sm bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                title={isMuted ? t('modals.zen.unmute') : t('modals.zen.mute')}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                onClick={handleSkipNow}
                className="text-[11px] font-medium text-slate-400 hover:text-white px-2.5 py-1.5 rounded-arcade-sm hover:bg-slate-800 transition-colors flex items-center gap-1 border border-slate-700"
              >
                <span>{t('modals.zen.skip')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Indicador de Ciclo */}
          <div className="px-3.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold text-slate-300 tracking-wider mb-6">
            {t('modals.zen.cycle', { n: Math.min(cycleCount, totalCycles), total: totalCycles })}
          </div>

          {/* Círculo Principal de Respiración Animado */}
          <div className="relative flex items-center justify-center my-4 w-52 h-52 sm:w-60 sm:h-60">
            {/* Anillo exterior */}
            <motion.div
              animate={{
                scale: [currentPhase.scale * 0.9, currentPhase.scale * 1.15, currentPhase.scale * 0.9],
                borderColor: currentPhase.borderColor
              }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full border-2 border-dashed opacity-40"
            />

            {/* Círculo que se infla y desinfla */}
            <motion.div
              animate={{
                scale: currentPhase.scale,
                boxShadow: `0 8px 30px ${currentPhase.glow}`
              }}
              transition={{ duration: currentPhase.duration, ease: 'easeInOut' }}
              style={{ borderColor: currentPhase.borderColor }}
              className="w-40 h-40 sm:w-44 sm:h-44 rounded-full border-4 bg-slate-950 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-md"
            >
              {/* Icono temático */}
              <motion.div
                animate={{ rotate: currentPhase.key === 'inhale' ? 360 : 0 }}
                transition={{ duration: 4, ease: 'linear' }}
                className="mb-1"
              >
                <Wind className="w-7 h-7" style={{ color: currentPhase.borderColor }} />
              </motion.div>

              {/* Segundero Grande */}
              <motion.span 
                key={`${phaseIndex}-${timeLeft}`}
                initial={{ scale: 1.15, opacity: 0.8 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-4xl sm:text-5xl font-black font-mono tracking-tight"
                style={{ color: currentPhase.borderColor }}
              >
                {Math.max(1, timeLeft)}s
              </motion.span>

              {/* Etiqueta de la fase */}
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mt-1">
                {t('modals.zen.act_' + currentPhase.key)}
              </span>
            </motion.div>
          </div>

          {/* Título e instrucción de la Fase Actual */}
          <div className="mt-4 text-center">
            <h3 
              className="text-lg sm:text-xl font-bold tracking-wide uppercase transition-colors"
              style={{ color: currentPhase.borderColor }}
            >
              {t(currentPhase.title)}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 font-sans mt-1 max-w-xs mx-auto">
              {t(currentPhase.instruction)}
            </p>
          </div>

          {/* Barra de progreso de la fase */}
          <div className="w-full bg-slate-950 rounded-full h-2 mt-6 overflow-hidden border border-slate-800">
            <motion.div
              key={`${phaseIndex}-${cycleCount}`}
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: currentPhase.duration, ease: 'linear' }}
              className="h-full rounded-full"
              style={{ backgroundColor: currentPhase.borderColor }}
            />
          </div>

          {/* Botón Comenzar Ahora */}
          <button
            onClick={handleSkipNow}
            className="mt-6 w-full py-2.5 rounded-arcade-sm bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{t('modals.zen.ready')}</span>
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
