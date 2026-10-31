import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BookOpen, Swords, Wind, ArrowRight, HeartHandshake, GraduationCap, Crown, Check, School, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import AnimatedCloudsBackground from "../components/AnimatedCloudsBackground";
import A11yControls from "../components/A11yControls";
import SubscriptionModal from "../components/SubscriptionModal";
import { useAuthStore } from "../store/authStore";

// Mascotas Oficiales desde src/assets/mascots
import capyEscolar from "../assets/mascots/capy_escolar_nino_m.webp";
import capyMedica from "../assets/mascots/capy_medica_f.webp";
import capyProgramador from "../assets/mascots/capy_programador_m.webp";
import capyAbogada from "../assets/mascots/capy_abogada_f.webp";
import capyAdmin from "../assets/mascots/capy_administradora_f.webp";
import capyProfesor from "../assets/mascots/capy_profesor_m.webp";

const SHOWCASE_MASCOTS = [
  { image: capyEscolar, name: "Hubzi Estudiante", role: "Colegio & Bachillerato", color: "from-amber-400 to-orange-500", border: "var(--color-arcade-orange)" },
  { image: capyMedica, name: "Dra. Hubzi", role: "Medicina & Salud", color: "from-emerald-400 to-teal-500", border: "#10b981" },
  { image: capyProgramador, name: "Hubzi Dev", role: "Sistemas & Programación", color: "from-cyan-400 to-blue-600", border: "var(--color-sky-400)" },
  { image: capyAbogada, name: "Dra. Hubzi Jurista", role: "Derecho & Leyes", color: "from-purple-400 to-indigo-600", border: "#a855f7" },
  { image: capyAdmin, name: "Lic. Hubzi Admin", role: "Administración & Negocios", color: "from-orange-400 to-rose-500", border: "#f43f5e" },
  { image: capyProfesor, name: "Prof. Hubzi", role: "Docencia & Humanidades", color: "from-amber-400 to-yellow-600", border: "#f59e0b" }
];

const FEATURES = [
  { icon: BookOpen, titleKey: "landing.feature_1_title", descKey: "landing.feature_1_desc" },
  { icon: Swords, titleKey: "landing.feature_2_title", descKey: "landing.feature_2_desc" },
  { icon: Wind, titleKey: "landing.feature_3_title", descKey: "landing.feature_3_desc" },
];

