/**
 * Mute global persistente — una sola preferencia (`hubzy_global_muted`)
 * silencia TODOS los motores de audio de la app: voz de Hubzi (capyVoice),
 * efectos (sfx, capyAudio) y la música ambient del juego y del lobby.
 *
 * Persiste en localStorage y los motores reaccionan en caliente mediante
 * `onGlobalMuteChange` — mutear detiene la voz y fadea la música al
 * instante; desmutear la restaura respetando el ducking y los mutes
 * propios de cada motor.
 */
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "hubzy_global_muted";
const listeners = new Set();

function detect() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch (_) {
    return false;
  }
}

let _muted = detect();

export function isGlobalMuted() {
  return _muted;
}

export function setGlobalMuted(value) {
  const next = Boolean(value);
  if (next === _muted) return;
  _muted = next;
  try {
    localStorage.setItem(STORAGE_KEY, _muted ? "1" : "0");
  } catch (_) {}
  listeners.forEach((fn) => {
    try {
      fn(_muted);
    } catch (_) {}
  });
}

export function onGlobalMuteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useGlobalMuted() {
  return useSyncExternalStore(
    onGlobalMuteChange,
    () => _muted,
    () => false,
  );
}
