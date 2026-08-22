import { Button } from "@/components/ui/button";
import { downloadCsv, readCsvFile, type CsvRow } from "@/lib/csv";
import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export function ImportExportControls({ filename, headers, rows, onImport }: { filename: string; headers: string[]; rows: Array<Array<string | number | null | undefined>>; onImport: (rows: CsvRow[]) => Promise<{ imported: number; errors: string[] }> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try { setImporting(true); const rows = await readCsvFile(file); if (!rows.length) throw new Error("Le fichier ne contient aucune ligne à importer."); const result = await onImport(rows); if (result.errors.length) toast.warning(`${result.imported} ligne(s) importée(s).`, { description: `${result.errors.length} ligne(s) ignorée(s) : ${result.errors[0]}` }); else toast.success(`${result.imported} ligne(s) importée(s).`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Import impossible."); }
    finally { setImporting(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  return <div className="flex flex-wrap items-center gap-2"><input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={event => importFile(event.target.files?.[0])} /><Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={importing} className="border-primary/30 text-primary"><Upload className="mr-2 h-4 w-4" />{importing ? "Import…" : "Importer CSV"}</Button><Button type="button" variant="outline" size="sm" onClick={() => downloadCsv(filename, headers, rows)} className="border-white/15 text-slate-300"><Download className="mr-2 h-4 w-4" />Exporter CSV</Button></div>;
}
