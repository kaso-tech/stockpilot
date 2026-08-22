export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let cell = ""; let row: string[] = []; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; }
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[index + 1] === "\n") index += 1; row.push(cell); if (row.some(value => value.trim())) rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  row.push(cell); if (row.some(value => value.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map(header => header.trim().toLowerCase());
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])));
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escape = (value: string | number | null | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const content = [headers.map(escape).join(","), ...rows.map(row => row.map(escape).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

export async function readCsvFile(file: File) { if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Sélectionnez un fichier CSV."); return parseCsv(await file.text()); }
