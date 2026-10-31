import i18n from "../i18n";

/**
 * NLP local de respaldo para Hubzi: cuando el backend/IA no responde a tiempo,
 * este analizador determinista cubre intención, ánimo y pistas contextuales.
 * Extraído de ArcadeArena para ser testeable y reutilizable.
 */
export function analyzeIntentLocally(transcript, nodesCtx, handCtx, { boardTitle, username } = {}) {
  const t = i18n.t.bind(i18n);
  const q = transcript.toLowerCase().trim();

  // Frustración / estrés / bloqueo
  const stressKw = [
    "no puedo", "no entiendo", "imposible", "difícil", "odio", "me rindo",
    "ya no", "ayuda", "socorro", "no sé nada", "perdido", "estresado", "ansiedad",
  ];
  if (stressKw.some((kw) => q.includes(kw))) {
    return {
      mood: "love",
      reply: t("nlp.stress"),
      needsZen: true,
    };
  }

  // Saludo
  const greetKw = [
    "hola", "hey", "buenos", "buenas", "qué tal", "cómo estás", "saludos", "ey",
  ];
  if (greetKw.some((kw) => q.includes(kw))) {
    const name = username || t("nlp.champion");
    return {
      mood: "love",
      reply: t("nlp.greet", { name }),
    };
  }

  // Felicidad / logro del usuario
  const happyKw = [
    "gracias", "lo logré", "lo hice", "genial", "bien", "perfecto",
    "me encanta", "amor", "qué fácil",
  ];
  if (happyKw.some((kw) => q.includes(kw))) {
    return {
      mood: "celebrating",
      reply: t("nlp.happy"),
    };
  }

  // Pregunta conceptual / definición
  const defineKw = [
    "qué es", "para qué", "qué significa", "define", "definición",
    "qué hace", "cómo funciona", "explica", "me puedes explicar",
  ];
  if (defineKw.some((kw) => q.includes(kw))) {
    const allNodes = Object.values(nodesCtx);
    const matched = allNodes.find(
      (n) => n.label && q.includes(n.label.toLowerCase().substring(0, 5)),
    );
    if (matched) {
      return {
        mood: "thinking",
        reply: t("nlp.define_m", { label: matched.label, hint: matched.hint || matched.question || t("nlp.define_k") }),
      };
    }
    return {
      mood: "thinking",
      reply: t("nlp.define_g", { title: boardTitle || t("nlp.board_title") }),
    };
  }

  // Pista explícita
  const hintKw = [
    "pista", "ayúdame", "no sé", "cuál", "qué carta", "qué pongo",
    "sugerencia", "consejo", "qué hago",
  ];
  if (hintKw.some((kw) => q.includes(kw))) {
    const unsolved = Object.values(nodesCtx).filter((n) => !n.placedCard);
    if (unsolved.length > 0) {
      const target = unsolved[Math.floor(Math.random() * unsolved.length)];
      const hintCards = handCtx
        .filter((c) => !c.isDistractor)
        .slice(0, 2)
        .map((c) => c.name)
        .join(" o ");
      return {
        mood: "thinking",
        reply: t("nlp.hint_m", { label: target.label, hint: target.hint || target.question?.slice(0, 80) || t("nlp.hint_k"), cards: hintCards ? t("nlp.hint_cards", { cards: hintCards }) : "" }),
      };
    }
    return {
      mood: "happy",
      reply: t("nlp.hint_done"),
    };
  }

  // Fallback contextual inteligente
  const unsolved = Object.values(nodesCtx).filter((n) => !n.placedCard);
  if (unsolved.length > 0) {
    return {
      mood: "love",
      reply: t("nlp.fb_open", { text: transcript.slice(0, 35), label: unsolved[0].label }),
    };
  }
  return {
    mood: "celebrating",
    reply: t("nlp.fb_done", { text: transcript.slice(0, 35) }),
  };
}
