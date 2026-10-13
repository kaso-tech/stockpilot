import { TRPCError } from "@trpc/server";

/** Détecte une violation de contrainte d'unicité MySQL, y compris enveloppée par Drizzle. */
export function isDuplicateKeyError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const candidate = current as {
      code?: unknown;
      errno?: unknown;
      cause?: unknown;
    };
    if (candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062)
      return true;
    current = candidate.cause;
  }
  return false;
}

/** Transforme une violation d'unicité en CONFLICT et laisse remonter toute autre erreur. */
export function conflictOr(error: unknown, message: string): never {
  if (error instanceof TRPCError) throw error;
  if (isDuplicateKeyError(error))
    throw new TRPCError({ code: "CONFLICT", message, cause: error });
  throw error;
}
