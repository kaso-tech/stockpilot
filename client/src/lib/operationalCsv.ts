export type InventoryExportLine = {
  productName: string;
  reference: string;
  expectedQuantity: number;
  countedQuantity: number | null;
};

export type SalesReportExportLine = {
  reference: string;
  date: Date | string;
  channel: "pos" | "invoice";
  customerName?: string | null;
  status: string;
  totalCents: number;
  amountPaidCents: number;
};

export function escapeOperationalCsvCell(value: unknown) {
  const normalized = String(value ?? "").replace(/[\r\n]+/g, " ").trim();
  const secured = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${secured.replace(/"/g, '""')}"`;
}

function dateValue(value: Date | string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("fr-FR");
}

export function buildInventoryCsv(sessionName: string, lines: InventoryExportLine[]) {
  const header = ["inventaire", "produit", "reference", "quantite_theorique", "quantite_comptee", "ecart"];
  const rows = lines.map(line => [
    sessionName,
    line.productName,
    line.reference,
    line.expectedQuantity,
    line.countedQuantity ?? "",
    line.countedQuantity === null ? "" : line.countedQuantity - line.expectedQuantity,
  ]);
  return [header, ...rows].map(row => row.map(escapeOperationalCsvCell).join(";")).join("\n");
}

export function buildSalesReportCsv(lines: SalesReportExportLine[]) {
  const header = ["reference", "date", "canal", "client", "statut", "total_fcfa", "encaisse_fcfa", "solde_fcfa"];
  const rows = lines.map(line => {
    const remaining = Math.max(0, line.totalCents - line.amountPaidCents);
    return [
      line.reference,
      dateValue(line.date),
      line.channel === "pos" ? "Vente rapide" : "Facture",
      line.customerName || "Client comptoir",
      line.status,
      line.totalCents / 100,
      line.amountPaidCents / 100,
      remaining / 100,
    ];
  });
  return [header, ...rows].map(row => row.map(escapeOperationalCsvCell).join(";")).join("\n");
}

export function downloadOperationalCsv(filename: string, content: string) {
  const blob = new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