export default function LandingPage() {
  const { t } = useTranslation();
  const [selectedMascotIndex, setSelectedMascotIndex] = useState(0);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isPro = user?.plan === 'pro' || user?.plan === 'school';
  const activeMascot = SHOWCASE_MASCOTS[selectedMascotIndex];

  useEffect(() => {
    if (!isPlansOpen) return;
    const onKey = (e) => e.key === "Escape" && setIsPlansOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPlansOpen]);
  const nextMascot = () => setSelectedMascotIndex((i) => (i + 1) % SHOWCASE_MASCOTS.length);
  const prevMascot = () => setSelectedMascotIndex((i) => (i - 1 + SHOWCASE_MASCOTS.length) % SHOWCASE_MASCOTS.length);

  // Última palabra del título en color de acento ("...EN UN JUEGO")
  const heroWords = t("landing.hero_title").split(" ");
  const heroHead = heroWords.slice(0, -1).join(" ");
  const heroTail = heroWords[heroWords.length - 1];

  const planCheck = (cls, iconCls) => (
    <div className={`w-4 h-4 rounded-md ${cls} flex items-center justify-center shrink-0`}>
      <Check className={`w-3 h-3 stroke-[3] ${iconCls || ""}`} />
    </div>
  );
  const freeCheck = planCheck("bg-emerald-100 text-emerald-600", "");
  const freeDimCheck = (
    <div className="w-4 h-4 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
      <Check className="w-3 h-3 stroke-[2]" />
    </div>
  );
  const proCheck = planCheck("bg-[var(--color-arcade-green)] text-white shadow-btn-green-press", "");
  const schoolCheck = planCheck("bg-emerald-400 text-emerald-950", "");

  return (
    <div className="landing-stage h-[100dvh] w-full overflow-hidden flex flex-col bg-gradient-to-b from-sky-300 via-sky-200 to-emerald-100 font-sans">
      <AnimatedCloudsBackground />

      {/* Nav */}
      <header className="relative z-30 flex items-center justify-between px-6 sm:px-10 py-3 xl:py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xl xl:text-2xl font-black uppercase tracking-wider text-[var(--color-arcade-navy)]">Hubzi</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPlansOpen(true)}
            className="rounded-arcade bg-white/80 hover:bg-white px-3.5 py-1.5 text-xs font-black uppercase text-[var(--color-arcade-navy)] border-2 border-slate-300 hover:border-[var(--color-arcade-navy)] transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Crown className="w-4 h-4 text-amber-500 fill-current" />
            <span>{t("nav.plans")}</span>
          </button>
          <A11yControls />
          <Link
            to="/arena"
            className="rounded-arcade bg-[var(--color-arcade-navy)] px-5 py-1.5 text-xs font-black uppercase text-white border-b-arcade border-[var(--color-arcade-ink)] hover:bg-[var(--color-arcade-navy-hover)] transition-colors shadow-md"
          >
            {t("auth.login")}
          </Link>
        </div>
      </header>

      {/* Contenido de una sola pantalla — si el contenido excede el alto
          disponible, el scroll queda dentro de este contenedor */}
      <main className="relative z-10 mx-auto w-full max-w-[1600px] flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 pt-1 pb-3 text-center flex flex-col">
        <div className="my-auto w-full">
        {/* Hero: información a la izquierda (~70%), mascota a la derecha (~30%) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 text-center"
          >
            <div className="mb-2.5 inline-flex items-center gap-2 rounded-full bg-[var(--color-arcade-navy)] px-4 py-1 text-[11px] xl:text-xs font-black uppercase tracking-widest text-[var(--color-arcade-yellow)] shadow-md">
              <Sparkles className="w-3.5 h-3.5" /> {t("app.tagline")}
            </div>

            <h1 className="text-3xl sm:text-5xl xl:text-6xl font-black uppercase leading-tight text-[var(--color-arcade-navy)] drop-shadow-sm">
              {heroHead}{" "}
              <span className="text-[var(--color-arcade-orange)] drop-shadow-sm">{heroTail}</span>
            </h1>
            <p className="mx-auto mt-2.5 max-w-3xl text-sm sm:text-base xl:text-lg font-semibold text-slate-700">
              {t("landing.hero_subtitle")}
            </p>

            <div className="mt-4 xl:mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/arena"
                className="group inline-flex items-center gap-2 rounded-arcade-lg bg-[var(--color-arcade-orange)] px-7 py-3 xl:px-9 xl:py-4 text-base xl:text-lg font-black uppercase text-white border-b-arcade-xl border-[var(--color-arcade-orange-shadow)] shadow-xl hover:scale-[1.03] active:scale-95 transition-transform cursor-pointer"
              >
                {isPro ? t("landing.cta_pro") : t("landing.cta_start")}
                {isPro ? (
                  <Crown className="w-5 h-5 text-[var(--color-arcade-yellow)] fill-[var(--color-arcade-yellow)]" />
                ) : (
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                )}
              </Link>
              <Link
                to="/zen"
                className="inline-flex items-center gap-2 rounded-arcade-lg bg-white/80 px-7 py-3 xl:px-9 xl:py-4 text-base xl:text-lg font-black uppercase text-[var(--color-arcade-navy)] border-b-arcade-xl border-slate-300 hover:bg-white transition-colors cursor-pointer shadow-md"
              >
                <Wind className="w-5 h-5" /> {t("nav.zen")}
              </Link>
            </div>
          </motion.div>

          {/* Showcase de Mascota (~30% derecha) con anterior/siguiente */}
          <div className="w-full sm:w-auto flex flex-col items-center shrink-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-arcade-navy)] text-white text-[10px] xl:text-xs font-black uppercase tracking-wider shadow-md mb-2 xl:mb-3">
              <GraduationCap className="w-3.5 h-3.5 text-[var(--color-arcade-yellow)]" />
              <span>Compañeros Hubzi</span>
            </div>
            <div className="flex items-center gap-2 xl:gap-3">
              <button
                type="button"
                onClick={prevMascot}
                aria-label="Mascota anterior"
                className="w-9 h-9 xl:w-11 xl:h-11 rounded-full bg-[var(--color-arcade-navy)] text-white flex items-center justify-center border-b-arcade border-[var(--color-arcade-ink)] shadow-md hover:scale-105 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5 xl:w-6 xl:h-6" />
              </button>
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
                className="flex flex-col items-center"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeMascot.name}
                    initial={{ opacity: 0, scale: 0.9, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: -20 }}
                    transition={{ duration: 0.22 }}
                    className="relative w-36 h-36 sm:w-44 sm:h-44 xl:w-60 xl:h-60 rounded-arcade-xl bg-gradient-to-br from-white/90 to-slate-100/80 border-4 border-[var(--color-arcade-navy)] shadow-2xl overflow-hidden flex items-center justify-center"
                  >
                    <img
                      src={activeMascot.image}
                      alt={activeMascot.name}
                      className="w-full h-full object-contain drop-shadow-md scale-105"
                    />
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-arcade-sm bg-[var(--color-arcade-navy)] shadow-md whitespace-nowrap">
                      <span className="text-[10px] font-black uppercase tracking-wide text-[var(--color-arcade-yellow)]">
                        {activeMascot.name}
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
                <p className="mt-1.5 xl:mt-2.5 text-[10px] xl:text-xs font-bold text-slate-600 uppercase tracking-wide">
                  {activeMascot.role}
                </p>
              </motion.div>
              <button
                type="button"
                onClick={nextMascot}
                aria-label="Siguiente mascota"
                className="w-9 h-9 xl:w-11 xl:h-11 rounded-full bg-[var(--color-arcade-navy)] text-white flex items-center justify-center border-b-arcade border-[var(--color-arcade-ink)] shadow-md hover:scale-105 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <ChevronRight className="w-5 h-5 xl:w-6 xl:h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Features */}
        <section className="mt-5 xl:mt-7 grid gap-4 xl:gap-5 sm:grid-cols-3 text-left">
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              className="rounded-arcade bg-white/85 p-4 xl:p-5 border-b-arcade border-slate-200 shadow-lg flex items-start gap-3 hover:-translate-y-1 hover:shadow-xl transition-transform"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
            >
              <div className="inline-flex rounded-arcade-sm bg-[var(--color-arcade-yellow)]/20 p-2 xl:p-2.5 shrink-0">
                <f.icon className="w-5 h-5 xl:w-6 xl:h-6 text-[var(--color-arcade-orange)]" />
              </div>
              <div>
                <h3 className="text-sm xl:text-base font-black text-[var(--color-arcade-navy)] leading-snug">{t(f.titleKey)}</h3>
                <p className="mt-1 text-[11px] xl:text-xs font-medium text-slate-600 leading-snug">{t(f.descKey)}</p>
              </div>
            </motion.div>
          ))}
        </section>

        {/* Mental health note */}
        <div className="mx-auto mt-3 xl:mt-5 flex max-w-xl items-center gap-2 rounded-arcade-sm bg-white/70 px-3 py-1.5 xl:py-2.5 text-left text-[10px] xl:text-xs text-slate-600">
          <HeartHandshake className="w-4 h-4 shrink-0 text-rose-500" />
          <p>{t("landing.disclaimer")}</p>
        </div>
        </div>
      </main>

      {/* MODAL PLANES Y PRECIOS — se abre desde el botón PLANES */}
      {isPlansOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[var(--color-arcade-navy-dark)]/60 backdrop-blur-sm"
          onClick={() => setIsPlansOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-6xl max-h-[92dvh] overflow-y-auto rounded-arcade-lg bg-gradient-to-b from-sky-200 to-emerald-100 p-3 sm:p-7 shadow-2xl border-4 border-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2.5 sm:mb-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-arcade-navy)] px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-[var(--color-arcade-yellow)] shadow-md">
                <Crown className="w-3.5 h-3.5 fill-current" /> Planes y Precios
              </div>
              <h2 className="hidden sm:block text-xl sm:text-2xl font-black uppercase text-[var(--color-arcade-navy)] tracking-tight">
                Planes que Ofrecemos
              </h2>
              <button
                type="button"
                onClick={() => setIsPlansOpen(false)}
                aria-label="Cerrar"
                className="w-9 h-9 rounded-arcade-sm bg-[var(--color-arcade-navy)] text-white flex items-center justify-center border-b-arcade border-[var(--color-arcade-ink)] hover:scale-105 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="plans-modal-grid grid grid-cols-3 gap-2 sm:gap-5 w-full mx-auto text-left items-stretch">
            {/* PLAN GRATUITO */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative rounded-arcade-lg bg-white/90 p-4 border-4 border-slate-200 border-b-arcade-2xl shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider border border-slate-300">
                    Básico
                  </span>
                  <Sparkles className="w-4 h-4 text-slate-400" />
                </div>
                <h3 className="text-lg font-black uppercase text-[var(--color-arcade-navy)]">Estudiante Zen</h3>
                <p className="text-[10px] font-bold text-slate-500 mt-0.5">Para comenzar a transformar tus apuntes hoy mismo.</p>

                <div className="mt-2.5 mb-3 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-[var(--color-arcade-navy)]">$0</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">/ 7 días de prueba</span>
                </div>

                <div className="space-y-1.5 text-[10.5px] font-bold text-slate-700 border-t border-slate-200/80 pt-3">
                  <div className="flex items-center gap-2">
                    {freeCheck}
                    <span>Subida de resúmenes y apuntes en PDF</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {freeCheck}
                    <span>Circuitos interactivos de preguntas y cartas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {freeCheck}
                    <span>Compañera Hubzi con consejos empáticos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {freeCheck}
                    <span>Modos de respiración consciente Zen</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    {freeDimCheck}
                    <span>Solo 1 Baúl de estudio · hasta 10 MB de material</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    {freeDimCheck}
                    <span>Voz estándar de Hubzi (la voz IA premium es Pro)</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    {freeDimCheck}
                    <span>Prueba gratis de 7 días</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Link
                  to="/arena"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-arcade bg-white hover:bg-slate-50 text-[var(--color-arcade-navy)] font-black text-[11px] uppercase tracking-wider border-2 border-[var(--color-arcade-navy)] border-b-arcade border-b-[var(--color-arcade-ink)] shadow-md hover:scale-[1.01] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                >
                  <span>Empezar Gratis</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            {/* PLAN PRO */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="relative rounded-arcade-lg bg-[var(--color-arcade-navy)] p-4 border-4 border-[var(--color-arcade-yellow)] border-b-arcade-2xl border-b-[var(--color-arcade-yellow-shadow)] shadow-2xl flex flex-col justify-between text-white overflow-hidden"
            >
              {/* Badge Más Popular */}
              <div className="absolute top-0 right-0 bg-gradient-to-l from-[var(--color-arcade-orange)] to-[var(--color-arcade-yellow)] text-[var(--color-arcade-navy)] text-[9px] font-black uppercase tracking-wider py-1 px-3 rounded-bl-arcade shadow-md flex items-center gap-1">
                <Crown className="w-3 h-3 fill-current" />
                <span>MÁS POPULAR</span>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-[var(--color-arcade-navy-dark)] text-[var(--color-arcade-yellow)] text-[10px] font-black uppercase tracking-wider border border-[var(--color-arcade-yellow)]/40">
                    Pro Ilimitado
                  </span>
                </div>
                <h3 className="text-lg font-black uppercase text-white flex items-center gap-2">
                  Hubzy Pro
                  <Crown className="w-5 h-5 text-[var(--color-arcade-yellow)] fill-current" />
                </h3>
                <p className="text-[10px] font-bold text-slate-300 mt-0.5">Potencia total para aprobar exámenes exigentes sin estrés.</p>

                <div className="mt-2.5 mb-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-[var(--color-arcade-yellow)] drop-shadow">$2.99</span>
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">USD / mes</span>
                </div>

                <div className="space-y-1.5 text-[10.5px] font-bold text-slate-200 border-t border-[var(--color-arcade-navy-light)] pt-3">
                  <div className="flex items-center gap-2">
                    {proCheck}
                    <span><strong>Subida ILIMITADA</strong> de PDFs, diapositivas y libros</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {proCheck}
                    <span><strong>Acceso a los 20 Niveles</strong> de maestría en la Arena</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {proCheck}
                    <span><strong>Voz IA de Hubzi ultra-rápida y empática</strong> sin límites</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {proCheck}
                    <span><strong>Simulacros infinitos</strong> sin tiempos de espera</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {proCheck}
                    <span><strong>Múltiples carpetas</strong> y hasta <strong>50 MB</strong> de material</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {proCheck}
                    <span className="text-emerald-300">Garantía de reembolso de 7 días · Cancela con 1 clic</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => { setIsPlansOpen(false); setIsSubscriptionModalOpen(true); }}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-arcade bg-gradient-to-r from-[var(--color-arcade-orange)] to-[var(--color-arcade-yellow)] hover:from-[var(--color-arcade-orange-bright)] hover:to-[#ffbf1a] text-[var(--color-arcade-navy)] font-black text-[11px] uppercase tracking-wider border-2 border-[var(--color-arcade-navy)] border-b-arcade border-b-[#8c3b00] shadow-[0_4px_0_#8c3b00] hover:scale-[1.01] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                >
                  <Crown className="w-4 h-4 fill-current" />
                  <span>Obtener Plan PRO ($2.99 / mes)</span>
                </button>
              </div>
            </motion.div>

            {/* PLAN ESCUELAS (B2B) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="relative rounded-arcade-lg bg-gradient-to-b from-emerald-900 to-[#0f2a1d] p-4 border-4 border-emerald-400 border-b-arcade-2xl border-b-emerald-700 shadow-2xl flex flex-col justify-between text-white overflow-hidden"
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-950/70 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-400/40">
                    Para instituciones
                  </span>
                </div>
                <h3 className="text-lg font-black uppercase text-white flex items-center gap-2">
                  Hubzy Escuelas
                  <School className="w-5 h-5 text-emerald-300" />
                </h3>
                <p className="text-[10px] font-bold text-emerald-100/80 mt-0.5">
                  Toda la gamificación anti-estrés para tu colegio, con panel docente.
                </p>

                <div className="mt-2.5 mb-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-emerald-300 drop-shadow">$1</span>
                  <span className="text-[10px] font-bold text-emerald-100/80 uppercase tracking-wide">
                    USD / estudiante / mes <span className="text-emerald-200/70">(mín. 30)</span>
                  </span>
                </div>

                <div className="space-y-1.5 text-[10.5px] font-bold text-emerald-50 border-t border-emerald-400/20 pt-3">
                  <div className="flex items-center gap-2">
                    {schoolCheck}
                    <span><strong>Grados y paralelos ilimitados</strong> con código de clase</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {schoolCheck}
                    <span><strong>Materias por grado</strong> — el libro se convierte en islas-temas solas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {schoolCheck}
                    <span><strong>Panel docente:</strong> progreso por estudiante y temas débiles del curso</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {schoolCheck}
                    <span>Todo lo del plan Pro para cada estudiante</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {schoolCheck}
                    <span className="text-emerald-200">Privacidad de menores: métricas pedagógicas, jamás chats</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Link
                  to="/arena"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-arcade bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black text-[11px] uppercase tracking-wider border-2 border-emerald-600 border-b-arcade border-b-emerald-800 shadow-md hover:scale-[1.01] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                >
                  <School className="w-4 h-4" />
                  <span>Crear mi colegio gratis</span>
                </Link>
              </div>
            </motion.div>
          </div>
          </motion.div>
        </div>
      )}

      {/* Footer legal */}
      <footer className="relative z-10 border-t border-[var(--color-arcade-navy)]/10 py-2 xl:py-3 text-center text-[10px] xl:text-xs font-semibold text-slate-600">
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={() => setIsPlansOpen(true)} className="hover:text-[var(--color-arcade-navy)] transition-colors cursor-pointer">
            Planes y Precios
          </button>
          <span>·</span>
          <Link to="/legal/terminos" className="hover:text-[var(--color-arcade-navy)] transition-colors">
            Términos de Servicio
          </Link>
          <span>·</span>
          <Link to="/legal/privacidad" className="hover:text-[var(--color-arcade-navy)] transition-colors">
            Política de Privacidad
          </Link>
          <span>·</span>
          <span>© 2026 Hubzy — SynapseHub</span>
        </div>
      </footer>

      {/* Modal de Suscripción Stripe (Hubzy Pro) */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        currentUser={null}
        onSubscriptionSuccess={() => {
          setIsSubscriptionModalOpen(false);
          window.location.href = "/arena";
        }}
      />
    </div>
  );
}
