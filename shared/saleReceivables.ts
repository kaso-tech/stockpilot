export function isReceivableInvoice(sale: { channel: string; status: string }) {
  return sale.channel === "invoice" && (sale.status === "draft" || sale.status === "partial");
}
