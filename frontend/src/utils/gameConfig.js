// 20 NIVELES DE PROGRESIÓN PEDAGÓGICA (Nivel K = K preguntas)
// Nivel 20 = Batalla Final contra Hubzi Boss
export const GAME_LEVELS = Array.from({ length: 20 }, (_, i) => {
  const lvl = i + 1;
  const isBoss = lvl === 20;
  const hasTraps = lvl >= 3;
  const trapCount = lvl < 8 ? 1 : lvl < 15 ? 2 : 3;

  let difficulty = "facil";
  let diffLabel = "Iniciación";
  if (lvl >= 16) {
    difficulty = "dificil";
    diffLabel = isBoss ? "JEFE FINAL" : "Maestro";
  } else if (lvl >= 11) {
    difficulty = "semidificil";
    diffLabel = "Avanzado";
  } else if (lvl >= 6) {
    difficulty = "normal";
    diffLabel = "Intermedio";
  } else if (lvl >= 3) {
    difficulty = "seminormal";
    diffLabel = "En Progreso";
  }

  return {
    level: lvl,
    name: isBoss ? "Duelo Legendario: Hubzi Boss" : `Fase ${lvl}: ${diffLabel}`,
    questions: lvl, // Exactamente K preguntas en el nivel K
    difficulty,
    hasTraps,
    trapCount: hasTraps ? trapCount : 0,
    isBoss,
    desc: isBoss
      ? "¡Enfrenta al Gran Hubzi en el examen definitivo de 20 reactivos! Derrótalo acertando el circuito."
      : hasTraps
        ? `Resuelve los ${lvl} nodos con atención: ¡Hay ${trapCount} carta(s) trampa en tu mazo!`
        : `Circuito inicial de ${lvl} pregunta(s) directa(s).`,
  };
});

export const getLevelInfo = (level) =>
  GAME_LEVELS.find((l) => l.level === level) || GAME_LEVELS[0];

// Nombre/desc traducibles del nivel (i18n): el objeto guarda solo datos
// crudos (level/difficulty/hasTraps/...); el texto se resuelve al pintar.
export const levelName = (lvl, t) => {
  if (!lvl) return "";
  if (lvl.isBoss) return t("levels.boss_name");
  const diff =
    lvl.difficulty ||
    (lvl.level >= 16 ? "dificil" : lvl.level >= 11 ? "semidificil" : lvl.level >= 6 ? "normal" : lvl.level >= 3 ? "seminormal" : "facil");
  return t("levels.name", { level: lvl.level, label: t("levels.diff_" + diff) });
};
export const levelDesc = (lvl, t) => {
  if (!lvl) return "";
  if (lvl.isBoss) return t("levels.desc_boss");
  if (lvl.hasTraps)
    return t("levels.desc_traps", { count: lvl.questions, traps: lvl.trapCount });
  return t("levels.desc_plain", { count: lvl.questions });
};
