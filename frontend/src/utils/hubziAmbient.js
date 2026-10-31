/**
 * HubziAmbient — Música de Fondo Procedural y Calmante para el Juego
 *
 * Genera música ambient directamente con Web Audio API (sin archivos externos).
 * Basada en escala pentatónica menor (la más calmante y armoniosa universalmente).
 * Ideal para reducir ansiedad de examen y mantener el estado de flow del estudiante.
 *
 * Características:
 * - Pad ambient suave (ondas sine moduladas por LFO lento)
 * - Melodía pentatónica aleatoria con notas de piano suave
 * - Notas de bajo profundas y sostenidas
 * - Reverb simulado con ConvolverNode
 * - Control de volumen con fade in/out suave
 */

import { watchVisibility } from './audioLifecycle';
import { isLowPower } from './lowPower';
import { isGlobalMuted, onGlobalMuteChange } from './globalMute';

class HubziAmbientEngine {
  constructor() {
    watchVisibility(() => this.ctx);
    this.ctx = null;
    this.masterGain = null;
    this.reverbNode = null;
    this.reverbGain = null;
    this.isPlaying = false;
    this.melodyTimerId = null;
    this.padNodes = [];
    this.targetVolume = (() => {
      try {
        const v = parseFloat(localStorage.getItem('hubzy_music_vol'));
        return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.80;
      } catch (_) { return 0.80; }
    })();

    // Escala pentatónica menor en Do: Do, Mib, Fa, Sol, Sib
    // Universalmente calmante — usada en música meditativa y ambient asiático
    this.pentatonicNotes = [
      130.81, // C3
      155.56, // Eb3
      174.61, // F3
      196.00, // G3
      233.08, // Bb3
      261.63, // C4
      311.13, // Eb4
      349.23, // F4
      392.00, // G4
      466.16, // Bb4
      523.25, // C5
      622.25, // Eb5
    ];

    this.bassNotes = [65.41, 77.78, 87.31, 98.00, 116.54];
    this.isMuted = false;
    this._listeners = [];
    this._autoStartArmed = false;
    this._userInteracted = false;

    // Mute global persistente: al mutear la música fadea a 0 en caliente;
    // al desmutear vuelve al volumen objetivo (respetando duck y el mute
    // propio del motor).
    onGlobalMuteChange(() => this._applyGlobalMute());
  }

  _effectiveMuted() {
    return this.isMuted || isGlobalMuted();
  }

  _applyGlobalMute() {
    if (this.ctx && this.masterGain && this.isPlaying) {
      const now = this.ctx.currentTime;
      const target = this._effectiveMuted()
        ? 0.0001
        : this.targetVolume * (this._ducked ? 0.3 : 1);
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(target, now + 0.3);
    }
    this._notify();
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

    this.reverbNode = this._createReverb(1.8, 2.0);
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
      } catch (_) { }
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

  _startAmbientPad() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Ciclos armónicos infinitos (progresión meditativa y suave que cambia de textura cada 12 segundos)
    this.chordProgressions = [
      [130.81, 196.00, 261.63, 311.13], // Cm7 (Do, Sol, Do, Mib)
      [116.54, 174.61, 233.08, 293.66], // Bb sus2 (Sib, Fa, Sib, Re)
      [103.83, 155.56, 207.65, 261.63], // Ab maj7 (Lab, Mib, Lab, Do)
      [116.54, 174.61, 220.00, 261.63]  // F minor (Sib/Fa, La, Do)
    ];
    this.currentChordIndex = 0;

    // Crear 4 osciladores estéreo para el fondo etéreo continuo
    this.padOscs = [];
    const baseChord = this.chordProgressions[0];

