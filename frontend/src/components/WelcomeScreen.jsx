import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Users, 
  BookOpen, 
  ShieldCheck, 
  Sparkles, 
  Settings, 
  Lock,
  Layers,
  HelpCircle,
  GraduationCap,
  ArrowRight,
  ArrowLeft,
  Play,
  Download,
  Smartphone,
  CheckCircle2,
  X,
  Share,
  Monitor
} from 'lucide-react';
import capyMascot from '../assets/mascots/capy_escolar_nino_m.webp';
import confetti from 'canvas-confetti';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useTranslation } from 'react-i18next';
import { lobbyAmbient } from '../utils/lobbyAmbient';
import { isLowPower } from '../utils/lowPower';
import { lockLandscape } from '../utils/orientation';
import A11yControls from './A11yControls';

const TRIAL_DAYS = 7;

export default function WelcomeScreen({
  onContinue,
  onOpenTutorial,
  onOpenLogin,
  onOpenLegal,
  isLoggedIn = false,
  username = '',
  user = null
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isInstalled, triggerInstall } = usePwaInstall();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Cuenta regresiva de la prueba gratis (solo plan free; pro/school = ilimitado)
  const isPremium = user?.plan === 'pro' || user?.plan === 'school';
  const trialEndsAt = (() => {
    if (!isLoggedIn || !user || isPremium || !user.created_at) return null;
    const created = new Date(user.created_at).getTime();
    return Number.isFinite(created) ? created + TRIAL_DAYS * 86400000 : null;
  })();

  // Plan PRO: fin del ciclo de 30 días (desde pro_since)
  const PRO_CYCLE_DAYS = 30;
  const proEndsAt = (() => {
    if (!isLoggedIn || !user || user.plan !== 'pro' || !user.pro_since) return null;
    const since = new Date(user.pro_since).getTime();
    return Number.isFinite(since) ? since + PRO_CYCLE_DAYS * 86400000 : null;
  })();

  const [now, setNow] = useState(Date.now());
  React.useEffect(() => {
    if (!trialEndsAt && !proEndsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [trialEndsAt, proEndsAt]);

  const trialRemainingMs = trialEndsAt ? trialEndsAt - now : null;
  const proRemainingMs = proEndsAt ? Math.max(0, proEndsAt - now) : null;
  const trialDaysLeft =
    trialRemainingMs !== null
      ? Math.max(0, Math.ceil(trialRemainingMs / 86400000))
      : isLoggedIn && user && !isPremium && typeof user.trial_days_left === 'number'
        ? user.trial_days_left
        : null;

  // "6d 23:59:41" — días + horas:minutos:segundos
  const formatTrialCountdown = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}`;
  };

  // Inicializar paisaje sonoro relajante del lobby antes de iniciar el juego
  React.useEffect(() => {
    lobbyAmbient.start();

    // Desbloqueo ante políticas de interacción del navegador
    const handleFirstGesture = () => {
      lobbyAmbient.start();
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };

    window.addEventListener('click', handleFirstGesture, { passive: true });
    window.addEventListener('keydown', handleFirstGesture, { passive: true });
    window.addEventListener('touchstart', handleFirstGesture, { passive: true });

    // La música del lobby NO se detiene al desmontar: sigue sonando en
    // carpetas y mapa hasta entrar al tablero (orquestada en ArcadeArena).
    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
  }, []);

  const handleContinueClick = (e) => {
    lockLandscape();
    if (onContinue) onContinue(e);
  };

  const handleInstallClick = () => {
    setIsInstallModalOpen(true);
  };

  const handleConfirmInstall = async () => {
    if (isInstalled) {
      setToastMessage(t('welcome.already_inst'));
      setTimeout(() => setToastMessage(''), 3000);
      setIsInstallModalOpen(false);
      return;
    }

    setIsInstalling(true);
    const res = await triggerInstall();
    setIsInstalling(false);

    if (res.triggered) {
      if (res.outcome === 'accepted') {
        try {
          if (!isLowPower()) confetti({ particleCount: 90, spread: 65, origin: { y: 0.6 } });
        } catch {}
        setToastMessage(t('welcome.inst_ok'));
        setIsInstallModalOpen(false);
      }
    } else {
      setToastMessage(t('welcome.inst_check'));
      setIsInstallModalOpen(false);
    }
    setTimeout(() => setToastMessage(''), 3500);
  };

  return (
    <div className="welcome-stage fixed inset-0 z-50 flex flex-col justify-between select-none font-sans overflow-y-auto overflow-x-hidden bg-transparent">
      {/* ── BARRA SUPERIOR: AJUSTES & ACCESO ── */}
      <div className="relative w-full px-4 sm:px-8 pt-4 flex items-center justify-between z-20">

        {/* Botón Izquierdo: Volver al inicio + Iniciar Sesión / Cuenta */}
        <div className="relative flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="p-3 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-3 border-[var(--color-arcade-navy-dark)] border-b-arcade-lg border-b-[var(--color-arcade-ink)] text-white shadow-btn-arcade active:translate-y-1 active:shadow-none transition-all cursor-pointer"
            title={t('welcome.back_home')}
          >
            <ArrowLeft className="w-5 h-5 text-[var(--color-sky-400)]" />
          </button>
          <button
            onClick={onOpenLogin}
            className="group relative flex items-center gap-2.5 px-5 py-2.5 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-3 border-[var(--color-arcade-navy-dark)] border-b-arcade-lg border-b-[var(--color-arcade-ink)] text-white transition-all shadow-[0_6px_0_var(--color-arcade-orange)] active:translate-y-1 active:shadow-none cursor-pointer"
          >
            <div className={`w-7 h-7 rounded-arcade-sm border-2 border-[var(--color-arcade-navy)] flex items-center justify-center text-[var(--color-arcade-navy)] ${
              isLoggedIn ? 'bg-[var(--color-arcade-green)] shadow-btn-green-press' : 'bg-[var(--color-arcade-yellow)] shadow-[0_2px_0_var(--color-arcade-yellow-shadow)]'
            }`}>
              {isLoggedIn ? <User className="w-4 h-4 stroke-[2.8]" /> : <Lock className="w-4 h-4 stroke-[2.8]" />}
            </div>
            <div className="flex flex-col text-left leading-tight">
              <span className="text-[11px] font-black uppercase text-white tracking-wide">
                {isLoggedIn ? (username || t('welcome.my_account')) : t('welcome.login')}
              </span>
              <span className={`text-[8.5px] font-bold ${isLoggedIn ? 'text-emerald-300' : 'text-amber-300'}`}>
                {isLoggedIn ? t('welcome.session_on') : t('welcome.login_needed')}
              </span>
            </div>
          </button>
        </div>

        {/* Chip central: días de prueba gratis / insignia PRO */}
        {isLoggedIn && (
          <div className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center">
            {isPremium ? (
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/90 border-2 border-emerald-300 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_3px_0_rgba(4,120,87,0.6)]">
                <Sparkles className="w-3 h-3" />
                {user?.plan === 'school'
                  ? t('welcome.school_plan')
                  : proRemainingMs !== null
                    ? t('welcome.pro_days', { time: formatTrialCountdown(proRemainingMs) })
                    : 'Plan Pro'}
              </span>
            ) : trialRemainingMs !== null ? (
              <span
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border-2 text-[10px] font-black uppercase tracking-widest text-white ${
                  trialRemainingMs <= 0
                    ? 'bg-rose-500/90 border-rose-300 shadow-[0_3px_0_rgba(159,18,57,0.6)]'
                    : 'bg-[var(--color-arcade-navy)]/90 border-[var(--color-arcade-yellow)] text-[var(--color-arcade-yellow)] shadow-hud'
                }`}
                title={t('welcome.trial_t')}
              >
                <Sparkles className="w-3 h-3" />
                {trialRemainingMs <= 0
                  ? t('welcome.trial_done')
                  : t('welcome.trial_left', { time: formatTrialCountdown(trialRemainingMs) })}
              </span>
            ) : trialDaysLeft !== null ? (
              <span
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border-2 bg-[var(--color-arcade-navy)]/90 border-[var(--color-arcade-yellow)] text-[10px] font-black uppercase tracking-widest text-[var(--color-arcade-yellow)] shadow-hud"
                title={t('welcome.trial_t2')}
              >
                <Sparkles className="w-3 h-3" />
                {trialDaysLeft === 0
                  ? t('welcome.trial_done')
                  : t('welcome.trial_days', { count: trialDaysLeft })}
              </span>
            ) : null}
          </div>
        )}

        {/* Botones Derechos: Instalar App & Ayuda */}
        <div className="flex items-center gap-2">
          {/* Botón Barra Superior: Instalar App */}
          <button
            onClick={handleInstallClick}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-3 border-[var(--color-arcade-navy-dark)] border-b-arcade-lg border-b-[var(--color-arcade-ink)] text-white active:translate-y-1 active:shadow-none transition-all cursor-pointer ${
              isInstalled ? 'shadow-[0_4px_0_#10b981]' : 'shadow-[0_4px_0_var(--color-sky-400)]'
            }`}
            title={t('welcome.install_t')}
          >
            {isInstalled ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Download className="w-4 h-4 text-[var(--color-sky-400)]" />
            )}
            <span className={`text-[11px] font-black uppercase tracking-wider hidden sm:inline ${
              isInstalled ? 'text-emerald-300' : 'text-[var(--color-sky-400)]'
            }`}>
              {isInstalled ? t('welcome.installed') : t('welcome.install')}
            </span>
          </button>

          <button
            onClick={onOpenTutorial}
            className="p-3 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-3 border-[var(--color-arcade-navy-dark)] border-b-arcade-lg border-b-[var(--color-arcade-ink)] text-white shadow-btn-arcade active:translate-y-1 active:shadow-none transition-all cursor-pointer"
            title={t('welcome.help_t')}
          >
            <HelpCircle className="w-5 h-5 text-[var(--color-arcade-yellow)]" />
          </button>
          <A11yControls />
        </div>
      </div>

      {/* ── SECCIÓN CENTRAL: LOGO HUBZY CARD CLASH Y BOTÓN TUTORIAL ── */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 z-10 -mt-6">
        
        {/* LOGO GIGANTE 3D "HUBZY CARD CLASH" */}
        <motion.div
          initial={{ scale: 0.85, y: -20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 20 }}
          className="flex flex-col items-center text-center relative"
        >
          {/* Corona / Halo Superior */}
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[var(--color-arcade-navy)] border-3 border-[var(--color-arcade-navy-dark)] shadow-btn-arcade mb-2">
            <GraduationCap className="w-4 h-4 text-[var(--color-arcade-yellow)]" />
            <span className="text-[11px] font-black uppercase text-[var(--color-arcade-yellow)] tracking-widest">
              {t('welcome.tag_chip')}
            </span>
          </div>

          {/* Letras 3D Grandes */}
          <div className="relative">
            {/* Texto "HUBZY" */}
            <h1
              className="text-6xl sm:text-7xl md:text-8xl font-black uppercase tracking-wider text-[var(--color-arcade-yellow)] leading-none drop-shadow-[0_8px_0_var(--color-arcade-yellow-shadow)]"
              style={{
                WebkitTextStroke: '1.8px var(--color-arcade-navy)',
                textShadow: '0 8px 0 var(--color-arcade-navy), 0 16px 25px rgba(0,0,0,0.5)'
              }}
            >
              HUBZY
            </h1>
          </div>

          {/* Subtítulo Cápsula */}
          <div className="mt-3 px-6 py-2 rounded-arcade bg-[var(--color-arcade-navy)] border-3 border-[var(--color-arcade-navy-dark)] shadow-btn-arcade-xl text-white">
            <p className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-100 font-mono">
              {t('welcome.tagline')}
            </p>
          </div>
        </motion.div>

        {/* Tarjeta Flotante Lateral Izquierda: TÉRMINOS & LEGAL */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onOpenLegal && onOpenLegal('terms')}
          className="absolute left-4 sm:left-8 lg:left-12 top-1/2 -translate-y-1/2 hidden sm:flex flex-col items-center cursor-pointer group select-none z-30"
          title={t('welcome.legal_t')}
        >
          <div className="w-22 h-22 sm:w-24 sm:h-24 mb-2 relative flex items-center justify-center">
            <div className="w-20 h-20 rounded-arcade-lg bg-[var(--color-sky-400)]/20 border-3 border-[var(--color-sky-400)] flex items-center justify-center shadow-lg group-hover:border-cyan-300 group-hover:shadow-[0_0_20px_rgba(56,189,248,0.4)] transition-all">
              <ShieldCheck className="w-10 h-10 text-[var(--color-sky-400)] group-hover:text-cyan-300 drop-shadow transition-colors" />
            </div>
          </div>
          <button
            type="button"
            className="px-5 sm:px-6 py-3 rounded-arcade bg-[var(--color-arcade-navy)] group-hover:bg-[var(--color-arcade-navy-hover)] border-3 border-[var(--color-arcade-navy-dark)] border-b-arcade-lg border-b-[var(--color-arcade-ink)] text-white font-black text-xs uppercase tracking-wider shadow-[0_5px_0_var(--color-sky-400)] active:translate-y-1 active:shadow-none transition-all cursor-pointer whitespace-nowrap"
          >
            {t('welcome.legal_btn')}
          </button>
        </motion.div>

        {/* Tarjeta Flotante Lateral Derecha: PLAY TUTORIAL */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={onOpenTutorial}
          className="absolute right-4 sm:right-8 lg:right-12 top-1/2 -translate-y-1/2 hidden sm:flex flex-col items-center cursor-pointer group select-none z-30"
          title={t('welcome.tut_t')}
        >
          <div className="w-22 h-22 sm:w-24 sm:h-24 mb-2 relative flex items-center justify-center">
            <div className="w-20 h-20 rounded-arcade-lg bg-[var(--color-arcade-yellow)]/20 border-3 border-[var(--color-arcade-yellow)] flex items-center justify-center shadow-lg group-hover:border-amber-300 group-hover:shadow-[0_0_20px_rgba(255,180,0,0.4)] transition-all">
              <BookOpen className="w-10 h-10 text-[var(--color-arcade-yellow)] group-hover:text-amber-300 drop-shadow transition-colors" />
            </div>
          </div>
          <button
            type="button"
            className="px-5 sm:px-6 py-3 rounded-arcade bg-[var(--color-arcade-navy)] group-hover:bg-[var(--color-arcade-navy-hover)] border-3 border-[var(--color-arcade-navy-dark)] border-b-arcade-lg border-b-[var(--color-arcade-ink)] text-white font-black text-xs uppercase tracking-wider shadow-[0_5px_0_var(--color-arcade-orange)] active:translate-y-1 active:shadow-none transition-all cursor-pointer whitespace-nowrap"
          >
            {t('welcome.tut_btn')}
          </button>
        </motion.div>
      </div>

      {/* ── BANNER INFERIOR: BOTONES CONTINUAR Y DEMO INMEDIATO ── */}
      <div className="relative w-full z-20 pb-5 px-4 sm:px-8">
        <div className="max-w-xl mx-auto space-y-2.5">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleContinueClick}
            className={`w-full py-3.5 sm:py-4 px-6 sm:px-8 rounded-arcade-lg flex items-center justify-between text-left cursor-pointer overflow-hidden relative shadow-[0_8px_0_var(--color-arcade-navy)] transition-all ${
              isLoggedIn 
                ? 'btn-arcade-banner-orange bg-striped-diagonal' 
                : 'bg-[#1b2f52] border-3 border-[var(--color-arcade-navy-dark)] hover:bg-[#223b66]'
            }`}
          >
            <div className="flex items-center gap-3.5 relative z-10">
              <div className={`w-12 h-12 rounded-arcade border-3 border-[var(--color-arcade-navy)] flex items-center justify-center text-white ${
                isLoggedIn ? 'bg-[var(--color-arcade-orange)] shadow-[0_3px_0_var(--color-arcade-orange-shadow)]' : 'bg-[var(--color-arcade-yellow)] text-[var(--color-arcade-navy)] shadow-btn-yellow-press'
              }`}>
                {isLoggedIn ? (
                  <Play className="w-7 h-7 text-white fill-current drop-shadow ml-0.5" />
                ) : (
                  <Lock className="w-6 h-6 text-[var(--color-arcade-navy)] stroke-[2.8]" />
                )}
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-wider uppercase drop-shadow flex items-center gap-2">
                  {t('welcome.continue')}
                  {!isLoggedIn && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-arcade-orange)] text-white border-2 border-[var(--color-arcade-navy)] font-black uppercase">
                      {t('welcome.account_req')}
                    </span>
                  )}
                </h3>
                <p className={`text-xs font-black drop-shadow-sm ${isLoggedIn ? 'text-orange-100' : 'text-amber-300'}`}>
{isLoggedIn ? t('welcome.cont_in') : t('welcome.cont_out')}
                </p>
              </div>
            </div>

            <div className={`w-10 h-10 rounded-arcade border-3 border-[var(--color-arcade-navy-dark)] flex items-center justify-center text-white shadow-md relative z-10 ${
              isLoggedIn ? 'bg-[var(--color-arcade-navy)]' : 'bg-[var(--color-arcade-navy-dark)]'
            }`}>
              {isLoggedIn ? (
                <ArrowRight className="w-6 h-6 stroke-[3]" />
              ) : (
                <Lock className="w-4 h-4 text-amber-400 stroke-[2.5]" />
              )}
            </div>
          </motion.button>

          {/* Accesos rápidos en móviles (Tutorial y Legal) */}
          <div className="flex sm:hidden items-center justify-center gap-4 pt-1">
            <button
              onClick={() => onOpenLegal && onOpenLegal('terms')}
              className="text-xs font-bold text-slate-300 hover:text-cyan-300 flex items-center gap-1.5 py-1 px-3 rounded-arcade-sm bg-[var(--color-arcade-navy-dark)]/80 border border-slate-700/50 cursor-pointer active:scale-95 transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-sky-400)]" />
              <span>{t('welcome.legal_m')}</span>
            </button>
            <button
              onClick={onOpenTutorial}
              className="text-xs font-bold text-slate-300 hover:text-amber-300 flex items-center gap-1.5 py-1 px-3 rounded-arcade-sm bg-[var(--color-arcade-navy-dark)]/80 border border-slate-700/50 cursor-pointer active:scale-95 transition-all"
            >
              <BookOpen className="w-3.5 h-3.5 text-[var(--color-arcade-yellow)]" />
              <span>Tutorial</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL EXCLUSIVO HUBZY PARA INSTALACIÓN ── */}
      <AnimatePresence>
        {isInstallModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-arcade-navy-dark)]/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 25 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 25 }}
              transition={{ type: "spring", damping: 25, stiffness: 320 }}
              className="relative w-full max-w-md bg-[var(--color-arcade-navy)] border-4 border-[var(--color-arcade-navy-dark)] rounded-arcade-lg p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.8)] text-white overflow-hidden"
            >
              {/* Botón Cerrar (X) */}
              <button
                onClick={() => setIsInstallModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-arcade bg-[var(--color-arcade-navy-dark)] text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer border-2 border-slate-700/50"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Cabecera con Hubzi 3D y Título */}
              <div className="flex flex-col items-center text-center mb-5">
                <div className="relative mb-3">
                  <div className="w-24 h-24 rounded-arcade-lg bg-gradient-to-br from-[var(--color-arcade-yellow)] to-[var(--color-arcade-orange)] p-1 border-3 border-[var(--color-arcade-navy-dark)] shadow-[0_6px_0_var(--color-arcade-orange-shadow)] flex items-center justify-center overflow-hidden">
                    <img 
                      src={capyMascot} 
                      alt="Hubzi" 
                      className="w-full h-full object-cover scale-105" 
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 p-1.5 rounded-arcade-sm bg-emerald-500 border-2 border-[var(--color-arcade-navy)] text-white shadow-md">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[var(--color-arcade-navy-dark)] border border-amber-400/40 text-[var(--color-arcade-yellow)] text-[10px] font-black uppercase tracking-widest mb-1.5">
                  <Sparkles className="w-3 h-3 text-[var(--color-arcade-yellow)]" />
                  {t('welcome.install_badge')}
                </div>

                <h3 className="text-2xl font-black text-white tracking-wide uppercase drop-shadow">
                  {t('welcome.install_title')}
                </h3>
                <p className="text-xs text-sky-200/90 font-medium mt-1 max-w-xs">
                  {t('welcome.install_sub')}
                </p>
              </div>

              {/* Tarjetas de Beneficios */}
              <div className="space-y-2 mb-6 text-xs">
                <div className="p-3 rounded-arcade bg-[var(--color-arcade-navy-dark)]/90 border border-slate-700/60 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-arcade-sm bg-[var(--color-sky-400)]/20 border border-[var(--color-sky-400)] flex items-center justify-center text-[var(--color-sky-400)] shrink-0">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-white">{t('welcome.b1_t')}</p>
                    <p className="text-[11px] text-slate-300">{t('welcome.b1_d')}</p>
                  </div>
                </div>

                <div className="p-3 rounded-arcade bg-[var(--color-arcade-navy-dark)]/90 border border-slate-700/60 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-arcade-sm bg-[var(--color-arcade-yellow)]/20 border border-[var(--color-arcade-yellow)] flex items-center justify-center text-[var(--color-arcade-yellow)] shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-white">{t('welcome.b2_t')}</p>
                    <p className="text-[11px] text-slate-300">{t('welcome.b2_d')}</p>
                  </div>
                </div>
              </div>

              {/* Botón de Acción Principal */}
              <div className="space-y-2.5">
                <button
                  onClick={handleConfirmInstall}
                  disabled={isInstalling}
                  className="w-full py-3.5 px-6 rounded-arcade bg-[var(--color-arcade-orange)] hover:bg-[#ff8a1a] text-white font-black text-sm uppercase tracking-wider shadow-[0_6px_0_#B34E00] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2.5 cursor-pointer border-2 border-[var(--color-arcade-navy)] disabled:opacity-80"
                >
                  <Download className="w-5 h-5 text-white" />
                  <span>
                    {isInstalled 
                      ? t('welcome.open_app')
                      : isInstalling 
                        ? t('welcome.confirming')
                        : t('welcome.install_app')}
                  </span>
                </button>

                <button
                  onClick={() => setIsInstallModalOpen(false)}
                  className="w-full py-2.5 px-4 rounded-arcade-sm bg-transparent hover:bg-white/5 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {t('welcome.close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── TOAST NOTIFICACIÓN NO INTRUSIVA ── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-arcade bg-[var(--color-arcade-navy)] border-3 border-[var(--color-sky-400)] shadow-[0_8px_25px_rgba(0,0,0,0.5)] text-white text-xs font-black uppercase tracking-wider flex items-center gap-3"
          >
            <Sparkles className="w-5 h-5 text-[var(--color-arcade-yellow)] shrink-0 animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
