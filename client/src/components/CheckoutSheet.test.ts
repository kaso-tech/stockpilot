import { afterEach, describe, expect, it, vi } from "vitest";
import { printOfflinePosReceipt } from "./CheckoutSheet";

describe("reçu provisoire hors connexion", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("identifie clairement la vente comme provisoire et affiche le règlement", () => {
    const document = { write: vi.fn(), close: vi.fn() };
    const popup = { closed: false, document, focus: vi.fn(), print: vi.fn(), close: vi.fn() };
    vi.stubGlobal("window", { open: vi.fn(() => popup), setTimeout: (callback: () => void) => { callback(); return 0; } });
    const printed = printOfflinePosReceipt({ channel: "pos", customerId: null, salesAgentId: null, cashierId: null, salesAgentSelectionMade: false, cashierSelectionMade: false, note: null, invoiceDiscount: { type: "none", value: 0 }, items: [{ productId: 7, productName: "Article test", productReference: "TEST-7", unitPriceCents: 125000, lineTotalCents: 250000, quantity: 2, discount: { type: "none", value: 0 } }] }, { payments: [{ method: "cash", amountCents: 100000 }] }, 250000, { companyName: "Entreprise test", ticketWidthMm: "80" }, popup as never, "abcde12345");
    expect(printed).toBe(true);
    expect(document.write).toHaveBeenCalledWith(expect.stringContaining("REÇU PROVISOIRE"));
    expect(document.write).toHaveBeenCalledWith(expect.stringContaining("Vente enregistrée hors connexion"));
    expect(document.write).toHaveBeenCalledWith(expect.stringContaining("1 000 FCFA"));
  });
});
