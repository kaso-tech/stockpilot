import { z } from "zod";

/** URL de fichier acceptée en entrée : stockage interne ou HTTPS uniquement (jamais `javascript:` ni `data:`). */
export const safeFileUrl = z
  .string()
  .trim()
  .max(1024)
  .refine(
    value => value.startsWith("/manus-storage/") || /^https:\/\//i.test(value),
    "URL de fichier invalide."
  );
