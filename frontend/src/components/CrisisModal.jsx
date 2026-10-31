import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeartHandshake, Phone, ShieldAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Protocolo de crisis: se muestra cuando el NLP clínico detecta riesgo
 * (ideación autolítica, pánico severo). Ofrece recursos reales de ayuda.
 */
export default function CrisisModal({ isOpen, onClose, resources = [] }) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-modal="true"
          aria-label={t("crisis.title")}
        >
          <motion.div
            className="w-full max-w-md rounded-arcade-lg bg-white shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
          >
            <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-5 text-white">
              <div className="flex items-center gap-3">
                <HeartHandshake className="w-8 h-8 shrink-0" />
                <h2 className="text-xl font-bold">{t("crisis.title")}</h2>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-slate-700 leading-relaxed">{t("crisis.body")}</p>

              {resources.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> {t("crisis.resources_title")}
                  </h3>
                  <ul className="space-y-2">
                    {resources.map((r, i) => (
                      <li key={i} className="rounded-arcade-sm border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800 text-sm">{r.name}</span>
                          {r.phone && (
                            <a
                              href={`tel:${r.phone}`}
                              className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-sm font-bold text-rose-700 hover:bg-rose-200"
                            >
                              <Phone className="w-3.5 h-3.5" /> {r.phone}
                            </a>
                          )}
                        </div>
                        {r.detail && <p className="mt-1 text-xs text-slate-600">{r.detail}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full rounded-arcade bg-slate-800 px-4 py-3 font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                {t("crisis.continue")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
