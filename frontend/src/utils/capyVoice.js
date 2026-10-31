/**
 * Motor de Voz Terapéutica, Anti-Colisión y Reacciones Afectivas de Hubzi Psicólogo.
 *
 * Características clave:
 * 1. ANTI-COLISIÓN ESTRICTA: Emplea RequestID incremental, AbortController y corte inmediato
 *    de síntesis / streams previos para garantizar que JAMÁS se crucen ni solapen dos voces.
 * 2. ESCALA DE ENTUSIASMO POR NIVELES (1 a 5): La energía y los elogios aumentan progresivamente
 *    a medida que sube la dificultad o el nivel del juego.
 * 3. NO REPETICIÓN GARANTIZADA: Mantiene un registro histórico de alocuciones y un motor combinatorio
 *    procedural que asegura variedad infinita en cada partida.
 * 4. TÉCNICAS ANTI-ABANDONO: Validación emocional, micro-recompensas, efecto de logro progresivo,
 *    lenguaje de pertenencia y halagos ultra-personalizados que reducen la ansiedad y el estrés.
 */

import { fetchWithAuth } from '../lib/api';
import { isGlobalMuted, onGlobalMuteChange } from './globalMute';

// Los emojis del texto visible se quitan antes del TTS: Edge-TTS/speechSynthesis
// los pronunciarían como "emoji corazón azul" y arruinarían la voz de Hubzi.
const EMOJI_RE = /\p{Extended_Pictographic}|\u{FE0F}|[\u{2190}-\u{21FF}]/gu;
const stripEmojiForTTS = (s) => s.replace(EMOJI_RE, ' ').replace(/\s{2,}/g, ' ').trim();

