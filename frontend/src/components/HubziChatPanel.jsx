import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Chat visible de Hubzi (Fase 3.1): el historial de la conversación
 * (user / capi) deja de ser efímero — panel tipo bottom-sheet que se
 * abre desde el botón de chat junto a Hubzi.
 */
export default function HubziChatPanel({
  open,
  messages = [],
  onClose,
  compact = false,
  username = null,
}) {
  const { t } = useTranslation();
  username = username || t('hubzi.chat_you');
  const listRef = useRef(null);

  // Auto-scroll al último mensaje cuando llega uno nuevo o se abre.
  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages.length]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          role="dialog"
          aria-label={t('hubzi.chat_aria')}
          className={`fixed z-[65] flex flex-col rounded-arcade bg-slate-900/97 border-2 border-cyan-400/70 shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-md overflow-hidden ${
            compact
              ? "left-1/2 -translate-x-1/2 bottom-[126px] w-[92vw] max-w-sm max-h-[42vh]"
              : "left-2 sm:left-4 bottom-[230px] w-72 sm:w-80 max-h-[46vh]"
          }`}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-slate-950/60 shrink-0">
            <span className="text-[9px] font-black uppercase tracking-widest text-cyan-300 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              {t('hubzi.chat_title')}
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label={t('hubzi.chat_close')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            ref={listRef}
            className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 flex flex-col gap-1.5"
          >
            {messages.length === 0 && (
              <p className="text-[10px] text-slate-500 text-center py-4 leading-snug">
{t('hubzi.chat_empty')}
              </p>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div
                  key={i}
                  className="self-end max-w-[85%] px-2.5 py-1.5 rounded-arcade rounded-br-sm bg-cyan-600/80 text-white text-[10px] font-semibold leading-snug"
                >
                  {m.text}
                </div>
              ) : (
                <div
                  key={i}
                  className="self-start max-w-[85%] flex items-start gap-1.5"
                >
                  <span className="w-5 h-5 rounded-full bg-amber-400/20 border border-amber-400/60 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                  </span>
                  <p className="px-2.5 py-1.5 rounded-arcade rounded-bl-sm bg-slate-800/90 text-slate-100 text-[10px] font-medium leading-snug border border-white/10">
                    {m.text}
                  </p>
                </div>
              ),
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
