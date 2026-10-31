import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from "react-i18next";

/**
 * Coach mark de descubrimiento: burbuja flotante que se muestra UNA sola vez
 * por feature (persistido en localStorage con `hubzy_hint_<id>`).
 * Se auto-descarta a los 9s o al tocar la X.
 *
 * Uso: envolver el elemento objetivo en un contenedor `relative` y renderizar
 * <CoachMark id="school">texto</CoachMark> dentro de él.
 */
export default function CoachMark({ id, children, position = 'bottom' }) {
  const { t } = useTranslation();
  const key = `hubzy_hint_${id}`;
  // La primera vez que se ve el feature el hint aparece; luego nunca más.
  const [show, setShow] = useState(() => {
    try {
      return !localStorage.getItem(key);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, '1');
      } catch {}
      setShow(false);
    }, 9000);
    return () => clearTimeout(t);
  }, [show, key]);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(key, '1');
    } catch {}
    setShow(false);
  };

  const pos =
    position === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
      : 'top-full left-1/2 -translate-x-1/2 mt-2';
  const arrow =
    position === 'top'
      ? 'top-full left-1/2 -translate-x-1/2 border-t-cyan-400/60'
      : 'bottom-full left-1/2 -translate-x-1/2 border-b-cyan-400/60';

  return (
    <motion.div
      initial={{ opacity: 0, y: position === 'top' ? 6 : -6, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      transition={{ type: 'spring', stiffness: 350, damping: 24 }}
      className={`absolute ${pos} z-40 w-60 rounded-arcade-sm bg-[var(--color-arcade-navy-dark)] border-2 border-cyan-400/60 px-3 py-2.5 shadow-[0_10px_30px_rgba(6,182,212,0.3)] pointer-events-auto`}
      role="note"
    >
      <span
        className={`absolute ${arrow} w-0 h-0 border-x-8 border-x-transparent border-b-arcade-2xl ${
          position === 'top' ? 'border-t-8 border-b-0' : ''
        }`}
      />
      <p className="text-[11px] font-bold text-cyan-100 leading-snug pr-4">
        {children}
      </p>
      <button
        onClick={dismiss}
        aria-label={t('hubzi.dismiss')}
        className="absolute top-1.5 right-1.5 p-0.5 text-cyan-300/70 hover:text-cyan-200 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