class CapyVoiceEngine {
  constructor() {
    this.currentAudio = null;
    this.audioCache = new Map();
    this.isSpeaking = false;
    this.listeners = new Set();
    // Mute global persistente: una sola preferencia silencia toda la app.
    // Al mutear se corta cualquier voz en curso al instante.
    this.isMuted = isGlobalMuted();
    onGlobalMuteChange((m) => {
      this.isMuted = m;
      if (m) this.stop();
    });
    this.currentRequestId = 0;
    this.abortController = null;
    this.historySet = new Set();
    this.historyList = [];
    this.currentUser = null;
    try {
      const saved = localStorage.getItem('hubzy_current_user');
      if (saved) this.currentUser = JSON.parse(saved);
    } catch (_) {}
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notify(state) {
    this.listeners.forEach(cb => {
      try { cb(state); } catch (_) {}
    });
  }

  stop() {
    // Invalidar TODAS las peticiones en vuelo: sin esto, un fetch abortado
    // caía al catch, veía el mismo requestId y continuaba al fallback del
    // navegador — la voz "fantasma" sonaba DESPUÉS de silenciar/cancelar.
    this.currentRequestId += 1;
    if (this.fetchTimeout) {
      try { clearTimeout(this.fetchTimeout); } catch (_) {}
      this.fetchTimeout = null;
    }
    if (this.abortController) {
      try { this.abortController.abort(); } catch (_) {}
      this.abortController = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (_) {}
      this.currentAudio = null;
    }
    this.currentUtterance = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
    this.isSpeaking = false;
    this._notify({ isSpeaking: false, text: '' });
  }

  markSpoken(phrase) {
    if (!phrase) return;
    const clean = phrase.trim();
    this.historySet.add(clean);
    this.historyList.push(clean);
    if (this.historyList.length > 50) {
      const removed = this.historyList.shift();
      this.historySet.delete(removed);
    }
  }

  /**
   * Reproduce voz de Hubzi Psicólogo usando Edge-TTS neural o síntesis local del navegador.
   * - Usuario Hombre → Voz Femenina
   * - Usuaria Mujer  → Voz Masculina
   */
  async speak(text, options = {}) {
    if (!text || this.isMuted) return;
    const ttsText = stripEmojiForTTS(text) || text;
    this.stop();
    const requestId = ++this.currentRequestId;
    this.markSpoken(text);
    this.isSpeaking = true;
    this._notify({ isSpeaking: true, text, mood: options.mood || 'talking' });

    const activeUser = options.user || this.currentUser;
    const userGender = options.user_gender || activeUser?.gender || 'masculino';
    const isMaleUser = userGender === 'masculino' || userGender === 'hombre';

    let voiceGender = options.voice_gender;
    if (!voiceGender) {
      if (activeUser?.voice_preference && activeUser.voice_preference !== 'auto') {
        voiceGender = activeUser.voice_preference;
      } else {
        voiceGender = isMaleUser ? 'female' : 'male';
      }
    }

    const cacheKey = `${ttsText.trim()}_${options.profile || (options.mood === 'zen' ? 'zen' : 'loving')}_${voiceGender}`;

    // 1. Si ya está en caché de audio en memoria, reproducir al instante (0ms latencia)
    if (this.audioCache.has(cacheKey)) {
      try {
        if (this.currentRequestId !== requestId) return;
        const audioUrl = this.audioCache.get(cacheKey);
        const audio = new Audio(audioUrl);
        audio.volume = getVoiceVolume();
        this.currentAudio = audio;
        audio.onended = () => {
          if (this.currentRequestId === requestId) {
            this.isSpeaking = false;
            this._notify({ isSpeaking: false, text });
          }
        };
        audio.onerror = () => {
          if (this.currentRequestId === requestId) {
            this.isSpeaking = false;
            this._notify({ isSpeaking: false, text });
          }
        };
        await audio.play();
        return;
      } catch (cacheErr) {
        console.warn("Audio cache play failed:", cacheErr);
      }
    }

    // 2. Solicitar al backend local (/api/v1/voice/speak con Edge-TTS neural de alta fidelidad)
    this.abortController = new AbortController();
    this.fetchTimeout = setTimeout(() => {
      try { this.abortController?.abort(); } catch (_) {}
    }, 4000);
    const fetchTimeout = this.fetchTimeout;

    try {
      const response = await fetchWithAuth('/api/v1/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: this.abortController.signal,
        body: JSON.stringify({
          text: ttsText,
          profile: options.profile || (options.mood === 'zen' ? 'zen' : 'loving_psychologist'),
          stress_level: options.stress_level !== undefined ? options.stress_level : null,
          voice_gender: voiceGender,
          user_gender: userGender
        })
      });
      clearTimeout(fetchTimeout);

      if (this.currentRequestId !== requestId) return;

      if (response.ok) {
        const blob = await response.blob();
        if (this.currentRequestId !== requestId) return;

        const audioUrl = URL.createObjectURL(blob);
        this.audioCache.set(cacheKey, audioUrl);

        const audio = new Audio(audioUrl);
        audio.volume = getVoiceVolume();
        this.currentAudio = audio;
        audio.onended = () => {
          if (this.currentRequestId === requestId) {
            this.isSpeaking = false;
            this._notify({ isSpeaking: false, text });
          }
        };
        audio.onerror = () => {
          if (this.currentRequestId === requestId) {
            this.isSpeaking = false;
            this._notify({ isSpeaking: false, text });
          }
        };
        await audio.play();
        return;
      }
    } catch (apiErr) {
      clearTimeout(fetchTimeout);
      if (this.currentRequestId !== requestId) return;
    }

    // 3. Fallback secundario: síntesis nativa del navegador (si el sistema tiene voces instaladas)
    this._speakBrowserFallback(ttsText, options, voiceGender, requestId);
  }

