import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ShieldCheck, FileText, RefreshCw, Cookie, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LegalModal({ isOpen, onClose, initialTab = 'terms' }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        className="relative w-full max-w-lg sm:max-w-2xl bg-[#0c1526] border-2 border-slate-700/70 rounded-arcade-lg shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col text-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0a1424]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-arcade-sm bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white tracking-wide">
                {t('legal.title')}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                {t('legal.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-arcade-sm bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
            title={t('legal.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs (Sin scrollbar nativa fea) */}
        <div className="px-5 pt-3 pb-2 bg-[#08101e]/70 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: 'terms', label: t('legal.tab_terms'), icon: FileText, color: 'text-amber-400' },
              { id: 'privacy', label: t('legal.tab_privacy'), icon: ShieldCheck, color: 'text-emerald-400' },
              { id: 'refunds', label: t('legal.tab_refunds'), icon: RefreshCw, color: 'text-cyan-400' },
              { id: 'cookies', label: t('legal.tab_cookies'), icon: Cookie, color: 'text-purple-400' },
              { id: 'business', label: t('legal.tab_business'), icon: Building2, color: 'text-blue-400' }
            ].map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-arcade-sm text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
                    active
                      ? 'bg-[var(--color-arcade-navy)] text-white border-amber-400/80 shadow-[0_2px_8px_rgba(255,180,0,0.25)]'
                      : 'bg-slate-900/40 text-slate-400 border-slate-800/80 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? tab.color : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area con scrollbar compacta y estilizada */}
        <div className="px-5 py-4 overflow-y-auto space-y-3 text-xs text-slate-300 leading-relaxed max-h-[50vh] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700/60 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-600">
          {activeTab === 'terms' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white">{t('legal.t_title')}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{t('legal.t_sub')}</p>
              </div>
              
              <div className="p-3 rounded-arcade-sm bg-[var(--color-arcade-navy-deep)] border border-slate-800/90">
                <h4 className="font-bold text-amber-300 mb-0.5 text-xs">{t('legal.t1_h')}</h4>
                <p className="text-[11.5px] leading-relaxed text-slate-300">{t('legal.t1_p')}</p>
              </div>

              <div className="p-3 rounded-arcade-sm bg-[var(--color-arcade-navy-deep)] border border-slate-800/90">
                <h4 className="font-bold text-amber-300 mb-0.5 text-xs">{t('legal.t2_h')}</h4>
                <p className="text-[11.5px] leading-relaxed text-slate-300">{t('legal.t2_p')}</p>
              </div>

              <div className="p-3 rounded-arcade-sm bg-[var(--color-arcade-navy-deep)] border border-slate-800/90">
                <h4 className="font-bold text-amber-300 mb-0.5 text-xs">{t('legal.t3_h')}</h4>
                <p className="text-[11.5px] leading-relaxed text-slate-300">{t('legal.t3_p')}</p>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white">{t('legal.p_title')}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{t('legal.p_sub')}</p>
              </div>

              <div className="p-3 rounded-arcade-sm bg-[var(--color-arcade-navy-deep)] border border-slate-800/90">
                <h4 className="font-bold text-emerald-300 mb-0.5 text-xs">{t('legal.p1_h')}</h4>
                <p className="text-[11.5px] leading-relaxed text-slate-300">{t('legal.p1_p')}</p>
              </div>

              <div className="p-3 rounded-arcade-sm bg-[var(--color-arcade-navy-deep)] border border-slate-800/90">
                <h4 className="font-bold text-emerald-300 mb-0.5 text-xs">{t('legal.p2_h')}</h4>
                <p className="text-[11.5px] leading-relaxed text-slate-300">{t('legal.p2_p')}</p>
              </div>

              <div className="p-3 rounded-arcade-sm bg-[var(--color-arcade-navy-deep)] border border-slate-800/90">
                <h4 className="font-bold text-emerald-300 mb-0.5 text-xs">{t('legal.p3_h')}</h4>
                <p className="text-[11.5px] leading-relaxed text-slate-300">{t('legal.p3_p')}</p>
              </div>
            </div>
          )}

          {activeTab === 'refunds' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white">{t('legal.r_title')}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{t('legal.r_sub')} <strong>Stripe</strong>:</p>
              </div>

              <div className="p-3 rounded-arcade-sm bg-[var(--color-arcade-navy-deep)] border border-slate-800/90">
                <h4 className="font-bold text-cyan-300 mb-0.5 text-xs">{t('legal.r1_h')}</h4>
                <p className="text-[11.5px] leading-relaxed text-slate-300">{t('legal.r1_p')}</p>
              </div>

              <div className="p-3 rounded-arcade-sm bg-[var(--color-arcade-navy-deep)] border border-slate-800/90">
                <h4 className="font-bold text-cyan-300 mb-0.5 text-xs">{t('legal.r2_h')}</h4>
                <p className="text-[11.5px] leading-relaxed text-slate-300">{t('legal.r2_p')}</p>
              </div>

              <div className="p-3 rounded-arcade-sm bg-[var(--color-arcade-navy-deep)] border border-slate-800/90">
                <h4 className="font-bold text-cyan-300 mb-0.5 text-xs">{t('legal.r3_h')}</h4>
                <p className="text-[11.5px] leading-relaxed text-slate-300">{t('legal.r3_p')}</p>
              </div>
            </div>
          )}

          {activeTab === 'cookies' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white">{t('legal.c_title')}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{t('legal.c_sub')}</p>
              </div>
              
              <div className="p-3 rounded-arcade-sm bg-[var(--color-arcade-navy-deep)] border border-slate-800/90 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                  <p className="text-[11.5px]"><strong className="text-white">{t('legal.c1')}</strong> {t('legal.c1_p')}</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                  <p className="text-[11.5px]"><strong className="text-white">{t('legal.c2')}</strong> {t('legal.c2_p')}</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                  <p className="text-[11.5px]"><strong className="text-white">{t('legal.c3')}</strong> {t('legal.c3_p')}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'business' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white">{t('legal.b_title')}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{t('legal.b_sub')}</p>
              </div>
              
              <div className="p-3.5 rounded-arcade-sm bg-[var(--color-arcade-navy-deep)] border border-slate-800/90 space-y-1.5 text-[11.5px]">
                <p><strong className="text-white">{t('legal.b_platform')}</strong> Hubzy (Proyecto SynapseHub)</p>
                <p><strong className="text-white">{t('legal.b_operator')}</strong> Grover Choquevillca & Equipo SynapseHub</p>
                <p><strong className="text-white">{t('legal.b_support')}</strong> contacto@hubzy.app</p>
                <p><strong className="text-white">{t('legal.b_gateway')}</strong> Stripe Payments Inc. (Certificación PCI-DSS Nivel 1)</p>
                <p><strong className="text-white">{t('legal.b_jurisdiction')}</strong> {t('legal.b_jurisdiction_p')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-[#0a1424] text-[11px] text-slate-400">
          <span>{t('legal.footer', { year: new Date().getFullYear() })}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-arcade-sm bg-[var(--color-arcade-orange)] hover:bg-[var(--color-arcade-orange-bright)] border-b-arcade-sm border-[var(--color-arcade-orange-shadow)] text-white font-black text-xs uppercase tracking-wider shadow-md active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            {t('legal.ok')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
