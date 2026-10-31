import React from 'react';
import { motion } from 'framer-motion';
import { useLowPower } from '../utils/lowPower';

// Generador de nubes con formas orgánicas estilo cartoon / AWS Card Clash
const CLOUDS_CONFIG = [
  // Capa 1: Nubes lentas y grandes de fondo (profundidad)
  { id: 1, top: '8%', size: 'scale-125', opacity: 0.85, duration: 65, delay: 0, startX: -300 },
  { id: 2, top: '22%', size: 'scale-100', opacity: 0.75, duration: 75, delay: 20, startX: -400 },
  { id: 3, top: '65%', size: 'scale-150', opacity: 0.90, duration: 60, delay: 35, startX: -500 },

  // Capa 2: Nubes medias con velocidad moderada
  { id: 4, top: '35%', size: 'scale-90', opacity: 0.92, duration: 50, delay: 10, startX: -350 },
  { id: 5, top: '48%', size: 'scale-110', opacity: 0.88, duration: 55, delay: 28, startX: -420 },
  { id: 6, top: '78%', size: 'scale-130', opacity: 0.95, duration: 45, delay: 5, startX: -480 },

  // Capa 3: Nubes suaves más rápidas
  { id: 7, top: '14%', size: 'scale-75', opacity: 0.70, duration: 40, delay: 18, startX: -280 },
  { id: 8, top: '85%', size: 'scale-95', opacity: 0.80, duration: 42, delay: 32, startX: -320 },
];

export default function AnimatedCloudsBackground() {
  // Modo ligero: 8 nubes animadas = GPU intensivo en gama baja → no renderizar
  const lowPower = useLowPower();
  // Accesibilidad: respeta prefers-reduced-motion (usuarios con ansiedad/sensibilidad vestibular)
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // En móviles/tablets las nubes a tamaño real tapan el contenido — se apagan
  // en cualquier dispositivo táctil o pantalla chica, sin depender del CSS.
  const isTouchOrSmall =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(pointer: coarse)").matches ||
     window.matchMedia?.("(max-width: 1100px)").matches);

  if (lowPower || isTouchOrSmall) return null;

  return (
    <div className="clouds-bg fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {CLOUDS_CONFIG.map((cloud) => (
        <motion.div
          key={cloud.id}
          className={`absolute flex items-center ${cloud.size}`}
          style={{ top: cloud.top, opacity: cloud.opacity }}
          initial={{ x: '-25vw' }}
          animate={prefersReducedMotion ? { x: '40vw' } : { x: '125vw' }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : {
                  duration: cloud.duration,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: -cloud.delay
                }
          }
        >
          {/* Forma física de Nube Esponjosa (múltiples círculos fusionados con sombra suave 3D) */}
          <div className="relative filter drop-shadow-[0_12px_16px_rgba(18,36,67,0.12)]">
            {/* Núcleo base horizontal */}
            <div className="w-56 h-18 bg-white/95 rounded-full" />
            
            {/* Cúpula central alta */}
            <div className="absolute -top-12 left-14 w-28 h-28 bg-white rounded-full shadow-inner" />
            
            {/* Cúpula izquierda */}
            <div className="absolute -top-7 left-4 w-20 h-20 bg-white/95 rounded-full" />
            
            {/* Cúpula derecha */}
            <div className="absolute -top-9 right-8 w-22 h-22 bg-white/95 rounded-full" />

            {/* Brillo blanco puro superior */}
            <div className="absolute top-2 left-10 w-36 h-4 bg-white/40 rounded-full blur-[2px]" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
