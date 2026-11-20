import { afterEach, describe, expect, it } from "vitest";
import { decodeEmailPdf, emailDocumentInput, MAX_EMAIL_PDF_BYTES } from "./routers/documents";
import { mailerConfigured, sendMail, setMailTransportFactoryForTests } from "./mailer";

const validPdf = Buffer.from(`%PDF-1.7\n${"x".repeat(128)}`);
const validInput = { id: 1, pdfBase64: validPdf.toString("base64"), filename: "FAC-1.pdf", subject: "Facture 1", message: "Bonjour" };

afterEach(() => {
  setMailTransportFactoryForTests(null);
  delete process.env.SMTP_URL;
  delete process.env.MAIL_FROM;
  delete process.env.MAIL_TRANSPORT;
});

describe("documents.email validation and transport", () => {
  it("accepte un petit PDF avec nom de fichier contraint", () => {
    expect(emailDocumentInput.parse(validInput)).toMatchObject({ id: 1, filename: "FAC-1.pdf" });
    expect(decodeEmailPdf(validInput.pdfBase64).subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("refuse les faux PDF et les payloads dépassant 5 Mo", () => {
    expect(() => decodeEmailPdf(Buffer.from("<html>" + "x".repeat(128)).toString("base64"))).toThrow(/PDF/);
    expect(() => decodeEmailPdf(Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(MAX_EMAIL_PDF_BYTES)]).toString("base64"))).toThrow(/5 Mo/);
  });
  it("refuse les en-têtes de mail injectés et les chaînes base64 invalides", () => {
    expect(() => emailDocumentInput.parse({ ...validInput, subject: "Facture\r\nBcc: attacker@example.test" })).toThrow();
    expect(() => emailDocumentInput.parse({ ...validInput, filename: "doc.pdf\r\nBcc:evil" })).toThrow();
    expect(() => emailDocumentInput.parse({ ...validInput, pdfBase64: "%%%" })).toThrow();
  });
  it("retourne sans SMTP un état non délivré, sans essayer d’envoyer de mail", async () => {
    expect(mailerConfigured()).toBe(false);
    await expect(sendMail({ to: "client@example.test", subject: "Facture", text: "Bonjour" })).resolves.toEqual({ delivered: false });
  });
  it("transmet pièce jointe et reply-to via un transport mock, sans loguer le contenu", async () => {
    process.env.SMTP_URL = "smtp://mock.invalid";
    process.env.MAIL_FROM = "robot@example.test";
    let captured: Record<string, unknown> | undefined;
    setMailTransportFactoryForTests(() => ({ sendMail: async message => { captured = message; return {}; } }));
    await expect(sendMail({ to: "client@example.test", subject: "Facture", text: "Bonjour", replyTo: "entreprise@example.test", attachments: [{ filename: "FAC-1.pdf", content: validPdf, contentType: "application/pdf" }] })).resolves.toEqual({ delivered: true });
    expect(captured).toMatchObject({ to: "client@example.test", replyTo: "entreprise@example.test", attachments: [{ filename: "FAC-1.pdf", contentType: "application/pdf" }] });
  });
});
