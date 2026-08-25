export type CommercialDocumentType = "invoice" | "quote";

export type CommercialDocumentShareInput = {
  type: CommercialDocumentType;
  documentNumber: string;
  total: string;
  customerName?: string | null;
};

function documentLabel(type: CommercialDocumentType) {
  return type === "quote" ? "devis" : "facture";
}

export function documentShareSubject(input: CommercialDocumentShareInput) {
  return `${input.type === "quote" ? "Devis" : "Facture"} ${input.documentNumber}`;
}

export function documentShareMessage(input: CommercialDocumentShareInput) {
  const name = input.customerName?.trim() ? ` ${input.customerName.trim()}` : "";
  return `Bonjour${name},\n\nVoici votre ${documentLabel(input.type)} ${input.documentNumber}, d’un montant de ${input.total}.\n\nCordialement.`;
}

export function documentEmailMessage(input: CommercialDocumentShareInput) {
  return `${documentShareMessage(input)}\n\nLe PDF du document a été téléchargé : joignez-le à ce message.`;
}

export function normalizedPhone(phone?: string | null) {
  return (phone ?? "").replace(/[^\d]/g, "");
}

export function whatsappShareUrl(phone: string, message: string) {
  return `https://wa.me/${normalizedPhone(phone)}?text=${encodeURIComponent(message)}`;
}

export function smsShareUrl(phone: string, message: string) {
  return `sms:${normalizedPhone(phone)}?body=${encodeURIComponent(message)}`;
}

export function emailShareUrl(email: string, subject: string, message: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}
