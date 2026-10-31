import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, Check, Shield } from 'lucide-react';
import { useTranslation } from "react-i18next";

export default function CookieConsentBanner({ onOpenLegal }) {
  const { t } = useTranslation();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('hubzy_cookie_consent');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('hubzy_cookie_consent', 'accepted');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 p-4 rounded-arcade-lg bg-slate-900/95 border border-slate-700/80 shadow-[0_10px_35px_rgba(0,0,0,0.7)] backdrop-blur-md text-slate-200 text-xs font-sans"
      >
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-arcade bg-orange-500/20 border border-orange-400/30 text-orange-400 flex-shrink-0">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1.5">
            <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
              <span>{t('cookies.title')}</span>
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
            </h4>
            <p className="text-slate-300 leading-relaxed text-[11.5px]">
              {t('cookies.body')}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleAccept}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-arcade-sm bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-md shadow-orange-500/20"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t('cookies.accept')}</span>
              </button>
              <button
                onClick={() => onOpenLegal && onOpenLegal('privacy')}
                className="px-3 py-1.5 text-slate-400 hover:text-orange-300 underline text-[11px] transition-colors"
              >
                {t('cookies.policies')}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
