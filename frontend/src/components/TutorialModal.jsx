import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Compass, 
  Layers, 
  Target, 
  Sparkles, 
  ArrowRight, 
  Check, 
  HelpCircle,
  X
} from 'lucide-react';
import capyProfesor from '../assets/mascots/capy_profesor_m.webp';
import { useTranslation } from "react-i18next";

const TUTORIAL_STEPS = [
  {
    step: 1,
    title: 'modals.tutorial.s1_t',
    icon: Layers,
    iconColor: 'text-[var(--color-arcade-orange)]',
    desc: 'modals.tutorial.s1_d',
    tip: 'modals.tutorial.s1_tip'
  },
  {
    step: 2,
    title: 'modals.tutorial.s2_t',
    icon: Target,
    iconColor: 'text-[var(--color-arcade-green)]',
    desc: 'modals.tutorial.s2_d',
    tip: 'modals.tutorial.s2_tip'
  },
  {
    step: 3,
    title: 'modals.tutorial.s3_t',
    icon: Sparkles,
    iconColor: 'text-[var(--color-arcade-yellow)]',
    desc: 'modals.tutorial.s3_d',
    tip: 'modals.tutorial.s3_tip'
  }
];

export default function TutorialModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const current = TUTORIAL_STEPS[currentStep];
  const StepIcon = current.icon;
  const isLast = currentStep === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
      setCurrentStep(0);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 25 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 25 }}
        transition={{ type: 'spring', stiffness: 320, damping: 25 }}
        className="relative w-full max-w-md rounded-arcade-lg bg-[var(--color-arcade-navy)] border-4 border-[var(--color-arcade-navy-dark)] p-6 sm:p-7 text-white shadow-modal-xl flex flex-col text-left overflow-hidden"
      >
        {/* Botón cerrar esquina */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-arcade-sm bg-[var(--color-arcade-navy-dark)] border-2 border-[var(--color-arcade-navy-light)] text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header con Capibara Tutor */}
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b-arcade-xs border-[var(--color-arcade-navy-light)]">
          <div className="w-13 h-13 rounded-arcade overflow-hidden border-3 border-[var(--color-arcade-yellow)] shrink-0 bg-[var(--color-arcade-navy-dark)] shadow-btn-yellow-press">
            <img src={capyProfesor} alt="Hubzi Tutor" className="w-full h-full object-cover scale-105" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-[var(--color-arcade-yellow)] tracking-wider flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-[var(--color-arcade-yellow)]" /> {t('modals.tutorial.badge')}
            </span>
            <h2 className="text-xl font-black text-white tracking-wide mt-0.5">
              {t('modals.tutorial.title')}
            </h2>
          </div>
        </div>

        {/* Paso Actual */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18 }}
            className="space-y-4 mb-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-arcade bg-[var(--color-arcade-navy-dark)] border-3 border-[var(--color-arcade-navy-light)] flex items-center justify-center shadow-md">
                <StepIcon className={`w-6 h-6 ${current.iconColor}`} />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  {t(current.title)}
                </h3>
                <span className="text-[10px] font-black uppercase text-slate-400">
                  {t('modals.tutorial.step_of', { n: currentStep + 1, total: TUTORIAL_STEPS.length })}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed font-bold">
              {t(current.desc)}
            </p>

            <div className="p-3 rounded-arcade bg-[var(--color-arcade-navy-dark)] border-2 border-[var(--color-arcade-navy-light)] flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[var(--color-arcade-yellow)] shrink-0" />
              <p className="text-[11px] text-amber-200/90 font-bold leading-tight">
                {t(current.tip)}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Barra de progreso de pasos y botón de avance */}
        <div className="flex items-center justify-between pt-2 border-t-2 border-[var(--color-arcade-navy-light)]">
          <div className="flex items-center gap-1.5">
            {TUTORIAL_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? 'w-6 bg-[var(--color-arcade-orange)]'
                    : i < currentStep
                    ? 'w-2 bg-[var(--color-arcade-green)]'
                    : 'w-2 bg-[var(--color-arcade-navy-light)]'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="py-2.5 px-5 rounded-arcade bg-[var(--color-arcade-orange)] hover:bg-[var(--color-arcade-orange-bright)] border-2 border-[var(--color-arcade-orange-light)] border-b-arcade border-b-[var(--color-arcade-orange-shadow)] text-white font-black text-xs uppercase tracking-wide flex items-center gap-2 shadow-btn-arcade active:translate-y-1 active:shadow-none transition-all cursor-pointer"
          >
            <span>{isLast ? t('modals.tutorial.start') : t('modals.tutorial.next')}</span>
            {isLast ? <Check className="w-4 h-4 stroke-[3]" /> : <ArrowRight className="w-4 h-4 stroke-[3]" />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
