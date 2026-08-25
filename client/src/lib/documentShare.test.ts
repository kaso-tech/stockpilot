import { describe, expect, it } from "vitest";
import { documentShareLink, documentShareMessage } from "./documentShare";

describe("partage de document", () => {
  it("préremplit un message et les trois canaux client", () => {
    const message = documentShareMessage({ documentLabel: "Facture", documentNumber: "FAC-42", customerName: "Client", total: "10 000 FCFA" });
    expect(message).toContain("FAC-42");
    expect(documentShareLink("whatsapp", { phone: "+221 77 000 00 00", subject: "Facture FAC-42", message })).toContain("wa.me/221770000000");
    expect(documentShareLink("sms", { phone: "+221 77 000 00 00", subject: "Facture FAC-42", message })).toContain("sms:221770000000");
    expect(documentShareLink("email", { email: "client@example.com", subject: "Facture FAC-42", message })).toContain("mailto:client%40example.com");
  });
});
