export type CommercialDocumentCsvRow = {
  reference: string;
  date: Date | string;
  client: string;
  statut: string;
  agent: string;
  totalCents: number;
  encaisseCents: number;
};

const escapeCsvCell = (value: string | number) => {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export function buildCommercialDocumentsCsv(rows: CommercialDocumentCsvRow[]) {
  const header = ["Référence", "Date", "Client", "Statut", "Agent associé", "Total (FCFA)", "Encaissé (FCFA)", "Solde (FCFA)"];
  const body = rows.map(row => [row.reference, new Date(row.date).toLocaleString("fr-FR"), row.client, row.statut, row.agent, row.totalCents / 100, row.encaisseCents / 100, Math.max(0, row.totalCents - row.encaisseCents) / 100].map(escapeCsvCell).join(","));
  return `\uFEFF${header.map(escapeCsvCell).join(",")}\n${body.join("\n")}`;
}

export function downloadCommercialDocumentsCsv(filename: string, rows: CommercialDocumentCsvRow[]) {
  const blob = new Blob([buildCommercialDocumentsCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
