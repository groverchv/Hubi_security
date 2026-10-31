/**
 * Sound FX & Emotion Audio Engine para Hubzi y Eventos de la Arena.
 * Utiliza Web Audio API nativo (soporte universal sin dependencias externas, cero latencia).
 * Todos los sonidos son ricos en armónicos, expresivos, con sentimiento y texturas acústicas reales.
 */

import { isGlobalMuted } from './globalMute';

class HubziAudioEngine {
  constructor() {
    this.ctx = null;
    this._unlocked = false;
    this._setupUnlockListeners();
  }

  _setupUnlockListeners() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.init();
      if (this.ctx && this.ctx.state === 'running') {
        this._unlocked = true;
        ['click', 'touchstart', 'keydown'].forEach(ev => {
          window.removeEventListener(ev, unlock, true);
        });
      }
    };
    ['click', 'touchstart', 'keydown'].forEach(ev => {
      window.addEventListener(ev, unlock, { once: false, passive: true, capture: true });
    });
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Sonido emocional de equivocación expresivo y con sentimiento:
   * Tipo "estuviste cerca de acertar" o "oh, fue una equivocación".
   * Combina un acorde suave menor en glissando descendente, quejido animal tierno
   * y un toque melancólico pero acogedor que no castiga al estudiante.
   */
  playCapyCry() {
    if (isGlobalMuted()) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Tono musical expresivo "oh, estuviste cerca" (Caída cromática suave con calidez)
    // Toca dos notas melancólicas que se deslizan hacia abajo (ej. Re4 -> Si3 -> Sol3)
    this._playNearMissTone(now + 0.02, 392, 330, 0.45, 0.18);
    this._playNearMissTone(now + 0.35, 330, 261, 0.60, 0.15);

    // 2. Quejido tierno/vocal de Hubzi (Whimper expresivo de animalito con sentimiento)
    this._createExpressiveWhimper(now + 0.08, 560, 290, 0.40, 0.22, true);
    this._createExpressiveWhimper(now + 0.50, 480, 240, 0.50, 0.18, true);

    // 3. Suspiro de aire suave y reconfortante
    this._createSniffle(now + 0.85, 0.35);
  }

  /**
   * Tono expresivo de "casi casi": armónico suave, sensación de que estuvo muy cerca
   */
  _playNearMissTone(startTime, startFreq, endFreq, duration, volume = 0.15) {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const oscHarmonic = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), startTime + duration);

    oscHarmonic.type = 'triangle';
    oscHarmonic.frequency.setValueAtTime(startFreq * 1.5, startTime);
    oscHarmonic.frequency.exponentialRampToValueAtTime(Math.max(60, endFreq * 1.5), startTime + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, startTime);
    filter.frequency.exponentialRampToValueAtTime(350, startTime + duration);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    oscHarmonic.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
    oscHarmonic.start(startTime);
    oscHarmonic.stop(startTime + duration + 0.05);
  }

  /**
   * Genera un quejido expresivo de Hubzi con formante vocal orgánico y vibrato
   */
  _createExpressiveWhimper(startTime, startFreq, endFreq, duration, volume = 0.2, withVibrato = true) {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq * 0.9, startTime);
    osc.frequency.linearRampToValueAtTime(startFreq, startTime + 0.06);
    osc.frequency.exponentialRampToValueAtTime(Math.max(50, endFreq), startTime + duration);

    if (withVibrato) {
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(8.5, startTime); // Temblor suave con sentimiento
      lfoGain.gain.setValueAtTime(18, startTime);
      lfo.connect(osc.frequency);
      lfo.start(startTime);
      lfo.stop(startTime + duration);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, startTime);
    filter.frequency.exponentialRampToValueAtTime(450, startTime + duration);
    filter.Q.setValueAtTime(2.5, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  /**
   * Simula un resoplido / suspiro suave
   */
  _createSniffle(startTime, duration = 0.3) {
    if (!this.ctx) return;

    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, startTime);
    filter.frequency.exponentialRampToValueAtTime(1200, startTime + duration * 0.6);
    filter.Q.setValueAtTime(3.5, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(0.08, startTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(startTime);
  }

  /**
   * Sonido de victoria / acierto de Hubzi (Happy Chittering & Chime celestial)
   * Expresivo, con sentimiento de logro, campana armónica y gorgoritos alegres.
   */
  playCapyHappy() {
    if (isGlobalMuted()) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // 1. Chime de acierto dulce y cálido (Do5 - Mi5 - Sol5 - Do6)
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const startTime = now + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.05, startTime + 0.15);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.30);
    });

    // 2. Gorgorito tierno de Hubzi de fondo (Chittering de alegría)
    const chitterOsc = this.ctx.createOscillator();
    const chitterGain = this.ctx.createGain();
    chitterOsc.type = 'triangle';
    chitterOsc.frequency.setValueAtTime(880, now + 0.1);
    chitterOsc.frequency.exponentialRampToValueAtTime(1400, now + 0.35);

    chitterGain.gain.setValueAtTime(0.001, now + 0.1);
    chitterGain.gain.linearRampToValueAtTime(0.10, now + 0.15);
    chitterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.40);

    chitterOsc.connect(chitterGain);
    chitterGain.connect(this.ctx.destination);
    chitterOsc.start(now + 0.1);
    chitterOsc.stop(now + 0.42);
  }
}

export const capyAudio = new HubziAudioEngine();
