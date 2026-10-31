import { useState, useEffect, useCallback } from 'react';

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(() => {
    return typeof window !== 'undefined' ? window.deferredInstallPrompt : null;
  });
  const [isInstallable, setIsInstallable] = useState(() => {
    return typeof window !== 'undefined' ? Boolean(window.deferredInstallPrompt) : false;
  });
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Detectar si ya corre instalada en modo standalone
    const checkInstalled = () => {
      const isStandalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
      if (isStandalone) {
        setIsInstalled(true);
      }
    };
    checkInstalled();

    // 2. Si ya se había capturado el prompt globalmente en <head>
    if (window.deferredInstallPrompt) {
      setDeferredPrompt(window.deferredInstallPrompt);
      setIsInstallable(true);
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      window.deferredInstallPrompt = e;
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      window.deferredInstallPrompt = null;
    };

    const handleReadyEvent = () => {
      if (window.deferredInstallPrompt) {
        setDeferredPrompt(window.deferredInstallPrompt);
        setIsInstallable(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-install-ready', handleReadyEvent);
    window.addEventListener('pwa-installed', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-install-ready', handleReadyEvent);
      window.removeEventListener('pwa-installed', handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? window.deferredInstallPrompt : null);

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice?.outcome === 'accepted') {
          setIsInstalled(true);
          setIsInstallable(false);
        }
        setDeferredPrompt(null);
        if (typeof window !== 'undefined') window.deferredInstallPrompt = null;
        return { triggered: true, outcome: choice?.outcome };
      } catch (err) {
        console.warn('Error al disparar instalación PWA:', err);
      }
    }

    return { triggered: false };
  }, [deferredPrompt]);

  return {
    isInstallable,
    isInstalled,
    triggerInstall,
    hasNativePrompt: Boolean(deferredPrompt || (typeof window !== 'undefined' && window.deferredInstallPrompt)),
  };
}
