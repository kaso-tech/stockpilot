export type DocumentShareChannel = "whatsapp" | "sms" | "email";

export function documentShareMessage({ documentLabel, documentNumber, customerName, total }: { documentLabel: string; documentNumber: string; customerName?: string | null; total: string }) {
  return `Bonjour ${customerName || ""},\n\nVeuillez trouver votre ${documentLabel.toLowerCase()} ${documentNumber} d’un montant de ${total}.\n\nMerci.`.replace("Bonjour ,", "Bonjour,");
}

export function documentShareLink(channel: DocumentShareChannel, { phone, email, subject, message }: { phone?: string | null; email?: string | null; subject: string; message: string }) {
  if (channel === "email") return email ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}` : null;
  const normalizedPhone = phone?.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!normalizedPhone) return null;
  return channel === "whatsapp" ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}` : `sms:${normalizedPhone}?body=${encodeURIComponent(message)}`;
}
