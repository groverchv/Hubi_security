import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Wind, ArrowLeft, Play, Check, HeartPulse } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { useCrisis, checkCrisisFlag } from "../lib/crisis.jsx";
import AnimatedCloudsBackground from "../components/AnimatedCloudsBackground";
import A11yControls from "../components/A11yControls";

/**
 * Modo Zen: técnicas de regulación emocional basadas en evidencia.
 * Los protocolos vienen del backend (psychology_service).
 */
export default function ZenPage() {
  const { t } = useTranslation();
  const { reportCrisis } = useCrisis();
  const [protocols, setProtocols] = useState(null);
  const [active, setActive] = useState(null); // {key, ...protocol}
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [checkinText, setCheckinText] = useState("");
  const [checkinResult, setCheckinResult] = useState(null);

  useEffect(() => {
    apiFetch("/api/v1/psychology/protocols")
      .then((data) => setProtocols(data?.protocols || data || {}))
      .catch(() => setProtocols({}));
  }, []);

  const startProtocol = (key, p) => {
    setActive({ key, ...p });
    setStepIdx(0);
    setDone(false);
  };

  const finishProtocol = async () => {
    setDone(true);
    try {
      await apiFetch("/api/v1/zen/log", {
        method: "POST",
        body: { log_type: active.key, duration_seconds: active.duration_seconds || 60 },
      });
    } catch { /* silencioso: no bloquear UX de calma */ }
  };

  const runCheckin = async () => {
    if (!checkinText.trim()) return;
    try {
      const result = await apiFetch("/api/v1/psychology/analyze", {
        method: "POST",
        body: { text: checkinText },
      });
      setCheckinResult(result);
      checkCrisisFlag(result, reportCrisis);
      setCheckinText("");
    } catch (e) {
      setCheckinResult({ empathic_response: e.message });
    }
  };

  const protocolList = protocols ? Object.entries(protocols) : [];

  return (
    <div className="zen-stage min-h-screen w-full bg-gradient-to-b from-indigo-200 via-sky-200 to-emerald-100 font-sans">
      <AnimatedCloudsBackground />

      <header className="relative z-30 flex items-center justify-between px-6 sm:px-10 py-5">
        <Link to="/" className="inline-flex items-center gap-2 rounded-arcade bg-white/70 px-4 py-2 text-sm font-black uppercase text-[var(--color-arcade-navy)] hover:bg-white">
          <ArrowLeft className="w-4 h-4" /> {t("common.back")}
        </Link>
        <A11yControls />
        <Link to="/arena" className="rounded-arcade bg-[var(--color-arcade-navy)] px-4 py-2 text-xs font-black uppercase text-white">
          {t("nav.arena")} →
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-20">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="mx-auto mb-4 inline-flex rounded-full bg-emerald-500/20 p-4">
            <Wind className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-[var(--color-arcade-navy)]">{t("zen.title")}</h1>
          <p className="mt-2 font-semibold text-slate-600">{t("zen.subtitle")}</p>
        </motion.div>

        {/* Check-in emocional */}
        <section className="mt-8 rounded-arcade-lg bg-white/85 p-6 border-b-arcade-xl border-slate-200 shadow-lg">
          <h2 className="flex items-center gap-2 font-black text-[var(--color-arcade-navy)]">
            <HeartPulse className="w-5 h-5 text-rose-500" /> {t("zen.checkin")}
          </h2>
          <div className="mt-3 flex gap-2">
            <input
              value={checkinText}
              onChange={(e) => setCheckinText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runCheckin()}
              placeholder="Ej: Estoy muy nervioso por el examen de mañana…"
              className="flex-1 rounded-arcade border-2 border-slate-200 bg-white px-4 py-3 text-sm font-medium focus:border-emerald-400 focus:outline-none"
              aria-label={t("zen.checkin")}
            />
            <button
              onClick={runCheckin}
              className="rounded-arcade bg-emerald-500 px-5 font-black uppercase text-white text-sm border-b-arcade border-emerald-700 hover:bg-emerald-400"
            >
              OK
            </button>
          </div>
          {checkinResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 rounded-arcade bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"
            >
              {checkinResult.empathic_response}
              {checkinResult.recommended_intervention && protocols?.[checkinResult.recommended_intervention] && (
                <button
                  onClick={() => startProtocol(checkinResult.recommended_intervention, protocols[checkinResult.recommended_intervention])}
                  className="ml-3 inline-flex items-center gap-1 rounded-arcade-sm bg-emerald-500 px-3 py-1.5 text-xs font-black uppercase text-white"
                >
                  <Play className="w-3 h-3" /> {protocols[checkinResult.recommended_intervention].name}
                </button>
              )}
            </motion.div>
          )}
        </section>

        {/* Protocolo activo */}
        <AnimatePresence>
          {active && (
            <motion.section
              className="mt-6 rounded-arcade-lg bg-[var(--color-arcade-navy)] p-8 text-white shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              {!done ? (
                <>
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-300">{active.name}</p>
                  <motion.p
                    key={stepIdx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-5 text-2xl font-bold leading-relaxed min-h-[6rem]"
                  >
                    {active.steps?.[stepIdx]}
                  </motion.p>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      {active.steps?.map((_, i) => (
                        <div key={i} className={`h-2 w-6 rounded-full ${i <= stepIdx ? "bg-emerald-400" : "bg-white/20"}`} />
                      ))}
                    </div>
                    {stepIdx < (active.steps?.length || 1) - 1 ? (
                      <button
                        onClick={() => setStepIdx((s) => s + 1)}
                        className="rounded-arcade bg-emerald-500 px-6 py-3 font-black uppercase text-sm border-b-arcade border-emerald-700"
                      >
                        →
                      </button>
                    ) : (
                      <button
                        onClick={finishProtocol}
                        className="inline-flex items-center gap-2 rounded-arcade bg-emerald-500 px-6 py-3 font-black uppercase text-sm border-b-arcade border-emerald-700"
                      >
                        <Check className="w-4 h-4" /> OK
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <Check className="mx-auto w-12 h-12 text-emerald-400" />
                  <p className="mt-3 text-xl font-bold">Sesión registrada. Respira con calma.</p>
                  <button
                    onClick={() => setActive(null)}
                    className="mt-5 rounded-arcade bg-white/10 px-6 py-3 font-black uppercase text-sm hover:bg-white/20"
                  >
                    {t("common.back")}
                  </button>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Lista de protocolos */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {protocolList.map(([key, p]) => (
            <button
              key={key}
              onClick={() => startProtocol(key, p)}
              className="rounded-arcade-lg bg-white/85 p-5 text-left border-b-arcade-xl border-slate-200 shadow hover:scale-[1.02] transition-transform"
            >
              <h3 className="font-black text-[var(--color-arcade-navy)]">{p.name}</h3>
              <p className="mt-1 text-xs font-semibold text-slate-600 line-clamp-2">{p.objective}</p>
              <p className="mt-2 text-[10px] font-black uppercase text-emerald-600">
                ~{Math.round((p.duration_seconds || 60))}s
              </p>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}
