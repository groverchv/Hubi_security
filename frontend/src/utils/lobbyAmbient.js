/**
 * LobbyAmbient — Música y Paisaje Sonoro para la Pantalla de Bienvenida / Entrada de Hubzy.
 * 
 * Diseñado específicamente para el "Lobby / Menú Principal" antes de entrar a la batalla.
 * Estilo: Cálido, alegre, tipo "Title Screen" de videojuego cozy (estilo Nintendo / Animal Crossing / Zelda).
 * Diferente a la música in-game (que es pentatónica menor introspectiva para estudio profundo).
 * 
 * Síntesis procedural pura con Web Audio API: cero archivos pesados, latencia cero y sonido armónico cristalino.
 */

import { watchVisibility } from './audioLifecycle';
import { isLowPower } from './lowPower';
import { isGlobalMuted, onGlobalMuteChange } from './globalMute';

class LobbyAmbientEngine {
  constructor() {
    watchVisibility(() => this.ctx);
    this.ctx = null;
    this.masterGain = null;
    this.reverbNode = null;
    this.reverbGain = null;
    this.isPlaying = false;
    this.isMuted = false;
    this.melodyTimer = null;
    this.padNodes = [];
    this.targetVolume = (() => {
      try {
        const v = parseFloat(localStorage.getItem('hubzy_music_vol'));
        return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.38;
      } catch (_) { return 0.38; }
    })();
    this._listeners = [];

    // Notas de título en Sol Mayor brillante (G, A, B, D, E, G):
    this.scaleNotes = [
      392.00, // G4
      440.00, // A4
      493.88, // B4
      587.33, // D5
      659.25, // E5
      783.99, // G5
      880.00, // A5
      987.77, // B5
    ];

    if (typeof window !== 'undefined') {
      try {
        this.isMuted = localStorage.getItem('hubzy_lobby_muted') === 'true';
      } catch (_) {}
    }

    // Mute global persistente: fade inmediato a 0; al desmutear se
    // restaura el volumen o arranca el paisaje si quedó "en espera"
    // (start() marcó isPlaying sin audio mientras estaba muteado).
    onGlobalMuteChange((muted) => {
      if (muted) {
        if (this.ctx && this.masterGain) {
          const now = this.ctx.currentTime;
          this.masterGain.gain.cancelScheduledValues(now);
          this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
          this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
        }
      } else if (this.isPlaying && !this.isMuted) {
        if (!this.ctx) {
          this.isPlaying = false;
          void this.start();
        } else if (this.masterGain) {
          const now = this.ctx.currentTime;
          this.masterGain.gain.cancelScheduledValues(now);
          this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
          this.masterGain.gain.linearRampToValueAtTime(this.targetVolume, now + 0.5);
        }
      }
      this._notify();
    });
  }

  _effectiveMuted() {
    return this.isMuted || isGlobalMuted();
  }

  _init() {
    if (this.ctx) return true;
    if (typeof window === 'undefined') return false;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Reverb espacial cálido
    this.reverbNode = this._createReverb(2.2, 1.8);
    if (this.reverbNode) {
      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.reverbNode.connect(this.reverbGain);
      this.reverbGain.connect(this.masterGain);
    }

    return true;
  }

