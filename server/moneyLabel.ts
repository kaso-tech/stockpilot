// Montant lisible pour le journal d'activité. Les montants sont stockés en centimes (× 100).
export function moneyLabel(cents: number) {
  const amount = Math.round(cents / 100);
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount).replace(/\u202f|\u00a0/g, " ")} FCFA`;
}
