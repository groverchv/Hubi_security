import React from "react";
import { Lock } from "lucide-react";
import ArcadeNode from "./ArcadeNode";
import { GAME_LEVELS, levelName } from "../utils/gameConfig";
import { useTranslation } from "react-i18next";

/**
 * Consola octogonal 3D del tablero: carcasa decorativa, conexiones de red
 * entre nodos, render de ArcadeNode e indicador de pista.
 */
function BoardConsole({
  boardInfo,
  currentLevel,
  nodes,
  hintNodeId,
  nodeFx,
  hasActiveCard = false, // hay carta seleccionada o en arrastre → affordance de drop
  matchNodeId = null, // id de la casilla compatible con la carta activa (pista sutil)
  dragPreview = null, // { nodeId, correct } — preview del resultado al soltar
  onNodeClick,
}) {
  const { t } = useTranslation();
  const nodeArr = Object.values(nodes);
  const totalNodes = nodeArr.length;

  return (
    <div className="isometric-board-container flex-1 flex items-center justify-center w-full mt-14 mb-1 sm:mb-auto pl-[10%] pr-2 z-10 overflow-visible">
      {/* Panel frontal rectangular (recto, sin tilt 3D ni módulos
          decorativos): marco arcade + pantalla táctica interior. */}
      <div
        className="board-table-3d relative w-[96%] max-w-6xl h-[410px] sm:h-[445px] lg:h-[485px] max-h-[66vh] bg-[#e2e8f0] border-4 border-[#cbd5e1] rounded-arcade-lg p-3 sm:p-4 flex flex-col justify-between"
        style={{
          boxShadow:
            "0 20px 40px -12px rgba(15, 23, 42, 0.35), inset 0 2px 4px rgba(255,255,255,0.9)",
        }}
      >
        {/* Superficie interior del tablero (grid sutil) */}
        <div
          className="absolute inset-2 bg-[#f8fafc] border-2 border-slate-300 rounded-arcade pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.20) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.20) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* ESQUINAS ARCADE — remaches, marcos en L y LEDs de esquina */}
        {[
          { pos: "top-1.5 left-1.5", led: "cyan" },
          { pos: "top-1.5 right-1.5", led: "amber" },
          { pos: "bottom-1.5 left-1.5", led: "amber" },
          { pos: "bottom-1.5 right-1.5", led: "cyan" },
        ].map(({ pos, led }, i) => (
          <div key={i} className={`absolute ${pos} w-5 h-5 pointer-events-none z-10`}>
            {/* Remache */}
            <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 border border-slate-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.7),0_1px_2px_rgba(0,0,0,0.3)] flex items-center justify-center">
              <div className="w-2.5 h-[1.5px] bg-slate-700 rounded-full rotate-45" />
            </div>
            {/* LED de esquina con parpadeo suave */}
            <div
              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                led === "cyan"
                  ? "bg-cyan-400 shadow-[0_0_8px_2px_rgba(34,211,238,0.7)]"
                  : "bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.7)]"
              } animate-pulse`}
              style={{ animationDelay: `${i * 0.7}s` }}
            />
          </div>
        ))}
        {/* Marcos en L de las esquinas interiores */}
        {[
          "top-3 left-3 rounded-tl-xl border-t-2 border-l-2",
          "top-3 right-3 rounded-tr-xl border-t-2 border-r-2",
          "bottom-3 left-3 rounded-bl-xl border-b-2 border-l-2",
          "bottom-3 right-3 rounded-br-xl border-b-2 border-r-2",
        ].map((cls, i) => (
          <div
            key={i}
            className={`absolute w-10 h-10 pointer-events-none z-10 border-[var(--color-arcade-orange)]/70 ${cls}`}
          />
        ))}

        {/* PANTALLA TÁCTICA CON DISTRIBUCIÓN ESPACIAL ABIERTA */}
        <div className="w-full h-full rounded-arcade bg-[#f8fafc]/70 border border-slate-300/80 p-3 sm:p-4 flex flex-col justify-between relative overflow-hidden">


          {/* ÁREA CENTRAL DE NODOS */}
          <div className="relative flex-1 w-full h-full my-2 flex items-center justify-center" role="group" aria-label={t('board.nodes_aria', { done: nodeArr.filter((n) => n.placedCard).length, total: totalNodes })}>
            {/* Conexiones de red con flechas de flujo */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <marker
                  id="arrow-coral"
                  markerWidth="8"
                  markerHeight="8"
                  refX="5"
                  refY="4"
                  orient="auto"
                >
                  <polygon points="0 1, 7 4, 0 7" fill="#ea580c" />
                </marker>
                <marker
                  id="arrow-dark"
                  markerWidth="8"
                  markerHeight="8"
                  refX="5"
                  refY="4"
                  orient="auto"
                >
                  <polygon points="0 1, 7 4, 0 7" fill="#1e293b" />
                </marker>
              </defs>
              {nodeArr.map((node, i) => {
                // Si hay muchos nodos (>8), conectar solo con el siguiente sin cerrar el bucle cruzado del último con el primero
                if (totalNodes > 8 && i === totalNodes - 1) return null;
                const nextNode = nodeArr[(i + 1) % totalNodes];
                if (!node.pos || !nextNode.pos) return null;
                const isEven = i % 2 === 0;
                return (
                  <line
                    key={`line-${node.id}-${nextNode.id}`}
                    x1={node.pos.left}
                    y1={node.pos.top}
                    x2={nextNode.pos.left}
                    y2={nextNode.pos.top}
                    stroke={isEven ? "#ea580c" : "#1e293b"}
                    strokeWidth={totalNodes > 8 ? "2" : "3"}
                    strokeDasharray={totalNodes > 8 ? "4 4" : "none"}
                    strokeLinecap="round"
                    opacity={
                      totalNodes > 8 ? "0.40" : isEven ? "0.85" : "0.75"
                    }
                    markerEnd={
                      isEven ? "url(#arrow-coral)" : "url(#arrow-dark)"
                    }
                  />
                );
              })}
            </svg>

            {/* Render de los Nodos */}
            {nodeArr.map((node) => (
              <div
                key={node.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  top: node.pos?.top || "50%",
                  left: node.pos?.left || "50%",
                }}
              >
                <div className="relative">
                  {node.lockedByOpponent && (
                    <span className="absolute -top-3 -right-3 z-30 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[8px] flex items-center gap-0.5 shadow-md animate-pulse">
                      <Lock className="w-2.5 h-2.5" /> {t('board.rival')}
                    </span>
                  )}

                  {/* Indicador de casilla destino para la pista de 30s */}
                  {hintNodeId === node.id && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-40 px-2.5 py-0.5 rounded-full bg-[var(--color-arcade-yellow)] text-[var(--color-arcade-navy)] font-black text-[9px] uppercase tracking-wider shadow-lg flex items-center gap-1 animate-bounce border-2 border-white">
                      <span>{t('board.place_here')}</span>
                    </div>
                  )}

                  <ArcadeNode
                    id={node.id}
                    icon={node.icon}
                    color={node.color}
                    shape={node.shape}
                    domain={node.domain}
                    theme={node.theme || boardInfo?.theme}
                    index={node.nodeIndex ?? 0}
                    label={node.label}
                    question={node.question}
                    questionLatex={node.questionLatex}
                    hint={node.hint}
                    placedCard={node.placedCard}
                    isOver={dragPreview?.nodeId === node.id}
                    fx={nodeFx?.nodeId === node.id ? nodeFx : null}
                    afford={
                      node.placedCard || dragPreview?.nodeId === node.id
                        ? null
                        : matchNodeId === node.id
                          ? "match"
                          : hasActiveCard
                            ? "open"
                            : null
                    }
                    preview={null}
                    onClick={onNodeClick}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Luces Neón de Piso */}
          <div className="flex items-center justify-center gap-12 mt-1">
            <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-glow-cyan-md animate-pulse" />
            <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-glow-cyan-md animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(BoardConsole);