  async _resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (_) {}
    }
  }

  _createReverb(duration = 2.0, decay = 2.0) {
    if (!this.ctx) return null;
    try {
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const buffer = this.ctx.createBuffer(2, length, sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
      }
      const convolver = this.ctx.createConvolver();
      convolver.buffer = buffer;
      return convolver;
    } catch (_) {
      return null;
    }
  }

  playWelcomeChime() {
    if (this._effectiveMuted()) return;
    if (!this._init()) return;
    this._resume();

    const now = this.ctx.currentTime;
    const chord = [392.00, 493.88, 587.33, 783.99];

    chord.forEach((freq, idx) => {
      const start = now + idx * 0.08;
      this._playBellNote(freq, start, 0.28, 1.2);
    });
  }

  _startCloudPad() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const padFreqs = [196.00, 246.94, 293.66, 440.00];

    padFreqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      lfo.frequency.setValueAtTime(0.06 + idx * 0.02, now);
      lfoGain.gain.setValueAtTime(3.0, now);
      lfo.connect(osc.frequency);

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(750 + idx * 100, now);
      filter.Q.setValueAtTime(1.2, now);

      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.linearRampToValueAtTime(0.12 - idx * 0.02, now + 2.0);

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(this.masterGain);

      if (this.reverbNode) {
        oscGain.connect(this.reverbNode);
      }

      osc.start(now);
      lfo.start(now);

      this.padNodes.push({ osc, oscGain, lfo });
    });
  }

  _playBellNote(freq, startTime, volume = 0.22, duration = 1.4) {
    if (!this.ctx || !this.masterGain) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, startTime);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2.756, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, startTime);
    filter.frequency.exponentialRampToValueAtTime(500, startTime + duration);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    if (this.reverbNode) {
      gain.connect(this.reverbNode);
    }

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration + 0.1);
    osc2.stop(startTime + duration + 0.1);
  }

  _scheduleLobbyMelody() {
    if (!this.isPlaying || !this.ctx) return;

    const now = this.ctx.currentTime;
    const phrases = [
      [0, 2, 4, 3, 2],       // G4, B4, E5, D5, B4
      [2, 3, 5, 4],          // B4, D5, G5, E5
      [4, 3, 2, 0],          // E5, D5, B4, G4
      [1, 3, 4, 5, 7],       // A4, D5, E5, G5, B5
      [5, 4, 2, 0, 2]        // G5, E5, B4, G4, B4
    ];

    const chosenPhrase = phrases[Math.floor(Math.random() * phrases.length)];
    const tempo = 0.38 + Math.random() * 0.08;

    chosenPhrase.forEach((noteIdx, i) => {
      const freq = this.scaleNotes[noteIdx % this.scaleNotes.length];
      const noteStart = now + i * tempo;
      const vol = 0.16 + Math.random() * 0.06;
      this._playBellNote(freq, noteStart, vol, 1.2);
    });

    const nextPhraseTime = (chosenPhrase.length * tempo + 3.2 + Math.random() * 2.8) * 1000;
    this.melodyTimer = setTimeout(() => {
      this._scheduleLobbyMelody();
    }, nextPhraseTime);
  }

  async start() {
    if (this.isPlaying) return;
    // Modo ligero: sin música de lobby SOLO en arranque automático; si el
    // usuario la activa a mano (unmute) debe sonar de verdad.
    if (isLowPower() && !this._userInteracted) {
      this.isPlaying = true;
      this._notify();
      return;
    }
    if (this._effectiveMuted()) {
      // Queda "en espera": al desmutear el listener de globalMute
      // arranca el audio de verdad.
      this.isPlaying = true;
      this._notify();
      return;
    }

    if (!this._init()) return;
    await this._resume();

    this.isPlaying = true;

    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0.0001, now);
    this.masterGain.gain.linearRampToValueAtTime(this.targetVolume, now + 1.2);

    this.playWelcomeChime();
    this._startCloudPad();

    this.melodyTimer = setTimeout(() => {
      this._scheduleLobbyMelody();
    }, 1400);

    this._notify();
  }

  stop(fadeTime = 0.8) {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.melodyTimer) {
      clearTimeout(this.melodyTimer);
      this.melodyTimer = null;
    }

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + fadeTime);

      setTimeout(() => {
        this.padNodes.forEach(({ osc, lfo }) => {
          try { osc.stop(); } catch (_) {}
          try { lfo.stop(); } catch (_) {}
        });
        this.padNodes = [];
      }, (fadeTime + 0.1) * 1000);
    }

    this._notify();
  }

  setVolume(vol) {
    this.targetVolume = Math.max(0, Math.min(1, vol));
    try { localStorage.setItem('hubzy_music_vol', String(this.targetVolume)); } catch (_) {}
    if (this.ctx && this.masterGain && this.isPlaying) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.linearRampToValueAtTime(this.targetVolume, now + 0.5);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('hubzy_lobby_muted', String(this.isMuted));
    } catch (_) {}

    if (this.isMuted) {
      if (this.ctx && this.masterGain) {
        const now = this.ctx.currentTime;
        this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
      }
    } else {
      if (!this.isPlaying) {
        this._userInteracted = true;
        this.start();
      } else if (this.ctx && this.masterGain) {
        const now = this.ctx.currentTime;
        this.masterGain.gain.linearRampToValueAtTime(this.targetVolume, now + 0.5);
      }
    }
    this._notify();
  }

  subscribe(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  }

  _notify() {
    this._listeners.forEach(fn => fn({ 
      isPlaying: this.isPlaying, 
      isMuted: this.isMuted 
    }));
  }
}

export const lobbyAmbient = new LobbyAmbientEngine();
