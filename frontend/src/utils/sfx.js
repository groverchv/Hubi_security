// ── Motor de efectos de sonido — WebAudio sintetizado, sin archivos ─────────
// Filosofía anti-estrés: aciertos suenan alegres, fallos suenan suaves.
// Respeta la política de autoplay: el contexto se crea/reanuda en gestos del
// usuario (todos los llamados vienen de clicks), nunca suena solo.
import { isGlobalMuted } from "./globalMute";

class SfxEngine {
  constructor() {
    this.ctx = null;
  }

  _getCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  _tone({ freq = 440, freqEnd = 0, type = "sine", dur = 0.15, vol = 0.12, delay = 0 }) {
    if (isGlobalMuted()) return;
    const ctx = this._getCtx();
    if (!ctx || ctx.state !== "running") return;
    try {
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    } catch (_) {}
  }

  // Acierto: "pop" ascendente alegre
  success() {
    this._tone({ freq: 520, freqEnd: 780, dur: 0.12, vol: 0.12 });
    this._tone({ freq: 780, freqEnd: 1040, dur: 0.14, vol: 0.09, delay: 0.07 });
  }

  // Fallo: "thud" grave y corto — informativo, no punitivo
  error() {
    this._tone({ freq: 220, freqEnd: 165, type: "triangle", dur: 0.18, vol: 0.07 });
  }

  // Seleccionar carta: clic sutil
  flip() {
    this._tone({ freq: 660, freqEnd: 880, dur: 0.06, vol: 0.045 });
  }

  // Trampa: "poof" descendente
  trap() {
    this._tone({ freq: 320, freqEnd: 90, type: "sawtooth", dur: 0.22, vol: 0.05 });
  }

  // Victoria: arpegio Do-Mi-Sol-Do
  victory() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this._tone({ freq: f, dur: 0.2, vol: 0.11, delay: i * 0.09 }),
    );
  }
}

export const sfx = new SfxEngine();
