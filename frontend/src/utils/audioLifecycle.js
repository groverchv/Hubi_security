/**
 * Suspende el AudioContext cuando la pestaña pierde el foco y lo reanuda
 * al volver. Sin esto los osciladores ambientales siguen consumiendo CPU
 * (y batería) con la app en background.
 */
export function watchVisibility(getCtx) {
  if (typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', () => {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      if (document.hidden) ctx.suspend();
      else if (ctx.state === 'suspended') ctx.resume();
    } catch (_) {}
  });
}
