const _t = i18n.t.bind(i18n);
import { useEffect, useRef, useState } from "react";

const LISTEN_GREETINGS = [
  _t("speech.invite_1"),
  _t("speech.invite_2"),
  _t("speech.invite_3"),
  _t("speech.invite_4"),
];

// Idiomas en orden de preferencia según la región del usuario —
// es-419/es-MX funciona mejor que es-ES en gran parte de LatAm.
function pickRecognitionLang() {
  const navLangs =
    typeof navigator !== "undefined" && navigator.languages
      ? navigator.languages
      : [navigator?.language || "es"];
  const has = (code) =>
    navLangs.some((l) => (l || "").toLowerCase().startsWith(code.toLowerCase()));
  if (has("es-419") || has("es-mx") || has("es-bo") || has("es-pe") || has("es-ar") || has("es-co"))
    return "es-419";
  if (has("es")) return "es-ES";
  return "es-ES";
}

/**
 * Reconocimiento de voz (Web Speech API) con mensajes emotivos de Hubzi.
 * - onTranscript(text): se invoca con el dictado final del usuario.
 * - onFeedback(text): mensajes de estado para mostrar en la burbuja de Hubzi.
 * - onInterim(text|null): transcripción parcial en vivo mientras el usuario
 *   dicta (null al cerrar: resultado final, error o micrófono detenido).
 *
 * Robusto multiplataforma:
 * - Pre-chequeo de permiso de micrófono vía getUserMedia (sin él, Chrome
 *   puede fallar silenciosamente).
 * - Errores específicos por tipo (permiso, servicio, red, mic ocupado).
 * - Solo funciona en contexto seguro (HTTPS o localhost) — se avisa si no.
 * - continuous+interimResults: no corta dictados largos ni pausas medias.
 */
import i18n from "../i18n";

export function useSpeechRecognition({ onTranscript, onFeedback, onInterim }) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);

  // Al desmontar, soltar el micrófono: un recognition vivo seguía escuchando
  // (y capturando audio) con el componente ya fuera de pantalla.
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      try {
        if (recognitionRef.current) {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
          recognitionRef.current = null;
        }
      } catch (_) {}
    };
  }, []);

  const stopListening = () => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setIsListening(false);
    onInterim?.(null);
  };

  const toggleMicrophone = async () => {
    if (isListening) {
      stopListening();
      return;
    }

    const SpeechRec =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      onFeedback?.(
        _t("speech.no_support"),
      );
      return;
    }

    // Contexto seguro obligatorio: en http:// (no localhost) el servicio de
    // voz falla con "network"/"not-allowed" sin pista clara al usuario.
    if (window.isSecureContext === false) {
      onFeedback?.(
        _t("speech.no_https"),
      );
      return;
    }

    // Pre-chequeo de permiso del mic: getUserMedia es la forma fiable de
    // saber si el navegador permitirá capturar audio antes de arrancar.
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch (permErr) {
      const name = permErr?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        onFeedback?.(
          _t("speech.denied"),
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        onFeedback?.(
          _t("speech.no_device"),
        );
      } else if (name === "NotReadableError" || name === "AbortError") {
        onFeedback?.(
          _t("speech.busy"),
        );
      } else {
        onFeedback?.(
          _t("speech.no_access"),
        );
      }
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = pickRecognitionLang();
      recognition.continuous = true; // no cortar pausas medias del dictado
      recognition.interimResults = true; // feedback mientras habla
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        onFeedback?.(
          LISTEN_GREETINGS[Math.floor(Math.random() * LISTEN_GREETINGS.length)],
        );
      };

      recognition.onresult = async (event) => {
        // Solo actuar sobre el resultado FINAL; el interim alimenta la
        // burbuja de transcripción en vivo (canal dedicado, no feedback).
        const last = event.results[event.results.length - 1];
        if (!last?.isFinal) {
          const interim = last?.[0]?.transcript;
          if (interim) onInterim?.(interim.trim());
          return;
        }
        const transcript = last?.[0]?.transcript;
        shouldListenRef.current = false;
        setIsListening(false);
        onInterim?.(null);
        if (transcript && transcript.trim()) {
          await onTranscript?.(transcript.trim());
        }
      };

      recognition.onerror = (err) => {
        console.warn("Speech recognition error:", err);
        shouldListenRef.current = false;
        setIsListening(false);
        onInterim?.(null);
        const kind = err?.error;
        if (kind === "not-allowed" || kind === "service-not-allowed") {
          onFeedback?.(
            _t("speech.denied2"),
          );
        } else if (kind === "no-speech") {
          onFeedback?.(
            _t("speech.no_speech"),
          );
        } else if (kind === "audio-capture") {
          onFeedback?.(
            _t("speech.capture"),
          );
        } else if (kind === "network") {
          onFeedback?.(
            _t("speech.network"),
          );
        } else if (kind === "aborted") {
          // Cancelación propia o del sistema: silenciar, sin mensaje
        } else {
          onFeedback?.(
            _t("speech.mic_fail"),
          );
        }
      };

      recognition.onend = () => {
        // Con continuous=true el navegador puede cortar por timeout propio:
        // si el usuario sigue queriendo hablar, reiniciamos transparentemente.
        if (shouldListenRef.current) {
          try {
            recognition.start();
            return;
          } catch (_) {}
        }
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      shouldListenRef.current = true;
      recognition.start();
    } catch (err) {
      console.warn("Error iniciando micrófono:", err);
      shouldListenRef.current = false;
      setIsListening(false);
      onFeedback?.(
        _t("speech.mic_fail"),
      );
    }
  };

  return { isListening, toggleMicrophone };
}
