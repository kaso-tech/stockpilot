import { describe, expect, it } from "vitest";
import { parseCsv } from "../client/src/lib/csv";

describe("parseCsv", () => {
  it("gère les en-têtes normalisés et les valeurs contenant une virgule", () => {
    expect(parseCsv('Nom,Notes\n"Client A","Note, avec virgule"')).toEqual([{ nom: "Client A", notes: "Note, avec virgule" }]);
  });
});
