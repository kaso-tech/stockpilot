import { formatCurrency } from "@/lib/format";

type QuoteLine = { productName: string; quantity: number; unitPriceCents: number; lineTotalCents: number };

/** Texte du devis envoyé au client (WhatsApp). */
export function quoteShareText(quote: { number: string; customerName: string | null; agentName: string | null; items: QuoteLine[]; totalCents: number; note?: string | null }) {
  const lines = quote.items.map(item => `• ${item.productName} × ${item.quantity} : ${formatCurrency(item.lineTotalCents)}`);
  return [
    `Bonjour${quote.customerName ? ` ${quote.customerName}` : ""},`,
    "",
    `Voici votre devis ${quote.number} :`,
    ...lines,
    "",
    `Total : ${formatCurrency(quote.totalCents)}`,
    ...(quote.note ? ["", quote.note] : []),
    "",
    quote.agentName ? `${quote.agentName}, votre conseiller commercial.` : "Votre conseiller commercial.",
  ].join("\n");
}

/** Lien WhatsApp vers le numéro du client (format international) ou, sans numéro, au choix du contact. */
export function whatsappLink(phone: string | null, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return `https://wa.me/${digits.length >= 8 ? digits : ""}?text=${encodeURIComponent(text)}`;
}
