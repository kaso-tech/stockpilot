import { and, eq, sql } from "drizzle-orm";
import { documentSequences } from "../drizzle/schema";

export type DocumentSeries = "FAC" | "POS" | "DEV" | "AV" | "BC";

/**
 * Attribue le prochain numéro d'une série pour l'entreprise et l'année (E5).
 * À appeler dans la transaction qui crée le document : la ligne du compteur reste
 * verrouillée jusqu'au commit (pas de doublon) et un rollback annule l'incrément
 * (pas de trou).
 */
export async function nextDocumentNumber(
  tx: any,
  companyId: number,
  series: DocumentSeries,
  year: number
) {
  await tx
    .insert(documentSequences)
    .values({ companyId, series, year, lastValue: 1 })
    .onDuplicateKeyUpdate({
      set: { lastValue: sql`${documentSequences.lastValue} + 1` },
    });
  const row = (
    await tx
      .select({ lastValue: documentSequences.lastValue })
      .from(documentSequences)
      .where(
        and(
          eq(documentSequences.companyId, companyId),
          eq(documentSequences.series, series),
          eq(documentSequences.year, year)
        )
      )
      .limit(1)
  )[0];
  if (!row) throw new Error("Compteur de numérotation introuvable.");
  return formatDocumentNumber(series, year, row.lastValue);
}

export function formatDocumentNumber(
  series: DocumentSeries,
  year: number,
  value: number
) {
  return `${series}-${year}-${String(value).padStart(6, "0")}`;
}
