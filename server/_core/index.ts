import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { randomUUID } from "crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { runScheduledBackup } from "../scheduledBackups";
import { registerGoogleDriveRoutes } from "../googleDriveRoutes";
import { serveStatic, setupVite } from "./vite";
import { ensureAdminFallbackPasswordSeed } from "../adminFallbackSeed";
import { registerHttpSecurity } from "./httpSecurity";
import { validateEnvironment } from "./startup";
import { pingDatabase } from "../db";

// Restauration : dataUrl ≤ 30 Mo en base64 ; marge pour l'enveloppe JSON tRPC.
const TRPC_BODY_LIMIT = "32mb";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const { problems, warnings } = validateEnvironment();
  warnings.forEach(warning => console.warn(`[Config] ${warning}`));
  if (problems.length) throw new Error(`Configuration invalide :\n- ${problems.join("\n- ")}`);
  const isProduction = process.env.NODE_ENV === "production";
  const app = express();
  const server = createServer(app);
  registerHttpSecurity(app, isProduction);
  // Corps limités par défaut ; seules les procédures d'import (restauration de
  // sauvegarde, logos, reçus) acceptent des charges plus volumineuses.
  app.use("/api/trpc", express.json({ limit: TRPC_BODY_LIMIT }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  registerStorageProxy(app);
  registerGoogleDriveRoutes(app);
  app.post("/api/scheduled/backup", runScheduledBackup);
  // Sonde de santé pour l'hébergeur et la supervision (P10).
  app.get("/api/health", async (_req, res) => {
    const database = await pingDatabase();
    res.status(database ? 200 : 503).json({ ok: database, database, uptimeSeconds: Math.round(process.uptime()) });
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      // Journalisation des erreurs serveur avec un identifiant de corrélation (P10) ;
      // les erreurs métier attendues (4xx) ne polluent pas les journaux.
      onError({ error, path, type }) {
        if (error.code !== "INTERNAL_SERVER_ERROR") return;
        const correlationId = randomUUID();
        console.error(JSON.stringify({ level: "error", event: "trpc_error", correlationId, path, type, message: error.message, cause: error.cause instanceof Error ? error.cause.message : undefined }));
      },
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  await ensureAdminFallbackPasswordSeed();

  const preferredPort = parseInt(process.env.PORT || "3000");
  // En production, un port occupé est une erreur de déploiement : pas de bascule silencieuse (P6).
  const port = isProduction ? preferredPort : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Arrêt propre (P11) : on termine les requêtes en cours avant de quitter.
  const shutdown = (signal: string) => {
    console.log(`[Server] ${signal} reçu, arrêt en cours…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
