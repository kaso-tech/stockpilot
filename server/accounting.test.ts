import { describe, expect, it } from "vitest";
import { accountingEntries, entriesAreBalanced, fecFile, paymentsJournalCsv, salesJournalCsv, type PaymentRecord, type ReturnRecord, type SaleRecord } from "./accounting";
const date = new Date("2026-11-12T10:00:00.000Z");
const sale: SaleRecord = { id: 1, invoiceNumber: "POS-001", channel: "pos", status: "paid", customerId: 7, customerName: "Client", totalCents: 100_000, vatCents: 10_000, deliveryFeeCents: 0, amountPaidCents: 100_000, returnedCents: 20_000, createdAt: date, voidedAt: null, refundedAt: null, creditNoteNumber: "AV-001" };
const payment: PaymentRecord = { saleId: 1, invoiceNumber: "POS-001", method: "cash", amountCents: 100_000, createdAt: date, customerId: 7, customerName: "Client" };
const refund: PaymentRecord = { ...payment, amountCents: -20_000, createdAt: new Date(date.getTime() + 1000) };
const returned: ReturnRecord = { saleId: 1, creditNoteNumber: "AV-001", refundCents: 20_000, createdAt: new Date(date.getTime() + 1000) };
const dayOf = () => "2026-11-12";
describe("journaux comptables", () => {
  it.each(["pcg", "syscohada"] as const)("produit des écritures %s équilibrées, avec retours et remboursements nets", referential => {
    const entries = accountingEntries({ sales: [sale], returns: [returned], payments: [payment, refund], referential, dayOf, inPeriod: () => true });
    expect(entriesAreBalanced(entries)).toBe(true);
    const fec = fecFile(entries, "20261112");
    expect(fec.split("\r\n")[0]!.split("\t")).toHaveLength(18);
    expect(fec).toContain(referential === "pcg" ? "707000" : "701100");
    expect(fec).toContain("Avoir AV-001");
    expect(fec).toContain("Remboursement POS-001");
    expect(fec).toContain("200,00");
  });
  it("exclut les devis et tickets non encaissés du journal des ventes", () => {
    const quote = { ...sale, id: 2, channel: "quote" as const };
    const draft = { ...sale, id: 3, status: "draft" as const };
    const csv = salesJournalCsv([sale, quote, draft], dayOf);
    expect(csv).toContain("POS-001");
    expect(csv).not.toContain("POS-002");
    expect(csv).not.toContain("POS-003");
  });
  it("neutralise les valeurs textuelles pouvant déclencher une formule tableur", () => {
    const malicious: PaymentRecord = { ...payment, customerName: "=HYPERLINK(\"https://bad.invalid\")" };
    const csv = paymentsJournalCsv([malicious], dayOf);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("Montant (FCFA)");
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
  it("conserve la convention interne de montant StockPilot sans modifier les valeurs sources", () => {
    const csv = paymentsJournalCsv([{ ...payment, amountCents: 100_000 }], dayOf);
    expect(csv).toContain("1000,00");
    expect(payment.amountCents).toBe(100_000);
  });
  it("n’émet que des champs contrôlés et assainit les délimiteurs du FEC", () => {
    const entries = accountingEntries({ sales: [{ ...sale, invoiceNumber: "POS\t001" }], returns: [], payments: [], referential: "syscohada", dayOf, inPeriod: () => true });
    expect(fecFile(entries, "20261112")).toContain("POS 001");
    expect(entriesAreBalanced(entries)).toBe(true);
  });
});
