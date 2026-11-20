import { describe, expect, it } from "vitest";
import { BULK_DELETE_CONFIRMATION, hasBulkDeleteConfirmation, normalizeBulkDeleteIds } from "./bulkDeleteRules";

describe("bulk delete safeguards", () => {
  it("normalise la sélection sans répéter une même donnée", () => {
    expect(normalizeBulkDeleteIds([9, 3, 9, 2])).toEqual([2, 3, 9]);
  });

  it("exige la phrase de confirmation complète", () => {
    expect(hasBulkDeleteConfirmation(BULK_DELETE_CONFIRMATION)).toBe(true);
    expect(hasBulkDeleteConfirmation("supprimer")).toBe(false);
    expect(hasBulkDeleteConfirmation("SUPPRIMER  ")).toBe(true);
  });
});