    baseChord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Ondas suaves con desfase temporal orgánico
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      // LFO ultra lento y envolvente para que el sonido respire y nunca se corte
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.04 + idx * 0.02, now);
      lfoGain.gain.setValueAtTime(3.5, now);
      lfo.connect(osc.frequency);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450 + idx * 80, now);
      filter.Q.setValueAtTime(0.7, now);

      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.linearRampToValueAtTime(0.12 - idx * 0.015, now + 3.0);

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(this.masterGain);
      if (this.reverbNode) {
        oscGain.connect(this.reverbNode);
      }

      osc.start(now);
      lfo.start(now);

      this.padNodes.push({ osc, oscGain, lfo });
      this.padOscs.push(osc);
    });

    // Iniciar el ciclo de transición de acordes infinito y sin costuras
    this._scheduleChordTransition();
  }

  _scheduleChordTransition() {
    if (!this.isPlaying || !this.ctx || !this.padOscs.length) return;

    this.chordTimerId = setTimeout(() => {
      if (!this.isPlaying || !this.ctx) return;
      this.currentChordIndex = (this.currentChordIndex + 1) % this.chordProgressions.length;
      const nextChord = this.chordProgressions[this.currentChordIndex];
      const now = this.ctx.currentTime;

      // Transición ultra suave de frecuencias (Portamento) durante 4 segundos
      this.padOscs.forEach((osc, idx) => {
        if (osc && nextChord[idx]) {
          osc.frequency.cancelScheduledValues(now);
          osc.frequency.setValueAtTime(osc.frequency.value, now);
          osc.frequency.exponentialRampToValueAtTime(nextChord[idx], now + 4.5);
        }
      });

      this._scheduleChordTransition();
    }, 11000);
  }

  _playPianoNote(freq, startTime, volume = 0.16, duration = 2.8) {
    if (!this.ctx || !this.masterGain) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, startTime);

    // Armónico suave para dar calidez y sensación de campana o celesta zen
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, startTime);
    filter.frequency.exponentialRampToValueAtTime(250, startTime + duration);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(volume * 0.45, startTime + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);

    gain.connect(this.masterGain);
    if (this.reverbNode) {
      gain.connect(this.reverbNode);
    }

    osc1.start(startTime);
    osc1.stop(startTime + duration + 0.2);
    osc2.start(startTime);
    osc2.stop(startTime + duration + 0.2);
  }

  _playBassNote(freq, startTime, duration = 6.0) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, startTime);
    filter.Q.setValueAtTime(0.7, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.20, startTime + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.2);
  }

  _scheduleMelody() {
    if (!this.isPlaying || !this.ctx) return;

    const now = this.ctx.currentTime;
    const phraseLength = 2 + Math.floor(Math.random() * 3);
    const tempo = 0.75 + Math.random() * 0.4;

    for (let i = 0; i < phraseLength; i++) {
      const noteIdx = Math.floor(Math.random() * this.pentatonicNotes.length);
      const freq = this.pentatonicNotes[noteIdx];
      const noteStart = now + i * tempo;
      const volume = 0.13 + Math.random() * 0.06;
      const duration = 2.4 + Math.random() * 1.0;
      this._playPianoNote(freq, noteStart, volume, duration);
    }

    if (Math.random() < 0.55) {
      const bassFreq = this.bassNotes[Math.floor(Math.random() * this.bassNotes.length)];
      this._playBassNote(bassFreq, now, 6.0 + Math.random() * 2.5);
    }

    // Intervalo encadenado fluido para que nunca haya silencios bruscos ni sensación de final
    const nextPhraseDelay = phraseLength * tempo + 0.8 + Math.random() * 1.5;
    this.melodyTimerId = setTimeout(() => {
      this._scheduleMelody();
    }, nextPhraseDelay * 1000);
  }

  async start() {
    if (this.isPlaying) return;
    // Modo ligero: sin audio ambiental — los osciladores + convolver
    // consumen CPU constante en gama baja. Solo se omite el AUTO-arranque:
    // si el usuario pulsa el botón de música explícitamente (toggle marca
    // _userInteracted) el audio sí inicia — bloquearlo apaga la música en
    // la mayoría de teléfonos sin forma de recuperarla.
    if (isLowPower() && !this._userInteracted) return;
    if (!this._init()) return;
    await this._resume();
    // Autoplay policy: sin gesto del usuario el ctx queda 'suspended' y
    // resume() no lo desbloquea. Salir sin marcar isPlaying para que un
    // reintento posterior (autoStart con gesto real) sí produzca audio.
    // Chequeo+set en el mismo tick: dos start() concurrentes no duplican.
    if (!this.ctx || this.ctx.state !== 'running' || this.isPlaying) return;

    this.isPlaying = true;

    const now = this.ctx.currentTime;
    const vol = this._effectiveMuted() ? 0.0001 : this.targetVolume;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0.0001, now);
    this.masterGain.gain.linearRampToValueAtTime(vol, now + 1.2);

    this._startAmbientPad();

    this.melodyTimerId = setTimeout(() => {
      this._scheduleMelody();
    }, 800);

    this._notify();
  }

  stop(fadeSec = 1.5) {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.melodyTimerId) {
      clearTimeout(this.melodyTimerId);
      this.melodyTimerId = null;
    }
    if (this.chordTimerId) {
      clearTimeout(this.chordTimerId);
      this.chordTimerId = null;
    }

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);

      setTimeout(() => {
        this.padNodes.forEach(({ osc, lfo }) => {
          try { osc.stop(); } catch (_) { }
          try { lfo.stop(); } catch (_) { }
        });
        this.padNodes = [];
      }, Math.round((fadeSec + 0.1) * 1000));
    }

    this._notify();
  }

  // Ducking: baja la música mientras Hubzi habla — su voz siempre se
  // entiende por encima del ambient (restaura al terminar de hablar).
  duck(active) {
    this._ducked = Boolean(active);
    if (this.ctx && this.masterGain && this.isPlaying && !this._effectiveMuted()) {
      const now = this.ctx.currentTime;
      const target = this.targetVolume * (this._ducked ? 0.3 : 1);
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(target, now + 0.4);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.ctx && this.masterGain && this.isPlaying) {
      const now = this.ctx.currentTime;
      const target = this._effectiveMuted()
        ? 0.0001
        : this.targetVolume * (this._ducked ? 0.3 : 1);
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(target, now + 0.3);
    }
    this._notify();
    return this.isMuted;
  }

  async toggle() {
    this._userInteracted = true; // decisión manual: prevalece sobre autoStart
    if (this.isPlaying) {
      this.stop();
    } else {
      await this.start();
    }
    // Persistir la decisión entre sesiones: sin esto, el autoStart del próximo
    // montaje re-encendía la música que el usuario acababa de apagar.
    try {
      localStorage.setItem(
        'hubzy_ambient_pref',
        this.isPlaying ? 'on' : 'off',
      );
    } catch (_) { }
  }

  /**
   * La música arranca ACTIVADA por defecto.
   * Intenta ya (por si el navegador permite audio sin gesto, p. ej. por
   * Media Engagement Index) y, si el AudioContext queda suspendido, arma
   * listeners one-shot para iniciar en la primera interacción del usuario.
   * Si el usuario usó el botón de música manualmente, su decisión prevalece.
   * Devuelve una función para desarmar los listeners (cleanup de efecto).
   */
  autoStart() {
    if (this._autoStartArmed || this.isPlaying || typeof window === 'undefined')
      return () => {};
    // La música siempre arranca ACTIVA en cada sesión — solo se apaga si el
    // usuario la desactiva manualmente durante la partida.
    this._autoStartArmed = true;
    void this.start();

    const disarm = () => {
      this._autoStartArmed = false;
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
    const onGesture = (e) => {
      disarm();
      // Si el gesto fue sobre el propio botón de música, su onClick decide
      // (evita la carrera pointerdown→start / click→toggle→stop).
      if (e.target?.closest?.('[data-ambient-toggle]')) return;
      if (!this._userInteracted) void this.start();
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    return disarm;
  }

  setVolume(vol) {
    this.targetVolume = Math.max(0, Math.min(1, vol));
    try { localStorage.setItem('hubzy_music_vol', String(this.targetVolume)); } catch (_) {}
    if (this.ctx && this.masterGain && this.isPlaying && !this._effectiveMuted()) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.linearRampToValueAtTime(this.targetVolume, now + 0.5);
    }
  }

  subscribe(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  }

  _notify() {
    this._listeners.forEach(fn => fn({ isPlaying: this.isPlaying, isMuted: this.isMuted }));
  }
}

export const hubziAmbient = new HubziAmbientEngine();
