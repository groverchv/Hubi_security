import { useSyncExternalStore } from "react";

/**
 * Bloqueo de orientación horizontal.
 *
 * - PWA instalada: el manifest ("orientation": "landscape") ya lo hace nativo.
 * - Navegador Android: screen.orientation.lock() funciona tras gesto del
 *   usuario (y en algunos casos requiere fullscreen — se intenta de rebote).
 * - iOS Safari: ignora todo lo anterior → lo cubre RotatePhoneOverlay.
 */
export async function lockLandscape() {
  try {
    if (document.documentElement.requestFullscreen &&
        !document.fullscreenElement &&
        // Fullscreen solo en pantallas táctiles pequeñas; en desktop no molesta
        window.matchMedia?.('(pointer: coarse)').matches) {
      await document.documentElement.requestFullscreen();
    }
  } catch (_) {}
  try {
    if (screen.orientation?.lock) {
      await screen.orientation.lock('landscape');
    }
  } catch (_) {}
}

export async function unlockOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch (_) {}
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch (_) {}
}

/* === LAYOUT COMPACTO MÓVIL ===
   Teléfonos táctiles en horizontal bajo (o pantalla muy angosta): el
   escenario deja de verse "como laptop escalada" y pasa a un layout
   real — nodos en lista compacta arriba, mazo horizontal abajo. */
const MQ_COMPACT_LANDSCAPE =
  "(pointer: coarse) and (orientation: landscape) and (max-height: 620px)";
const MQ_COMPACT_NARROW = "(pointer: coarse) and (max-width: 560px)";

function compactMobileNow() {
  try {
    return Boolean(
      window.matchMedia?.(MQ_COMPACT_LANDSCAPE).matches ||
        window.matchMedia?.(MQ_COMPACT_NARROW).matches,
    );
  } catch (_) {
    return false;
  }
}

export function useCompactMobile() {
  return useSyncExternalStore(
    (cb) => {
      try {
        const l = window.matchMedia(MQ_COMPACT_LANDSCAPE);
        const n = window.matchMedia(MQ_COMPACT_NARROW);
        l.addEventListener?.("change", cb);
        n.addEventListener?.("change", cb);
        window.addEventListener("resize", cb);
        window.addEventListener("orientationchange", cb);
        return () => {
          l.removeEventListener?.("change", cb);
          n.removeEventListener?.("change", cb);
          window.removeEventListener("resize", cb);
          window.removeEventListener("orientationchange", cb);
        };
      } catch (_) {
        return () => {};
      }
    },
    compactMobileNow,
    () => false,
  );
}
