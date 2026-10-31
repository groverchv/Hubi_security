import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import LandingPage from './pages/LandingPage';
import AnimatedCloudsBackground from './components/AnimatedCloudsBackground';
import RotatePhoneOverlay from './components/RotatePhoneOverlay';
import { CrisisProvider } from './lib/crisis.jsx';
import { useAuthStore } from './store/authStore';
import { fetchWithAuth } from './lib/api';
import { X, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useLowPower } from './utils/lowPower';
import ErrorBoundary from './components/ErrorBoundary';

// Code-splitting: las páginas pesadas se cargan bajo demanda por ruta
const ArcadeArena = lazy(() => import('./pages/ArcadeArena'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ZenPage = lazy(() => import('./pages/ZenPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));

function RouteFallback() {
  return (
    <div className="w-screen h-[100dvh] flex items-center justify-center bg-[var(--color-arcade-navy-dark)]">
      <div className="flex flex-col items-center gap-3">
        {/* Skeleton shimmer (4.5): la silueta del tablero "percibe" la
            carga en vez de un spinner aislado. */}
        <div className="flex items-center gap-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-12 h-14 rounded-arcade-sm skeleton-shimmer border border-cyan-500/25"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <span className="text-[var(--color-arcade-yellow)] font-mono text-xs font-black uppercase tracking-widest">
          Hubzi cargando…
        </span>
      </div>
    </div>
  );
}

function RequireUser({ children }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/arena" replace />;
  return children;
}

function App() {
  const lowPower = useLowPower();
  const { t } = useTranslation();
  const [paymentNotice, setPaymentNotice] = useState(null);
  // Revalidar el usuario persistido contra el backend (created_at real →
  // el trial no se reinicia por un objeto local stale).
  useEffect(() => {
    useAuthStore.getState().refreshUser();
  }, []);

  // Retorno global de Stripe Checkout: success_url apunta a "/" (landing),
  // no a /arena — la verificación vive aquí para que el plan se acredite
  // aunque el usuario aterrice fuera de la arena.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');
    const strip = () =>
      window.history.replaceState({}, document.title, window.location.pathname);

    if (payment === 'success' && sessionId) {
      // Reintento único: el backend/Stripe puede tardar unos segundos en
      // cerrar la sesión — un fallo de red momentáneo no debe asustar.
      const verify = () =>
        fetchWithAuth(`/api/v1/payments/verify-session/${sessionId}`).then(
          async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
            return data;
          },
        );
      verify()
        .catch(() => new Promise((r) => setTimeout(r, 3000)).then(verify))
        .then(async (data) => {
          await useAuthStore.getState().refreshUser();
          setPaymentNotice(data.is_paid ? 'success' : 'pending');
        })
        .catch(() => setPaymentNotice('error'))
        .finally(strip);
    } else if (payment === 'cancelled') {
      setPaymentNotice('cancelled');
      strip();
    }
  }, []);

  useEffect(() => {
    if (!paymentNotice) return;
    const t = setTimeout(() => setPaymentNotice(null), 12000);
    return () => clearTimeout(t);
  }, [paymentNotice]);

  const paymentBanner = paymentNotice && (
    <div
      role="status"
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2.5 px-5 py-3 rounded-arcade border-2 text-white text-sm font-bold shadow-2xl max-w-lg ${
        paymentNotice === 'success'
          ? 'bg-emerald-600/95 border-emerald-300/70'
          : 'bg-rose-600/95 border-rose-300/60'
      }`}
    >
      <Sparkles className="w-5 h-5 shrink-0" />
      <span>
        {paymentNotice === 'success'
          ? t('arena.pay_success')
          : paymentNotice === 'pending'
            ? t('arena.pay_pending')
            : paymentNotice === 'cancelled'
              ? t('arena.pay_cancel')
              : t('arena.pay_verify_err')}
      </span>
      <button
        onClick={() => setPaymentNotice(null)}
        aria-label={t('common.close')}
        className="ml-1 p-0.5 rounded hover:bg-white/20 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <MotionConfig reducedMotion={lowPower ? 'always' : 'user'}>
    <CrisisProvider>
      <ErrorBoundary>
      <BrowserRouter>
        <RotatePhoneOverlay />
        {paymentBanner}
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/arena"
              element={
                <div className="w-screen h-[100dvh] overflow-hidden relative">
                  <AnimatedCloudsBackground />
                  <ArcadeArena />
                </div>
              }
            />
            <Route
              path="/app"
              element={
                <RequireUser>
                  <DashboardPage />
                </RequireUser>
              }
            />
            <Route path="/zen" element={<ZenPage />} />
            <Route path="/legal/terminos" element={<LegalPage type="terminos" />} />
            <Route path="/legal/privacidad" element={<LegalPage type="privacidad" />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </ErrorBoundary>
    </CrisisProvider>
    </MotionConfig>
  );
}

export default App;
