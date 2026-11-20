import { describe, expect, it } from "vitest";
import { parseTicketInvoicePrefill } from "./ticketInvoicePrefill";

describe("parseTicketInvoicePrefill", () => {
  it("conserve les lignes valides et écarte les lignes ou brouillons invalides", () => {
    expect(parseTicketInvoicePrefill(JSON.stringify({ customerId: 2, items: [{ productId: 4, quantity: 3, unitPriceCents: 12500 }, { productId: 0, quantity: 0 }] }))).toEqual({ customerId: 2, salesAgentId: null, cashierId: null, items: [{ productId: 4, quantity: 3, unitPriceCents: 12500 }] });
    expect(parseTicketInvoicePrefill("not-json")).toBeNull();
  });
});
