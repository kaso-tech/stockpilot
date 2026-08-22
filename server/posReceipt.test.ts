import { afterEach, describe, expect, it, vi } from "vitest";
import { printPosReceipt } from "../client/src/components/CheckoutSheet";

describe("reçu POS automatique", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("compose un reçu détaillé et appelle l’impression après encaissement", () => {
    let documentHtml = ""; const print = vi.fn();
    vi.stubGlobal("window", { setTimeout: (callback: () => void) => { callback(); return 1; }, open: vi.fn() });
    const popup = { closed: false, document: { write: (html: string) => { documentHtml += html; }, close: vi.fn() }, focus: vi.fn(), print, close: vi.fn() } as unknown as Window;
    const success = printPosReceipt({ sale: { invoiceNumber: "POS-20260822-001", createdAt: new Date("2026-08-22T10:30:00Z"), totalCents: 18500, amountPaidCents: 18500, paymentMethod: "cash", invoiceDiscountCents: 1500 }, items: [{ productName: "Télévision 32 Smart", quantity: 1, unitPriceCents: 20000, discountCents: 1500, lineTotalCents: 18500 }], payments: [{ method: "cash", amountCents: 10000 }, { method: "mobile_money", amountCents: 8500 }], participants: { seller: { name: "Kadré" }, cashier: { name: "Moussa" }, salesAgent: { name: "Aminata" } } }, { companyName: "Bati Pro", ticketHeader: "Bienvenue", ticketFooter: "Merci", ticketWidthMm: "80" }, popup);
    expect(success).toBe(true);
    expect(documentHtml).toContain("REÇU POS");
    expect(documentHtml).toContain("Télévision 32 Smart");
    expect(documentHtml).toContain("Remise facture");
    expect(documentHtml).toContain("Mobile money");
    expect(documentHtml).toContain("Aminata");
    expect(print).toHaveBeenCalledOnce();
  });
});
