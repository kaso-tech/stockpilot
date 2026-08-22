export function assertExplicitInvoiceAgentChoice({ requiresSalesAgentChoice, requiresCashierChoice, salesAgentSelectionMade, cashierSelectionMade }: { requiresSalesAgentChoice: boolean; requiresCashierChoice: boolean; salesAgentSelectionMade: boolean; cashierSelectionMade: boolean }) {
  if (requiresSalesAgentChoice && !salesAgentSelectionMade) throw new Error("Sélectionnez explicitement un agent commercial, y compris l’option Aucun.");
  if (requiresCashierChoice && !cashierSelectionMade) throw new Error("Sélectionnez explicitement un caissier, y compris l’option Aucun.");
}
