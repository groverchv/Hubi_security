import { useCallback, useState } from "react";

/**
 * Estado consolidado de Hubzi (Fase 3.2): una sola fuente para la
 * burbuja, el mood y el estado emocional de la compañera.
 *
 * `status` deriva el modo macro: idle | listening | thinking | speaking |
 * alert — la burbuja, el badge y las animaciones leen SIEMPRE del mismo
 * valor, así nunca se des-sincronizan.
 */
export function useHubziState() {
  const [capySpeech, setCapySpeech] = useState({
    text: "",
    isVisible: false,
    mood: "idle",
  });
  const [capyMood, setCapyMood] = useState("idle");
  const [isCapySad, setIsCapySad] = useState(false);

  // Frase en burbuja + mood en una sola acción (los caminos que antes
  // actualizaban uno u otro por separado quedaban desfasados).
  const say = useCallback((text, mood = "talking", extra = {}) => {
    setCapyMood(mood);
    setCapySpeech({ text, isVisible: true, mood, ...extra });
  }, []);

  const hideBubble = useCallback(() => {
    // La oferta de pista espera al jugador: no se auto-oculta.
    setCapySpeech((prev) =>
      prev.showHintButton ? prev : { ...prev, isVisible: false },
    );
  }, []);

  return {
    capySpeech,
    setCapySpeech,
    capyMood,
    setCapyMood,
    isCapySad,
    setIsCapySad,
    say,
    hideBubble,
  };
}

/**
 * Derivación pura del modo macro de Hubzi:
 * alert > listening > thinking > speaking > idle.
 */
export function deriveHubziStatus({
  capyMood,
  capySpeech,
  isCapySad,
  isSpeaking,
  isListening,
  isThinking,
}) {
  if (isCapySad || capyMood === "encouraging" || capySpeech?.mood === "encouraging")
    return "alert";
  if (isListening || capyMood === "listening") return "listening";
  if (isThinking || capyMood === "thinking") return "thinking";
  if (isSpeaking) return "speaking";
  return "idle";
}
