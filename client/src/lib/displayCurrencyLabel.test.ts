import { describe, expect, it } from "vitest";
import { displayCurrencyLabel } from "./format";

describe("montants affichés dans le journal", () => {
  it("convertit les anciens messages en centimes en FCFA", () => {
    expect(displayCurrencyLabel("Dépense other de 250000 centimes créée").replace(/\s/g, " ")).toBe("Dépense « Autre » de 2 500 FCFA créée");
    expect(displayCurrencyLabel("POS-1 supprimé avant encaissement (300000 centimes)").replace(/\s/g, " ")).toBe("POS-1 supprimé avant encaissement (3 000 FCFA)");
  });
  it("remplace XOF par FCFA et laisse le reste intact", () => {
    expect(displayCurrencyLabel("Devise XOF")).toBe("Devise FCFA");
    expect(displayCurrencyLabel("3 article(s) retournés")).toBe("3 article(s) retournés");
  });
});
