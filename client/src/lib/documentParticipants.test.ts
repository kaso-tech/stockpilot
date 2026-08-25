import { describe, expect, it } from "vitest";
import { documentParticipantNames, matchesDocumentParticipant, type DocumentParticipant } from "./documentParticipants";

const participants: DocumentParticipant[] = [
  { key: "seller:4", name: "Vendeur principal", role: "Vendeur" },
  { key: "agent:8", name: "Agent commercial", role: "Agent commercial" },
  { key: "agent:9", name: "Caissier", role: "Caissier" },
];

describe("document participant filters", () => {
  const document = { sellerUserId: 4, salesAgentId: 8, cashierId: 9 };

  it("filtre indépendamment le vendeur et les agents", () => {
    expect(matchesDocumentParticipant(document, "seller:4")).toBe(true);
    expect(matchesDocumentParticipant(document, "agent:8")).toBe(true);
    expect(matchesDocumentParticipant(document, "agent:9")).toBe(true);
    expect(matchesDocumentParticipant(document, "seller:8")).toBe(false);
  });

  it("compose un libellé d’export complet sans exposer les références internes", () => {
    expect(documentParticipantNames(document, participants)).toBe("Vendeur principal / Agent commercial / Caissier");
  });
});
