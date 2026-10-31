import React from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Sparkles, 
  ArrowRight, 
  RotateCcw, 
  CheckCircle2, 
  Flame, 
  Star,
  Target,
  Zap,
  BookOpen,
  Crown,
  AlertTriangle,
  Map
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { isLowPower } from '../utils/lowPower';
import capyEscolar from '../assets/mascots/capy_escolar_nino_m.webp';
import { useTranslation } from 'react-i18next';

export default function VictoryModal({
  isOpen,
  level = 1,
  accuracy = 100,
  totalQuestions = 5,
  streak = 0,
  campaignCompleted = false,
  weakNodes = [],
  masteredConcepts = [],
  firstTry = null,
  onNextLevel,
  onRetry,
  onGoToMenu
}) {
  const { t } = useTranslation();
  const [showSummary, setShowSummary] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  React.useEffect(() => {
    if (isOpen && !isLowPower()) {
      try {
        confetti({
          particleCount: campaignCompleted ? 220 : 80,
          spread: campaignCompleted ? 110 : 70,
          origin: { y: 0.6 },
          // canvas fillStyle no resuelve var() — hex literales requeridos
          colors: ['#FF7A00', '#48C838', '#FFB400', '#1C8FE8']
        });
      } catch {}
    }
  }, [isOpen, campaignCompleted]);

  if (!isOpen) return null;

  const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none font-sans"
      role="dialog"
      aria-modal="true"
      aria-label={campaignCompleted ? t('modals.victory.aria_boss') : t('modals.victory.aria_level', { level })}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 30 }}
        transition={{ type: 'spring', stiffness: 320, damping: 25 }}
        className="stage-modal-panel relative w-full max-w-md rounded-arcade-lg bg-[var(--color-arcade-navy)] border-4 border-[var(--color-arcade-navy-dark)] p-6 sm:p-7 text-white shadow-modal-xl flex flex-col items-center text-center overflow-y-auto max-h-[94dvh]"
      >
        {/* Glow de fondo — recortado al panel para no crear área deslizable */}
        <div className="absolute inset-0 overflow-hidden rounded-arcade-lg pointer-events-none">
          <div className="absolute -top-16 -right-16 w-44 h-44 bg-[var(--color-arcade-yellow)]/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-[var(--color-arcade-green)]/20 rounded-full blur-3xl" />
        </div>

        {/* Badge superior Arcade */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-arcade-navy-dark)] border-2 border-[var(--color-arcade-navy-light)] mb-3">
          {campaignCompleted
            ? <Crown className="w-4 h-4 text-[var(--color-arcade-yellow)] animate-bounce" />
            : <Trophy className="w-4 h-4 text-[var(--color-arcade-yellow)] animate-bounce" />}
          <span className="text-[10px] font-black uppercase text-[var(--color-arcade-yellow)] tracking-wider">
            {campaignCompleted ? t('modals.victory.boss_badge') : t('modals.victory.level_badge', { level })}
          </span>
        </div>

        {/* Título de Victoria */}
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide drop-shadow mb-1">
          {campaignCompleted ? t('modals.victory.title_campaign') : t('modals.victory.title_normal')}
        </h2>
        <p className="text-xs text-slate-300 font-bold mb-4">
{campaignCompleted ? t('modals.victory.sub_campaign') : t('modals.victory.sub_normal')}
        </p>

        {/* Estrellas de Recompensa */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {[1, 2, 3].map((starIdx) => {
            const isEarned = starIdx <= stars;
            return (
              <motion.div
                key={starIdx}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: starIdx * 0.15, type: 'spring', stiffness: 400 }}
                className={`p-2 rounded-arcade border-3 shadow-md ${
                  isEarned
                    ? 'bg-[var(--color-arcade-yellow)] border-[var(--color-arcade-navy-dark)] text-[var(--color-arcade-navy)] shadow-btn-yellow'
                    : 'bg-[var(--color-arcade-navy-dark)] border-[var(--color-arcade-navy-light)] text-slate-600'
                }`}
              >
                <Star className={`w-8 h-8 ${isEarned ? 'fill-current stroke-[2]' : 'stroke-[1.5]'}`} />
              </motion.div>
            );
          })}
        </div>

        {/* Indicador de Desbloqueo (Mínimo 2 estrellas) */}
        <div className={`w-full py-1.5 px-3 rounded-arcade-sm text-xs font-black uppercase tracking-wide mb-4 flex items-center justify-center gap-1.5 ${
          stars >= 2 
            ? 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-300' 
            : 'bg-rose-950/80 border border-rose-500/60 text-rose-300'
        }`}>
          {stars >= 2 
            ? <><CheckCircle2 className="w-4 h-4" /> ¡Nivel Superado! (Mínimo 2<Star className="w-3 h-3 inline-block fill-current align-[-1px]" /> conseguidas)</>
            : <><AlertTriangle className="w-4 h-4" /> Necesitas mínimo 2<Star className="w-3 h-3 inline-block fill-current align-[-1px]" /> para desbloquear el siguiente nivel</>}
        </div>

        {/* Estadísticas de la Ronda */}
        <div className="grid grid-cols-3 gap-2.5 w-full p-3 rounded-arcade bg-[var(--color-arcade-navy-dark)] border-3 border-[var(--color-arcade-navy-light)] mb-5">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">
              <Target className="w-3.5 h-3.5 text-[var(--color-arcade-cyan)]" />
              <span>{t('modals.victory.st_accuracy')}</span>
            </div>
            <span className="text-lg font-black text-[var(--color-arcade-green)] mt-0.5">{accuracy}%</span>
          </div>

          <div className="flex flex-col items-center border-x-2 border-[var(--color-arcade-navy-light)]">
            <div className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-arcade-orange)]" />
              <span>{t('modals.victory.st_items')}</span>
            </div>
            <span className="text-lg font-black text-white mt-0.5">{totalQuestions}</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">
              <Flame className="w-3.5 h-3.5 text-[var(--color-arcade-yellow)]" />
              <span>{t('modals.victory.st_streak')}</span>
            </div>
            <span className="text-lg font-black text-[var(--color-arcade-yellow)] mt-0.5">X{streak}</span>
          </div>
        </div>

        {/* Detalles de la ronda — colapsados: el resumen solo muestra lo esencial */}
        <button
          type="button"
          onClick={() => setShowDetails(prev => !prev)}
          className="w-full mb-4 py-2 px-3 rounded-arcade-sm bg-[var(--color-arcade-navy-dark)] hover:bg-[#152747] border border-[var(--color-arcade-navy-light)] text-[11px] font-black text-cyan-300 uppercase tracking-wider flex items-center justify-between cursor-pointer transition-colors"
        >
          <span>{t('modals.victory.details')}</span>
          <span className="text-xs text-slate-400">{t(showDetails ? 'modals.victory.hide' : 'modals.victory.show')}</span>
        </button>

        {showDetails && (<>
        {/* Lo que dominaste a la primera — métrica positiva antes que el error */}
        {firstTry !== null && totalQuestions > 0 && (
          <p className="w-full text-left text-[11px] font-bold text-emerald-300/90 -mt-1 mb-3 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            {t('modals.victory.first_try', { done: firstTry, total: totalQuestions })}
            {firstTry === totalQuestions ? t('modals.victory.first_try_perfect') : ''}
          </p>
        )}

        {/* Temas por repasar — cierra el loop pedagógico con honestidad */}
        {weakNodes.length > 0 && (
          <div className="w-full p-3 rounded-arcade bg-amber-950/40 border-2 border-amber-500/40 mb-4 text-left">
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-300 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> {t('modals.victory.review')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {weakNodes.slice(0, 6).map((label, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-lg bg-[var(--color-arcade-navy-dark)] border border-amber-500/30 text-[10px] font-bold text-amber-200"
                >
                  {label}
                </span>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 mt-1.5">
              {t('modals.victory.review_hint')}
            </p>
          </div>
        )}

        {/* Micro-evaluación de Alivio Emocional / Estrés (KPI Central del MVP) */}
        <div className="w-full p-3 rounded-arcade bg-[var(--color-arcade-navy-dark)] border-2 border-[var(--color-arcade-navy-light)] mb-4 text-center">
          <p className="text-[11px] font-black uppercase tracking-wide text-cyan-300 mb-2">
            {t('modals.victory.calm_q')}
          </p>
          <div className="flex items-center justify-between gap-1 px-1">
            {[
              { val: 1, label: t('modals.victory.calm_1') },
              { val: 2, label: t('modals.victory.calm_2') },
              { val: 3, label: t('modals.victory.calm_3') },
              { val: 4, label: t('modals.victory.calm_4') },
              { val: 5, label: t('modals.victory.calm_5') }
            ].map(item => (
              <button
                key={item.val}
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem('hubzy_last_stress_score', item.val);
                  } catch {}
                }}
                className="flex-1 py-1.5 px-1 rounded-arcade-sm bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-yellow)] hover:text-[var(--color-arcade-navy)] border border-[var(--color-arcade-navy-light)] text-[10px] font-black transition-all cursor-pointer text-slate-200"
                title={item.label}
              >
                <span className="inline-flex items-center gap-0.5">{item.val}<Star className="w-2.5 h-2.5 fill-current" /></span>
              </button>
            ))}
          </div>
        </div>

        {/* Mensaje de Capibara Acompañante */}
        <div className="flex items-center gap-3 w-full p-3 rounded-arcade bg-[var(--color-arcade-navy-hover)]/60 border-2 border-[var(--color-arcade-navy-light)] mb-3 text-left">
          <div className="w-11 h-11 rounded-arcade-sm overflow-hidden border-2 border-[var(--color-arcade-yellow)] shrink-0 bg-[var(--color-arcade-navy-dark)]">
            <img src={capyEscolar} alt="Hubzi" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-[var(--color-arcade-yellow)] tracking-wide flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[var(--color-arcade-yellow)]" /> {t('modals.victory.hubzi_says')}
            </p>
            <p className="text-xs text-slate-200 font-bold leading-tight mt-0.5">
              "{t(stars === 3 ? 'modals.victory.quote_3' : 'modals.victory.quote_n')}"
            </p>
          </div>
        </div>

        {/* Resumen / Glosario de Aprendizaje del Nivel */}
        {masteredConcepts && masteredConcepts.length > 0 && (
          <div className="w-full mb-4">
            <button
              type="button"
              onClick={() => setShowSummary(prev => !prev)}
              className="w-full py-2 px-3 rounded-arcade-sm bg-[var(--color-arcade-navy-dark)] hover:bg-[#152747] border border-[var(--color-arcade-navy-light)] text-[11px] font-black text-[var(--color-arcade-yellow)] uppercase tracking-wider flex items-center justify-between cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[var(--color-arcade-yellow)]" />
                {t('modals.victory.glossary', { count: masteredConcepts.length })}
              </span>
              <span className="text-xs text-slate-400">{t(showSummary ? 'modals.victory.hide' : 'modals.victory.show')}</span>
            </button>

            {showSummary && (
              <div className="mt-2 p-2.5 rounded-arcade-sm bg-[#081224] border border-[var(--color-arcade-navy-light)] max-h-44 overflow-y-auto space-y-2 text-left">
                {masteredConcepts.map((item, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-[#0e1e38] border border-slate-700/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-[var(--color-arcade-green)] uppercase">
                        {item.name || item.concept_name || item.label}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-cyan-300"><CheckCircle2 className="w-2.5 h-2.5" /> {t('modals.victory.mastered')}</span>
                    </div>
                    {item.content && (
                      <p className="text-[10px] text-slate-300 mt-0.5 leading-snug">
                        {item.content}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </>)}

        {/* Botones de Acción Estilo Card Clash */}
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2 w-full">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex-1 py-3 px-3 rounded-arcade bg-[var(--color-arcade-navy-dark)] hover:bg-[#162a4d] border-2 border-[var(--color-arcade-navy-light)] border-b-arcade border-b-[var(--color-arcade-ink)] text-slate-200 font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-hud active:translate-y-1 active:shadow-none"
              >
                <RotateCcw className="w-4 h-4 text-[var(--color-arcade-orange)]" />
                <span>{t('modals.victory.btn_retry')}</span>
              </button>
            )}

            {onGoToMenu && (
              <button
                onClick={onGoToMenu}
                className="flex-1 py-3 px-3 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-2 border-[var(--color-arcade-navy-light)] border-b-arcade border-b-[var(--color-arcade-ink)] text-[var(--color-arcade-yellow)] font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-hud active:translate-y-1 active:shadow-none"
              >
                <Map className="w-4 h-4" />
                <span>{t('modals.victory.btn_menu')}</span>
              </button>
            )}
          </div>

          {onNextLevel && stars >= 2 && (
            <button
              onClick={onNextLevel}
              className="w-full py-3.5 px-4 rounded-arcade bg-[var(--color-arcade-green)] hover:bg-[#57d847] border-2 border-[var(--color-arcade-green-light)] border-b-arcade border-b-[var(--color-arcade-green-shadow)] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-btn-arcade active:translate-y-1 active:shadow-none"
            >
              <span>{t('modals.victory.btn_next')}</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
