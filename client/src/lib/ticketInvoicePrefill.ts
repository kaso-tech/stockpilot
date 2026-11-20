export type TicketInvoicePrefill = {
  customerId?: number | null;
  salesAgentId?: number | null;
  cashierId?: number | null;
  items: Array<{ productId: number; quantity: number; unitPriceCents?: number | null }>;
};

export function parseTicketInvoicePrefill(raw: string | null): TicketInvoicePrefill | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TicketInvoicePrefill>;
    if (!Array.isArray(value.items)) return null;
    return {
      customerId: typeof value.customerId === "number" ? value.customerId : null,
      salesAgentId: typeof value.salesAgentId === "number" ? value.salesAgentId : null,
      cashierId: typeof value.cashierId === "number" ? value.cashierId : null,
      items: value.items.filter(item => typeof item?.productId === "number" && Number.isFinite(item.quantity) && item.quantity > 0),
    };
  } catch {
    return null;
  }
}
