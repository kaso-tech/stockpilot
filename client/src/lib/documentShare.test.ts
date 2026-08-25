import { describe, expect, it } from "vitest";
import { documentEmailMessage, documentShareMessage, documentShareSubject, emailShareUrl, normalizedPhone, smsShareUrl, whatsappShareUrl } from "./documentShare";

describe("documentShare", () => {
  const invoice = { type: "invoice" as const, documentNumber: "FAC-0042", total: "25 000 FCFA", customerName: "Awa" };

  it("compose un sujet et un message adaptés à la facture ou au devis", () => {
    expect(documentShareSubject(invoice)).toBe("Facture FAC-0042");
    expect(documentShareMessage(invoice)).toContain("Voici votre facture FAC-0042");
    expect(documentShareSubject({ ...invoice, type: "quote" })).toBe("Devis FAC-0042");
    expect(documentShareMessage({ ...invoice, type: "quote" })).toContain("Voici votre devis FAC-0042");
  });

  it("prépare des liens WhatsApp, SMS et e-mail avec le destinataire et le message", () => {
    const message = documentShareMessage(invoice);
    expect(normalizedPhone("+226 70 00 00 00")).toBe("22670000000");
    expect(whatsappShareUrl("+226 70 00 00 00", message)).toContain("wa.me/22670000000?text=");
    expect(smsShareUrl("+226 70 00 00 00", message)).toContain("sms:22670000000?body=");
    expect(emailShareUrl("awa@example.test", documentShareSubject(invoice), documentEmailMessage(invoice))).toContain("mailto:awa%40example.test?subject=");
  });
});
