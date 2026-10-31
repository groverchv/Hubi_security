import { describe, it, expect } from "vitest";
import {
  bandForAge, getBand, isMinor, needsParentalConsent, cheerWord, AGE_BANDS,
} from "../utils/ageConfig";

describe("ageConfig (espejo de bandas de edad)", () => {
  it("mapea edades a bandas correctas", () => {
    expect(bandForAge(5)).toBe("sprout");
    expect(bandForAge(9)).toBe("explorer");
    expect(bandForAge(13)).toBe("adventurer");
    expect(bandForAge(17)).toBe("challenger");
    expect(bandForAge(22)).toBe("scholar");
    expect(bandForAge(30)).toBe("pro");
    expect(bandForAge(null)).toBe("scholar");
  });

  it("detecta menores y consentimiento parental", () => {
    expect(isMinor("sprout")).toBe(true);
    expect(isMinor("challenger")).toBe(true);
    expect(isMinor("scholar")).toBe(false);
    expect(needsParentalConsent("sprout")).toBe(true);
    expect(needsParentalConsent("explorer")).toBe(true);
    expect(needsParentalConsent("adventurer")).toBe(false);
  });

  it("bandas infantiles no tienen presión", () => {
    expect(getBand("sprout").pressure).toBe(false);
    expect(getBand("explorer").pressure).toBe(false);
    expect(getBand("adventurer").pressure).toBe(false);
    expect(getBand("scholar").pressure).toBe(true);
  });

  it("cheerWord respeta género", () => {
    for (let i = 0; i < 20; i++) {
      expect(["campeón", "genio", "crack"]).toContain(cheerWord("masculino"));
      expect(["campeona", "genia", "crack"]).toContain(cheerWord("femenino"));
      expect(cheerWord("femenino")).not.toBe("campeón");
      expect(cheerWord("desconocido")).toMatch(/crack|genio/);
    }
  });
});
