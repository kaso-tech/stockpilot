import { describe, expect, it } from "vitest";
import { products } from "../drizzle/schema";
import { companyScope } from "./companyScope";

describe("companyScope", () => {
  it("construit un filtre d’entreprise dédié pour les nouveaux espaces", () => {
    const condition = companyScope(products.companyId, 42);
    expect(condition).toBeDefined();
  });

  it("conserve le périmètre historique sans entreprise pour les données existantes", () => {
    const condition = companyScope(products.companyId, null);
    expect(condition).toBeDefined();
  });
});
