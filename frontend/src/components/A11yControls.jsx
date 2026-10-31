import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Type, Contrast, Moon, Languages, Zap, Music, Mic } from 'lucide-react';
import { useLowPower, setLowPower } from '../utils/lowPower';
import { hubziAmbient } from '../utils/hubziAmbient';
import { lobbyAmbient } from '../utils/lobbyAmbient';
import { getVoiceVolume, setVoiceVolume } from '../utils/capyVoice';
import { useTranslation } from 'react-i18next';

/**
 * Controles de accesibilidad: alto contraste y texto grande.
 * Persisten en localStorage (`hubzy_a11y`) y se aplican como clases en
 * <html> — las reglas viven en index.css (a11y-contrast / a11y-large-text).
 */
const KEY = 'hubzy_a11y';

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function applyPrefs(p) {
  const el = document.documentElement;
  el.classList.toggle('a11y-contrast', Boolean(p.contrast));
  el.classList.toggle('a11y-large-text', Boolean(p.largeText));
  el.classList.toggle('dark-mode', Boolean(p.darkMode));
}

// Aplica las preferencias guardadas lo antes posible al montar el módulo.
applyPrefs(readPrefs());

const LANGS = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'pt', label: 'PT' },
];

export default function A11yControls() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(readPrefs);
  const lowPower = useLowPower();
  const [musicVol, setMusicVol] = useState(() => {
    try {
      const v = parseFloat(localStorage.getItem('hubzy_music_vol'));
      return Number.isFinite(v) ? v : 0.8;
    } catch { return 0.8; }
  });
  const [voiceVol, setVoiceVolState] = useState(getVoiceVolume);
  const wrapRef = useRef(null);

  useEffect(() => {
    applyPrefs(prefs);
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const active = Boolean(prefs.contrast || prefs.largeText || prefs.darkMode);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`px-3.5 py-2 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-2 border-[var(--color-arcade-navy-light)] border-b-arcade border-b-[var(--color-arcade-ink)] text-white shadow-btn-arcade active:translate-y-1 active:shadow-none transition-all cursor-pointer ${
          active ? 'ring-2 ring-[var(--color-arcade-cyan)]' : ''
        }`}
        title={t('a11y.title')}
        aria-label={t('a11y.open')}
        aria-expanded={open}
      >
        <Settings className="w-4 h-4 text-[var(--color-arcade-cyan)]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-[110] w-56 max-w-[calc(100vw-1rem)] p-3 rounded-arcade bg-[var(--color-arcade-navy)] border-2 border-[var(--color-arcade-navy-light)] shadow-[0_10px_30px_rgba(0,0,0,0.6)] flex flex-col gap-2"
            role="menu"
            aria-label={t('a11y.open')}
          >
            {[
              {
                key: 'contrast',
                icon: Contrast,
                label: t('a11y.contrast'),
                desc: t('a11y.contrast_d'),
              },
              {
                key: 'largeText',
                icon: Type,
                label: t('a11y.large'),
                desc: t('a11y.large_d'),
              },
              {
                key: 'darkMode',
                icon: Moon,
                label: t('a11y.dark'),
                desc: t('a11y.dark_d'),
              },
            ].map(({ key, icon: Icon, label, desc }) => {
              const on = Boolean(prefs[key]);
              return (
                <button
                  key={key}
                  onClick={() => setPrefs((p) => ({ ...p, [key]: !p[key] }))}
                  role="menuitemcheckbox"
                  aria-checked={on}
                  className={`flex items-center gap-2.5 p-2.5 rounded-arcade-sm border-2 text-left transition-all cursor-pointer ${
                    on
                      ? 'bg-[var(--color-arcade-navy-hover)] border-[var(--color-arcade-cyan)]'
                      : 'bg-[var(--color-arcade-navy-dark)]/60 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${on ? 'text-[var(--color-arcade-cyan)]' : 'text-slate-400'}`}
                  />
                  <span className="flex-1 leading-tight">
                    <span className="block text-[11px] font-black uppercase tracking-wide text-white">
                      {label}
                    </span>
                    <span className="block text-[9px] text-slate-400">{desc}</span>
                  </span>
                  <span
                    className={`w-8 h-4.5 h-[18px] rounded-full border flex items-center px-0.5 transition-colors ${
                      on ? 'bg-emerald-500/80 border-emerald-300 justify-end' : 'bg-slate-700 border-slate-600 justify-start'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full bg-white shadow" />
                  </span>
                </button>
              );
            })}

            {/* Modo ligero — gama baja: apaga efectos pesados. La activación
                manual de música sigue disponible aunque esté encendido. */}
            <button
              onClick={() => setLowPower(!lowPower)}
              role="menuitemcheckbox"
              aria-checked={lowPower}
              className={`flex items-center gap-2.5 p-2.5 rounded-arcade-sm border-2 text-left transition-all cursor-pointer ${
                lowPower
                  ? 'bg-[var(--color-arcade-navy-hover)] border-[var(--color-arcade-cyan)]'
                  : 'bg-[var(--color-arcade-navy-dark)]/60 border-slate-700 hover:border-slate-500'
              }`}
            >
              <Zap className={`w-4 h-4 shrink-0 ${lowPower ? 'text-[var(--color-arcade-cyan)]' : 'text-slate-400'}`} />
              <span className="flex-1 leading-tight">
                <span className="block text-[11px] font-black uppercase tracking-wide text-white">
                  {t('a11y.low_power')}
                </span>
                <span className="block text-[9px] text-slate-400">{t('a11y.low_power_d')}</span>
              </span>
              <span
                className={`w-8 h-[18px] rounded-full border flex items-center px-0.5 transition-colors ${
                  lowPower ? 'bg-emerald-500/80 border-emerald-300 justify-end' : 'bg-slate-700 border-slate-600 justify-start'
                }`}
              >
                <span className="w-3 h-3 rounded-full bg-white shadow" />
              </span>
            </button>

            {/* Volúmenes: música ambiental y voz de Hubzi (persisten) */}
            {[
              {
                key: 'music',
                icon: Music,
                label: t('a11y.music_vol'),
                desc: t('a11y.music_vol_d'),
                value: musicVol,
                onChange: (v) => {
                  setMusicVol(v);
                  hubziAmbient.setVolume(v);
                  lobbyAmbient.setVolume(v);
                },
              },
              {
                key: 'voice',
                icon: Mic,
                label: t('a11y.voice_vol'),
                desc: t('a11y.voice_vol_d'),
                value: voiceVol,
                onChange: (v) => {
                  setVoiceVolState(v);
                  setVoiceVolume(v);
                },
              },
            ].map(({ key, icon: Icon, label, desc, value, onChange }) => (
              <div
                key={key}
                className="flex items-center gap-2.5 p-2.5 rounded-arcade-sm border-2 bg-[var(--color-arcade-navy-dark)]/60 border-slate-700"
              >
                <Icon className="w-4 h-4 shrink-0 text-[var(--color-arcade-cyan)]" />
                <span className="flex-1 leading-tight">
                  <span className="block text-[11px] font-black uppercase tracking-wide text-white">
                    {label}
                  </span>
                  <span className="block text-[9px] text-slate-400">{desc}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    aria-label={label}
                    className="mt-1.5 w-full accent-[var(--color-arcade-cyan)] cursor-pointer"
                  />
                </span>
              </div>
            ))}

            {/* Selector de idioma — persiste en localStorage(hubzy_lang)
                vía el listener de i18n.js */}
            <div
              className="flex items-center gap-2.5 p-2.5 rounded-xl border-2 bg-[var(--color-arcade-navy-dark)]/60 border-slate-700"
              role="radiogroup"
              aria-label={t('a11y.lang')}
            >
              <Languages className="w-4 h-4 shrink-0 text-[var(--color-arcade-cyan)]" />
              <span className="flex-1 leading-tight">
                <span className="block text-[11px] font-black uppercase tracking-wide text-white">
                  {t('a11y.lang')}
                </span>
                <span className="block text-[9px] text-slate-400">{t('a11y.lang_d')}</span>
              </span>
              <span className="flex items-center gap-1">
                {LANGS.map(({ code, label }) => (
                  <button
                    key={code}
                    onClick={() => i18n.changeLanguage(code)}
                    role="radio"
                    aria-checked={i18n.language === code}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border cursor-pointer transition-colors ${
                      i18n.language === code
                        ? 'bg-[var(--color-arcade-cyan)]/90 border-[var(--color-arcade-cyan)] text-[var(--color-arcade-navy-dark)]'
                        : 'bg-slate-800/70 border-slate-600 text-slate-300 hover:text-white hover:border-slate-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
