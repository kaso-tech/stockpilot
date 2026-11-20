export type RemunerationMode = "fixed" | "commission" | "fixed_plus_commission";

export function normalizedRemuneration(mode: RemunerationMode, fixedMonthlyCents: number, rateBasisPoints: number) {
  return {
    fixedMonthlyCents: mode === "commission" ? 0 : fixedMonthlyCents,
    rateBasisPoints: mode === "fixed" ? 0 : rateBasisPoints,
  };
}
