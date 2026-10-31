/**
 * Modo ligero ("low-power") — dispositivos de gama baja.
 *
 * Detecta hardware limitado y aplica la clase `low-power` en <html>:
 * el CSS apaga nubes con blur, sombras pesadas y efectos 3D; los motores
 * de audio no autoinician; framer-motion se envuelve en reducedMotion.
 *
 * El usuario puede forzar el modo ON/OFF (persiste en localStorage).
 */
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'hubzy_low_power';
const listeners = new Set();

function detect() {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
  } catch (_) {}

  const cores = navigator.hardwareConcurrency || 8;
  const mem = navigator.deviceMemory || 8; // GB (solo Chrome/Edge; Safari da undefined)
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return Boolean(reduced || cores <= 4 || mem <= 4);
}

let _lowPower = detect();

function apply() {
  try {
    document.documentElement.classList.toggle('low-power', _lowPower);
  } catch (_) {}
}

export function isLowPower() {
  return _lowPower;
}

export function setLowPower(value) {
  _lowPower = Boolean(value);
  try {
    localStorage.setItem(STORAGE_KEY, _lowPower ? '1' : '0');
  } catch (_) {}
  apply();
  listeners.forEach((fn) => fn());
}

apply();

export function useLowPower() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => _lowPower,
    () => false,
  );
}
