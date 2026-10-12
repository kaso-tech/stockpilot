import { defineConfig } from "vitest/config";
import path from "path";

const root = path.resolve(import.meta.dirname);

// Tests d'intégration sur MySQL réel : exécution séquentielle (base partagée).
export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": path.resolve(root, "client", "src"),
      "@shared": path.resolve(root, "shared"),
      "@assets": path.resolve(root, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["server/test/setup.ts"],
    include: ["server/**/*.db.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
