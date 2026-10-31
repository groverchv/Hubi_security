import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

/**
 * Componente Card terapéutico y arrastrable.
 * Utiliza Framer Motion con drag y retorno elástico suave tipo spring (bajo stiffness).
 */
export default function Card({ id, title, category, description, isPlaced = false, onDragEnd }) {
  return (
    <motion.div
      layoutId={`card-${id}`}
      drag={!isPlaced}
      dragSnapToOrigin={true}
      dragElastic={0.2}
      whileHover={{ scale: isPlaced ? 1 : 1.03, y: isPlaced ? 0 : -3 }}
      whileTap={{ scale: isPlaced ? 1 : 0.98 }}
      whileDrag={{ 
        scale: 1.06, 
        rotate: 2,
        zIndex: 50,
        boxShadow: '0 20px 30px -5px rgba(143, 162, 143, 0.35)'
      }}
      transition={{
        type: 'spring',
        stiffness: 180,
        damping: 22,
        mass: 0.8
      }}
      onDragEnd={(event, info) => {
        if (onDragEnd && !isPlaced) {
          onDragEnd(id, info);
        }
      }}
      className={`relative w-48 sm:w-56 p-4 rounded-arcade-lg bg-white/95 border border-mint/60 shadow-md cursor-grab active:cursor-grabbing select-none backdrop-blur-md transition-colors ${
        isPlaced ? 'opacity-85 border-sage/40 cursor-default' : 'hover:border-sage'
      }`}
    >
      {/* Detalle visual sutil superior */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-mint/40 text-slate-700">
          {category}
        </span>
        <Sparkles className="w-3.5 h-3.5 text-sage opacity-70" />
      </div>

      {/* Título del Concepto */}
      <h3 className="text-base font-bold text-slate-800 tracking-tight leading-snug mb-1.5">
        {title}
      </h3>

      {/* Explicación corta / Pista */}
      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
        {description}
      </p>

      {/* Indicador zen decorativo */}
      <div className="mt-3 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-sage/60" />
        <span className="text-[10px] text-slate-400 font-medium">Arrastra al nodo correspondiente</span>
      </div>
    </motion.div>
  );
}
