export function invoiceEmailSubject(invoiceNumber: string) {
  return `Facture ${invoiceNumber}`;
}

export function invoiceEmailMessage(input: { customerName?: string | null; invoiceNumber: string; total: string }) {
  return `Bonjour ${input.customerName || ""},\n\nVeuillez trouver ci-joint votre facture ${input.invoiceNumber}, d’un montant de ${input.total}.\n\nCordialement.`;
}
