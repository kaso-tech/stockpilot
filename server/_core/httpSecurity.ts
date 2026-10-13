import type { Express, NextFunction, Request, Response } from "express";

/**
 * Nombre de proxys de confiance devant l'application (passerelle d'hébergement).
 * Express s'en sert pour calculer `req.ip` et `req.protocol` sans faire
 * confiance aux en-têtes X-Forwarded-* injectés par le client.
 */
export function trustProxySetting(
  value = process.env.TRUST_PROXY
): boolean | number | string {
  if (value === undefined || value === "") return 1;
  if (value === "true") return true;
  if (value === "false") return false;
  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 0 ? hops : value;
}

/** En-têtes de sécurité communs (équivalent minimal de helmet, sans CSP de script qui casserait le runtime d'hébergement). */
export function securityHeaders(
  isProduction: boolean,
  frameAncestors = process.env.FRAME_ANCESTORS || "'self'"
) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(self), microphone=(), geolocation=()"
    );
    res.setHeader(
      "Content-Security-Policy",
      `frame-ancestors ${frameAncestors}; object-src 'none'; base-uri 'self'; form-action 'self'`
    );
    if (isProduction)
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    next();
  };
}

/**
 * Protection CSRF de l'API tRPC : les mutations doivent être envoyées en JSON.
 * Un formulaire tiers ne peut produire que des requêtes « simples »
 * (form-urlencoded, multipart, text/plain) ; exiger application/json impose un
 * pré-contrôle CORS que le navigateur refuse pour une autre origine.
 */
export function requireJsonForTrpcMutations(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS")
    return next();
  const contentType = String(req.headers["content-type"] ?? "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    res.status(415).json({ error: "unsupported-media-type" });
    return;
  }
  next();
}

export function registerHttpSecurity(app: Express, isProduction: boolean) {
  app.set("trust proxy", trustProxySetting());
  app.disable("x-powered-by");
  app.use(securityHeaders(isProduction));
  app.use("/api/trpc", requireJsonForTrpcMutations);
}
