import { describe, expect, it } from "vitest";
import { normalizedRemuneration } from "./remunerationRules";

describe("rémunération conditionnelle", () => {
  it("neutralise la commission pour un salaire fixe", () => expect(normalizedRemuneration("fixed", 250000, 800)).toEqual({ fixedMonthlyCents: 250000, rateBasisPoints: 0 }));
  it("neutralise le fixe pour une commission", () => expect(normalizedRemuneration("commission", 250000, 800)).toEqual({ fixedMonthlyCents: 0, rateBasisPoints: 800 }));
  it("conserve les deux valeurs pour le mode combiné", () => expect(normalizedRemuneration("fixed_plus_commission", 250000, 800)).toEqual({ fixedMonthlyCents: 250000, rateBasisPoints: 800 }));
});
