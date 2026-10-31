import React from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, CheckCircle2 } from 'lucide-react';
import Card from './Card';

/**
 * Componente Node (Casilla o ranura receptora del diagrama de flujo).
 * Muestra estado vacío con borde punteado suave o la tarjeta colocada.
 */
export default function Node({ id, label, role, expectedCategory, placedCard, isOver = false }) {
  return (
    <div
      data-node-id={id}
      className={`relative w-56 sm:w-64 min-h-[170px] rounded-arcade-lg p-4 transition-all duration-300 flex flex-col justify-between ${
        placedCard
          ? 'bg-mint/20 border-2 border-sage/50 shadow-zen-sm'
          : isOver
          ? 'bg-mint/40 border-2 border-dashed border-sage scale-102 shadow-zen-glow'
          : 'bg-white/60 border-2 border-dashed border-mint/80 hover:border-sage/70 hover:bg-white/80 shadow-sm'
      }`}
    >
      {/* Cabecera del Nodo */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 py-0.5 rounded-full bg-oat/50">
          {role}
        </span>
        {placedCard ? (
          <CheckCircle2 className="w-4 h-4 text-sage" />
        ) : (
          <HelpCircle className="w-4 h-4 text-slate-400" />
        )}
      </div>

      {/* Contenido Central: o la carta insertada, o el placeholder zen */}
      <div className="flex-1 flex flex-col items-center justify-center text-center my-1">
        {placedCard ? (
          <div className="w-full">
            <Card
              id={placedCard.id}
              title={placedCard.title}
              category={placedCard.category}
              description={placedCard.description}
              isPlaced={true}
            />
          </div>
        ) : (
          <motion.div
            animate={{ opacity: [0.6, 0.9, 0.6] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-1.5 p-2"
          >
            <div className="w-9 h-9 rounded-arcade bg-mint/30 flex items-center justify-center text-sage">
              <span className="text-sm font-semibold">{id}</span>
            </div>
            <p className="text-xs font-medium text-slate-600">{label}</p>
            <span className="text-[10px] text-slate-400">
              Esperando: <strong className="text-slate-500">{expectedCategory}</strong>
            </span>
          </motion.div>
        )}
      </div>

      {/* Pie del nodo con borde visual sutil */}
      <div className="mt-1 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] text-slate-400">
        <span>Conexión neuronal</span>
        <span className={`w-2 h-2 rounded-full ${placedCard ? 'bg-sage' : 'bg-mint'}`} />
      </div>
    </div>
  );
}
