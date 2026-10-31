import { describe, it, expect } from "vitest";
import { GAME_LEVELS, getLevelInfo } from "../utils/gameConfig";
import { analyzeIntentLocally } from "../utils/localNlp";

describe("GAME_LEVELS", () => {
  it("has exactly 20 progressive levels", () => {
    expect(GAME_LEVELS).toHaveLength(20);
    expect(GAME_LEVELS[0].level).toBe(1);
    expect(GAME_LEVELS[19].level).toBe(20);
  });

  it("level K requires exactly K questions", () => {
    for (const l of GAME_LEVELS) {
      expect(l.questions).toBe(l.level);
    }
  });

  it("level 20 is the boss fight", () => {
    const boss = GAME_LEVELS[19];
    expect(boss.isBoss).toBe(true);
    expect(boss.difficulty).toBe("dificil");
    expect(GAME_LEVELS.filter((l) => l.isBoss)).toHaveLength(1);
  });

  it("traps only appear from level 3 onward", () => {
    expect(GAME_LEVELS[0].hasTraps).toBe(false);
    expect(GAME_LEVELS[1].hasTraps).toBe(false);
    expect(GAME_LEVELS[2].hasTraps).toBe(true);
    expect(GAME_LEVELS[2].trapCount).toBeGreaterThan(0);
  });

  it("getLevelInfo falls back to level 1 for invalid input", () => {
    expect(getLevelInfo(999).level).toBe(1);
    expect(getLevelInfo(7).level).toBe(7);
  });
});

describe("analyzeIntentLocally", () => {
  const nodes = {
    n1: { label: "Fotosíntesis", hint: "Proceso de la planta", question: "¿Qué hace la planta?", placedCard: null },
    n2: { label: "Célula", hint: "Unidad básica", question: "¿Qué es la célula?", placedCard: { id: "c1" } },
  };
  const hand = [
    { name: "Clorofila", isDistractor: false },
    { name: "Trampa", isDistractor: true },
  ];

  it("detects stress and flags Zen need", () => {
    const r = analyzeIntentLocally("no puedo, esto es imposible", nodes, hand, {});
    expect(r.needsZen).toBe(true);
    expect(r.mood).toBe("love");
  });

  it("greets the user by username", () => {
    const r = analyzeIntentLocally("hola capi", nodes, hand, { username: "Ana" });
    expect(r.reply).toContain("Ana");
    expect(r.mood).toBe("love");
  });

  it("falls back to a default name without username", () => {
    const r = analyzeIntentLocally("hola", nodes, hand, {});
    expect(r.reply).toContain("campeón");
  });

  it("celebrates happy messages", () => {
    const r = analyzeIntentLocally("lo logré, genial", nodes, hand, {});
    expect(r.mood).toBe("celebrating");
  });

  it("answers conceptual questions using matching node context", () => {
    const r = analyzeIntentLocally("qué es fotosíntesis", nodes, hand, {});
    expect(r.reply).toContain("Fotosíntesis");
    expect(r.mood).toBe("thinking");
  });

  it("gives hints pointing to unsolved nodes", () => {
    const r = analyzeIntentLocally("dame una pista", nodes, hand, {});
    expect(r.reply).toContain("Fotosíntesis");
    expect(r.reply).toContain("Clorofila");
    expect(r.reply).not.toContain("Trampa");
  });

  it("hints celebrate when everything is solved", () => {
    const solved = { n1: { ...nodes.n1, placedCard: {} } };
    const r = analyzeIntentLocally("pista por favor", solved, hand, {});
    expect(r.mood).toBe("happy");
  });

  it("falls back contextually for unmatched input", () => {
    const r = analyzeIntentLocally("blargh something random", nodes, hand, {});
    expect(r.reply).toContain("Fotosíntesis");
    expect(r.mood).toBe("love");
  });
});
