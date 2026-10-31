/**
 * Configuración de bandas de edad — espejo de backend/app/core/age_bands.py.
 * El backend es la fuente de verdad para GENERACIÓN de contenido;
 * este archivo gobierna la EXPERIENCIA en el cliente (densidad, TTS, celebración).
 */

export const AGE_BANDS = {
  sprout: {
    label: 'Semillita',
    minAge: 4, maxAge: 7,
    cardsPerRound: 3,
    showMap: false,
    autoTts: true,
    celebration: 'max',
    pressure: false,
    sessionMinutes: 5,
    requiresParentalConsent: true,
  },
  explorer: {
    label: 'Explorador',
    minAge: 8, maxAge: 10,
    cardsPerRound: 4,
    showMap: true,
    autoTts: true,
    celebration: 'high',
    pressure: false,
    sessionMinutes: 10,
    requiresParentalConsent: true,
  },
  adventurer: {
    label: 'Aventurero',
    minAge: 11, maxAge: 14,
    cardsPerRound: 5,
    showMap: true,
    autoTts: false,
    celebration: 'medium',
    pressure: false,
    sessionMinutes: 15,
    requiresParentalConsent: false,
  },
  challenger: {
    label: 'Retador',
    minAge: 15, maxAge: 18,
    cardsPerRound: 7,
    showMap: true,
    autoTts: false,
    celebration: 'low',
    pressure: true,
    sessionMinutes: 25,
    requiresParentalConsent: false,
  },
  scholar: {
    label: 'Académico',
    minAge: 19, maxAge: 25,
    cardsPerRound: 8,
    showMap: true,
    autoTts: false,
    celebration: 'low',
    pressure: true,
    sessionMinutes: null,
    requiresParentalConsent: false,
  },
  pro: {
    label: 'Profesional',
    minAge: 26, maxAge: 150,
    cardsPerRound: 8,
    showMap: true,
    autoTts: false,
    celebration: 'minimal',
    pressure: true,
    sessionMinutes: null,
    requiresParentalConsent: false,
  },
};

export const DEFAULT_BAND = 'scholar';

export function bandForAge(age) {
  if (age == null) return DEFAULT_BAND;
  for (const [key, band] of Object.entries(AGE_BANDS)) {
    if (age >= band.minAge && age <= band.maxAge) return key;
  }
  return DEFAULT_BAND;
}

export function getBand(bandKey) {
  return AGE_BANDS[bandKey] || AGE_BANDS[DEFAULT_BAND];
}

export function isMinor(bandKey) {
  return ['sprout', 'explorer', 'adventurer', 'challenger'].includes(bandKey);
}

export function needsParentalConsent(bandKey) {
  return getBand(bandKey).requiresParentalConsent;
}

/** Palabras de ánimo con género — espejo de CHEER_WORDS del backend */
const CHEER_WORDS = {
  masculino: ['campeón', 'genio', 'crack'],
  femenino: ['campeona', 'genia', 'crack'],
  otro: ['crack', 'genio', 'figura'],
  default: ['crack', 'genio'],
};

export function cheerWord(gender) {
  const g = (gender || '').toLowerCase();
  const words = CHEER_WORDS[g] || CHEER_WORDS.default;
  return words[Math.floor(Math.random() * words.length)];
}