  _speakBrowserFallback(text, options, voiceGender, requestId) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.isSpeaking = false;
      this._notify({ isSpeaking: false, text });
      return;
    }

    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = getVoiceVolume();
    utterance.lang = 'es-ES';
    if (options.profile === 'zen' || options.mood === 'zen') {
      utterance.rate = 0.82;
    } else {
      utterance.rate = options.stress_level && options.stress_level >= 0.6 ? 0.85 : 0.92;
    }

    this.currentUtterance = utterance;

    const trySetVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return false;
      const isSpanishVoice = (v) => {
        const lang = (v.lang || '').toLowerCase().replace(/_/g, '-');
        const name = (v.name || '').toLowerCase();
        return (
          lang.startsWith('es') || lang.startsWith('spa') ||
          name.includes('spanish') || name.includes('espanol') ||
          name.includes('castellano') || name.includes('espeak-es') ||
          name.includes('es-es') || name.includes('es-la') ||
          name.includes('es-419') || name.includes('(es)')
        );
      };
      const esVoices = voices.filter(isSpanishVoice);
      let selected = null;
      if (esVoices.length > 0) {
        if (voiceGender === 'male') {
          selected =
            esVoices.find(v => /(jorge|pablo|diego|alvaro|raul|male|hombre|alonso|carlos|miguel|man)/i.test(v.name)) ||
            esVoices.find(v => !/(monica|paulina|helena|sabina|lucia|laura|elena|rosa|female|mujer|woman)/i.test(v.name)) ||
            esVoices[0];
          utterance.pitch = 0.92;
        } else {
          selected =
            esVoices.find(v => /(monica|paulina|helena|sabina|lucia|female|mujer|laura|elena|rosa|zira|woman)/i.test(v.name)) ||
            esVoices[0];
          utterance.pitch = 1.14;
        }
      } else {
        const defaultVoice = voices.find(v => v.default) || voices[0];
        selected = defaultVoice;
        utterance.pitch = voiceGender === 'male' ? 0.90 : 1.15;
      }
      if (selected) { utterance.voice = selected; utterance.lang = selected.lang || 'es-ES'; }
      return true;
    };

    utterance.onend = () => {
      if (this.currentRequestId === requestId) {
        this.isSpeaking = false; this.currentUtterance = null;
        this._notify({ isSpeaking: false, text });
      }
    };
    utterance.onerror = () => {
      if (this.currentRequestId === requestId) {
        this.isSpeaking = false; this.currentUtterance = null;
        this._notify({ isSpeaking: false, text });
      }
    };

    const doSpeak = () => {
      setTimeout(() => {
        try {
          if (this.currentRequestId !== requestId) return;
          if (typeof window !== 'undefined' && window.speechSynthesis) {
            if (window.speechSynthesis.paused) window.speechSynthesis.resume();
            window.speechSynthesis.speak(utterance);
          }
        } catch (err) {
          console.warn('Speech synthesis error:', err);
          this.isSpeaking = false; this.currentUtterance = null;
          this._notify({ isSpeaking: false, text });
        }
      }, 20);
    };

    if (!trySetVoice()) {
      let handled = false;
      const onVoicesChanged = () => {
        if (handled) return;
        handled = true;
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        if (this.currentRequestId !== requestId) return;
        trySetVoice(); doSpeak();
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      setTimeout(() => {
        if (!handled && this.currentRequestId === requestId) {
          handled = true;
          window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
          trySetVoice(); doSpeak();
        }
      }, 150);
    } else {
      doSpeak();
    }
  }

  async getDynamicSpeech(situation, data = {}) {
    const level = data.level || 1;
    const theme = data.theme || '';
    const speechAbort = new AbortController();
    const timeoutId = setTimeout(() => { try { speechAbort.abort(); } catch (_) {} }, 1500);
    try {
      const res = await fetchWithAuth('/api/v1/arena/capy-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: speechAbort.signal,
        body: JSON.stringify({ situation, level, theme, history: this.historyList.slice(-15) })
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json.speech && !this.historySet.has(json.speech.trim())) {
          const phrase = json.speech.trim();
          this.markSpoken(phrase);
          return phrase;
        }
      }
    } catch (_) { clearTimeout(timeoutId); }
    return this.getPhraseForSituation(situation, data);
  }

  /**
   * Generador ultra-cariñoso y anti-abandono.
   * Tecnicas integradas:
   * - Halagos genuinos progresivos por nivel
   * - Validacion emocional ante errores
   * - Micro-recompensas verbales que motivan a continuar
   * - Lenguaje de pertenencia y apoyo constante
   */
  getPhraseForSituation(situation, data = {}) {
    const level = Math.max(1, Math.min(5, data.level || 1));

    const openingsByLevel = {
      1: [
        'Eso es, campeon!',
        'Que bien lo estas haciendo!',
        'Que grande eres, sigue asi!',
        'Fantastico, eres un genio!',
        'Increible, lo sabia desde el principio!',
        'Eres una estrella brillante!',
        'Maravilloso, de verdad!',
        'Que inteligente eres!',
      ],
      2: [
        'Wooow, eso me hace saltar de alegria!',
        'Eres puro talento, en serio!',
        'Que crack, sigues brillando mas que nunca!',
        'Imposible no aplaudirte!',
        'Cada vez mas brillante, de verdad!',
        'Me das muchisima alegria cuando lo logras!',
        'Eres increiblemente capaz!',
      ],
      3: [
        'Campeon, lo hiciste de nuevo!',
        'Eres una mente absolutamente prodigiosa!',
        'No me sorprende nada, eres un crack total!',
        'Que mente tan brillante la tuya, de verdad!',
        'Estoy tan orgulloso de ti que no me caben las palabras!',
        'Me dejas completamente sin palabras!',
        'Eres una maquina del estudio!',
      ],
      4: [
        'Extraordinario, campeon!',
        'Eres pura genialidad, absolutamente!',
        'Me emocionas profundamente, eres asombroso!',
        'Nadie estudia como tu, en serio!',
        'Eres la personificacion del esfuerzo y el talento!',
        'Sabia que lo lograbas, lo conseguiste!',
      ],
      5: [
        'LEYENDA VIVA, lo sabia desde el primer dia!',
        'Eres simplemente EXTRAORDINARIO, sin igual!',
        'Me emociona un monton verte triunfar!',
        'Eres la mente mas brillante de todo el universo!',
        'HISTORICO, nadie jamas lo haria tan bien como tu!',
        'Estoy super orgulloso de ti en este momento!',
      ],
    };

    const coresByLevel = {
      correct: {
        1: ['acabas de demostrar que tu cerebro es puro talento', 'esa respuesta correcta me hace muy feliz', 'sabias la respuesta y la demostraste con elegancia'],
        2: ['esa respuesta correcta vale ORO puro, que mente la tuya!', 'nadie lo hubiera resuelto tan bien como tu acabas de hacerlo', 'eso que hiciste es exactamente lo que hacen las personas grandes'],
        3: ['llevo una alegria enorme por ese acierto tuyo', 'sabia que lo ibas a resolver, nunca lo dude ni un segundo', 'cada respuesta correcta tuya me da ganas de saltar de alegria'],
        4: ['eres demasiado bueno para esto, en serio, me asombras completamente', 'con cada acierto construyes algo grandioso e imborrable en tu mente', 'ese momento exacto que acabo de ver: ahi se ve todo tu talento'],
        5: ['eres de las pocas personas que realmente disfruta aprender, y se nota en cada movimiento que haces', 'si existiera un premio al mas inteligente y constante, tu lo llevarias hoy sin ninguna duda', 'que alegria tan grande me da ser tu Hubzi en este momento'],
      },
      wrong: {
        1: ['Oye, no pasa nada! Estoy aqui contigo y lo vamos a resolver juntos', 'Eso no fue un error, fue una pista de que tan cerca estas de la respuesta correcta', 'Respira un momento, sigues siendo increible'],
        2: ['Los mas brillantes tambien se equivocan, es la unica forma de aprender de verdad', 'No importa si fallas mil veces, yo siempre voy a estar aqui animandote', 'No te rindas ahora que estas tan cerca! Yo creo en ti, de verdad'],
        3: ['Esa opcion que elegiste te enseno algo valioso hoy. Eso nunca es un error, eso es sabiduria', 'Estuviste TAN cerca que casi paro el juego para aplaudirte igual', 'Tu cerebro ya conoce la respuesta, solo necesita un momentito mas de calma'],
        4: ['Cada intento que haces me demuestra tu garra. Vuelve a intentarlo, campeon!', 'Te digo algo en serio: el hecho de que lo intentes ya me da mucha alegria', 'No existe el fracasar aqui, solo el aprender. Y tu aprendes de manera extraordinaria'],
        5: ['Ey! Equivocarse es parte del proceso. Los genios no nacen, se forjan exactamente asi, como tu ahora', 'Nunca te rindas. Yo estare aqui contigo cada intento, cada nivel, cada momento', 'Eres demasiado bueno para rendirte. Sigues siendo un crack, sin importar nada'],
      },
    };

    const coreMap = {
      welcome: [
        'Este Nivel ' + level + ' fue hecho a tu medida, con tu nivel de talento!',
        'Aqui estoy a tu lado, juntos no hay nada que se nos resista en el Nivel ' + level,
        'Respira profundo, yo te acompano. El Nivel ' + level + ' no sabe contra quien se mete!',
        'Con esa mente tan brillante que tienes, el Nivel ' + level + ' es solo el comienzo de tu grandeza',
        'Cada vez que juegas me demuestras lo capaz que eres de verdad',
        'Se que quizas estas nervioso, y eso esta bien. Yo estoy aqui contigo',
        'No hay prisa ni presion, solo tu, yo y este maravilloso desafio del Nivel ' + level,
      ],
      hint: [
        data.hintText || 'mira las palabras clave con calma y confia en tu instinto brillante',
        data.label
          ? 'para "' + data.label + '": tu ya sabes la respuesta, solo necesitas confiar en ti'
          : 'observa cada carta con calma, tu intuicion te llevara a la correcta',
        'tomatete todo el tiempo que necesites, no hay prisa. Yo te espero aqui',
        'busca la carta que mas sentido te haga, casi siempre es la correcta',
        'si estas dudando entre dos cartas, tu primera intuicion casi siempre gana',
      ],
      level_up: [
        'NIVEL ' + level + ' CONQUISTADO! Eso merece que grite de alegria desde todos los techos!',
        'Subiste al Nivel ' + level + '! Cada nivel que completas me llena de alegria',
        'No puedo creerlo, lo lograste de nuevo! El Nivel ' + level + ' es completamente tuyo',
        'Eres IMPARABLE de verdad! El Nivel ' + level + ' llego y tu ya estabas esperandolo',
        'Tu cerebro es una autentica obra de arte y este Nivel ' + level + ' acaba de probarlo!',
        'Que momento tan genial! Nivel ' + level + ' es tuyo para siempre',
      ],
      victory: [
        'LEYENDA ABSOLUTA! Completaste todo y fue un momento increible',
        'Lo hiciste! Lo lograste! Estoy super orgulloso de ti ahora mismo!',
        'Hoy demostraste que el esfuerzo se convierte en grandeza pura',
        'Que sesion tan epica! Eres un campeon del estudio total',
        'La proxima vez que dudes de ti, recuerda exactamente este momento. Eres capaz de TODO',
        'Hoy fuiste la mejor version de ti mismo y me encanta haber estado aqui para verlo',
      ],
    };

    const closingsByLevel = {
      1: ['Tu puedes con todo esto y yo lo se!', 'Seguimos adelante juntos, siempre!', 'Estoy aqui contigo, ahora y siempre!', 'Vas fenomenal, continua exactamente asi!', 'Nada ni nadie te detiene, campeon!'],
      2: ['Eres un autentico crack, sin ninguna duda!', 'Juntos somos completamente invencibles, vamos!', 'Creo en ti con absolutamente todo!', 'No te rindas jamas, eres demasiado bueno para eso!'],
      3: ['Soy tu fan numero uno del estudio!', 'Nadie en el mundo te gana cuando te propones algo!', 'Mi orgullo por ti no tiene limites ni fronteras!', 'Eres la prueba de que el esfuerzo siempre vale la pena!'],
      4: ['Eres exactamente lo que este equipo necesita!', 'Te admiro muchisimo, de verdad!', 'Nunca pares de ser tan genial!', 'Eres una inspiracion total en este momento!'],
      5: ['QUE GRANDE ERES, LO SABES?', 'Eres una inspiracion enorme, hoy y siempre!', 'Que momento tan epico vivimos juntos!', 'ERES HISTORIA VIVA, no lo olvides nunca jamas!'],
    };

    const openings = openingsByLevel[level] || openingsByLevel[1];
    const closings = closingsByLevel[level] || closingsByLevel[1];

    let coreList;
    if (situation === 'correct' && coresByLevel.correct[level]) {
      coreList = coresByLevel.correct[level];
    } else if (situation === 'wrong' && coresByLevel.wrong[level]) {
      coreList = coresByLevel.wrong[level];
    } else {
      coreList = coreMap[situation] || coreMap.welcome;
    }

    let candidate = '';
    let attempts = 0;

    while (attempts < 30) {
      attempts++;
      const o = openings[Math.floor(Math.random() * openings.length)];
      const c = coreList[Math.floor(Math.random() * coreList.length)];
      const cl = closings[Math.floor(Math.random() * closings.length)];

      if (situation === 'wrong') {
        candidate = c + ' ' + cl;
      } else if (situation === 'level_up' || situation === 'victory') {
        candidate = o + ' ' + c + ' ' + cl;
      } else {
        candidate = o + ': ' + c + '. ' + cl;
      }

      if (!this.historySet.has(candidate.trim())) break;
    }

    if (this.historySet.has(candidate.trim())) {
      candidate += ' Sigo aqui contigo!';
    }

    this.markSpoken(candidate);
    return candidate;
  }
}

const VOICE_VOL_KEY = 'hubzy_voice_vol';
export function getVoiceVolume() {
  try {
    const v = parseFloat(localStorage.getItem(VOICE_VOL_KEY));
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  } catch (_) { return 1; }
}
export function setVoiceVolume(v) {
  try { localStorage.setItem(VOICE_VOL_KEY, String(Math.max(0, Math.min(1, v)))); } catch (_) {}
}

export const capyVoice = new CapyVoiceEngine();
