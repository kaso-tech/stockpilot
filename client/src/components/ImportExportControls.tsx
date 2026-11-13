import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadCsv, readCsvFile, type CsvRow } from "@/lib/csv";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export function ImportExportControls({
  filename,
  headers,
  rows,
  onImport,
}: {
  filename: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  onImport: (rows: CsvRow[]) => Promise<{ imported: number; errors: string[] }>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [previewRows, setPreviewRows] = useState<CsvRow[]>([]);
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const rows = await readCsvFile(file);
      if (!rows.length)
        throw new Error("Le fichier ne contient aucune ligne à importer.");
      setPreviewRows(rows);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Import impossible."
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  const confirmImport = async () => {
    try {
      setImporting(true);
      const result = await onImport(previewRows);
      if (result.errors.length)
        toast.warning(`${result.imported} ligne(s) importée(s).`, {
          description: `${result.errors.length} ligne(s) ignorée(s) : ${result.errors[0]}`,
        });
      else toast.success(`${result.imported} ligne(s) importée(s).`);
      setPreviewRows([]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Import impossible."
      );
    } finally {
      setImporting(false);
    }
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={event => importFile(event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={importing}
          className="border-primary/30 text-primary"
        >
          <Upload className="mr-2 h-4 w-4" />
          Importer CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => downloadCsv(filename, headers, rows)}
          className="border-border text-muted-foreground"
        >
          <Download className="mr-2 h-4 w-4" />
          Exporter CSV
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => downloadCsv(`modele_${filename}`, headers, [])}
          className="text-muted-foreground"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Modèle vide
        </Button>
      </div>
      <Dialog
        open={Boolean(previewRows.length)}
        onOpenChange={value => !value && !importing && setPreviewRows([])}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-card text-foreground sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vérifier les données avant import</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {previewRows.length} ligne(s) détectée(s). Les cinq premières lignes
            sont affichées ci-dessous.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  {headers.map(header => (
                    <th key={header} className="px-3 py-2 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {previewRows.slice(0, 5).map((row, index) => (
                  <tr key={index}>
                    {headers.map(header => (
                      <td
                        key={header}
                        className="max-w-44 truncate px-3 py-2 text-foreground"
                      >
                        {row[header.toLowerCase()] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={importing}
              onClick={() => setPreviewRows([])}
            >
              Annuler
            </Button>
            <Button
              disabled={importing}
              onClick={confirmImport}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {importing
                ? "Import en cours…"
                : `Valider ${previewRows.length} ligne(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
