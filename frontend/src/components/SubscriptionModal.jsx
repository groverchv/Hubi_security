import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Crown, 
  Check, 
  Zap, 
  Sparkles, 
  ShieldCheck, 
  X, 
  CreditCard, 
  ExternalLink,
  Flame,
  BookOpen,
  Users
} from 'lucide-react';
import capyAdmin from '../assets/mascots/capy_administradora_f.webp';
import { fetchWithAuth } from '../lib/api';
import { useTranslation } from 'react-i18next';

export default function SubscriptionModal({
  isOpen,
  onClose,
  currentUser,
  onSubscriptionSuccess
}) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const isPro = currentUser?.plan === 'pro';

  const handleStripeCheckout = async () => {
    if (!currentUser?.id) {
      setErrorMsg(t('modals.subscription.err_login'));
      return;
    }
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetchWithAuth('/api/v1/payments/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          email: currentUser.email,
          plan_id: 'pro_monthly',
          success_url: window.location.origin + '/?payment=success',
          cancel_url: window.location.origin + '/?payment=cancelled'
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || t('modals.subscription.err_checkout'));
      }

      const data = await res.json();
      if (data.checkout_url) {
        // Redirige directamente al portal seguro alojado por Stripe
        window.location.href = data.checkout_url;
      } else {
        throw new Error(t('modals.subscription.err_url'));
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || t('modals.subscription.err_conn'));
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md select-none font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-lg rounded-arcade-lg bg-[var(--color-arcade-navy)] border-4 border-[var(--color-arcade-navy-dark)] p-6 sm:p-7 text-white shadow-modal-2xl overflow-hidden"
      >
        {/* Glow dorado de fondo */}
        <div className="absolute inset-0 overflow-hidden rounded-arcade-lg pointer-events-none">
          <div className="absolute -top-24 -right-24 w-52 h-52 bg-[var(--color-arcade-yellow)]/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-[var(--color-arcade-orange)]/15 rounded-full blur-3xl" />
        </div>

        {/* Botón Cerrar (X) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-arcade bg-[var(--color-arcade-navy-dark)] hover:bg-[var(--color-arcade-navy-hover)] border-2 border-[var(--color-arcade-navy-light)] text-slate-300 hover:text-white shadow-hud active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          title={t('modals.subscription.close')}
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Cabecera con Hubzi y Badge Pro */}
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b-arcade-xs border-[var(--color-arcade-navy-light)]">
          <div className="relative w-14 h-14 rounded-arcade overflow-hidden border-3 border-[var(--color-arcade-yellow)] shadow-btn-yellow shrink-0 bg-[var(--color-arcade-navy-dark)]">
            <img src={capyAdmin} alt="Hubzi Pro" className="w-full h-full object-cover scale-105" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[var(--color-arcade-navy-dark)] border-2 border-[var(--color-arcade-yellow)] mb-1">
              <Crown className="w-3.5 h-3.5 text-[var(--color-arcade-yellow)]" />
              <span className="text-[10px] font-black uppercase text-[var(--color-arcade-yellow)] tracking-wider">
                {t('modals.subscription.badge')}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide leading-tight">
              {t('modals.subscription.title')}
            </h2>
          </div>
        </div>

        {/* Cuadro de Precio Accesible para Universitarios */}
        <div className="p-4 rounded-arcade bg-[var(--color-arcade-navy-dark)] border-3 border-[var(--color-arcade-navy-light)] mb-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              {t('modals.subscription.plan_label')}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-3xl sm:text-4xl font-black text-[var(--color-arcade-yellow)] drop-shadow">
                $2.99
              </span>
              <span className="text-xs font-bold text-slate-300">
                {t('modals.subscription.per_month')}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="px-2.5 py-1 rounded-arcade-sm bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-black uppercase text-emerald-300">
              {t('modals.subscription.stripe_safe')}
            </span>
          </div>
        </div>

        {/* Comparativa de Beneficios */}
        <div className="space-y-2.5 mb-6 text-xs font-bold">
          {[
            { text: t('modals.subscription.f1'), highlight: true },
            { text: t('modals.subscription.f2'), highlight: true },
            { text: t('modals.subscription.f3'), highlight: true },
            { text: t('modals.subscription.f4'), highlight: false }
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2.5 text-slate-200">
              <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                item.highlight ? 'bg-[var(--color-arcade-green)] text-white shadow-btn-green-press' : 'bg-[var(--color-arcade-navy-light)] text-cyan-300'
              }`}>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-arcade-sm bg-rose-500/20 border-2 border-rose-500 text-rose-200 text-xs font-bold text-center">
            {errorMsg}
          </div>
        )}

        {/* Botón de Pago con Stripe */}
        {isPro ? (
          <div className="p-3.5 rounded-arcade bg-[var(--color-arcade-green)]/20 border-2 border-[var(--color-arcade-green)] text-center">
            <span className="text-sm font-black text-emerald-300 uppercase tracking-wide flex items-center justify-center gap-2">
              <Check className="w-5 h-5" /> {t('modals.subscription.already')}
            </span>
          </div>
        ) : (
          <button
            type="button"
            disabled={isLoading}
            onClick={handleStripeCheckout}
            className="w-full py-3.5 px-6 rounded-arcade bg-[var(--color-arcade-orange)] hover:bg-[var(--color-arcade-orange-bright)] border-3 border-[var(--color-arcade-navy-dark)] border-b-arcade-lg border-b-[var(--color-arcade-orange-shadow)] text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-btn-arcade-xl active:translate-y-1 active:shadow-none transition-all cursor-pointer disabled:opacity-60"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('modals.subscription.connecting')}</span>
              </div>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                <span>{t('modals.subscription.pay_btn')}</span>
                <ExternalLink className="w-4 h-4 opacity-80" />
              </>
            )}
          </button>
        )}

        {/* Garantía y seguridad */}
        <p className="mt-3 text-[10px] text-center text-slate-400 font-bold flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          {t('modals.subscription.secure_note')}
        </p>
      </motion.div>
    </div>
  );
}
