import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageSourcePath = fileURLToPath(new URL("./PlatformAdmin.tsx", import.meta.url));
const shellSourcePath = fileURLToPath(new URL("../components/PlatformConsoleShell.tsx", import.meta.url));
const appSourcePath = fileURLToPath(new URL("../App.tsx", import.meta.url));

describe("PlatformAdmin contrast", () => {
  it("uses semantic theme surfaces instead of forcing a dark slate palette", () => {
    const source = `${readFileSync(pageSourcePath, "utf8")}\n${readFileSync(shellSourcePath, "utf8")}`;

    expect(source).toContain('bg-background');
    expect(source).toContain('text-foreground');
    expect(source).toContain('bg-card');
    expect(source).toContain('text-card-foreground');
    expect(source).toContain('text-muted-foreground');
    expect(source).not.toMatch(/(?:bg|text)-slate-/);
    expect(source).not.toContain('border-white/');
  });

  it("uses dedicated platform routes instead of a secondary header navigation", () => {
    const shellSource = readFileSync(shellSourcePath, "utf8");
    const appSource = readFileSync(appSourcePath, "utf8");

    expect(shellSource).toContain('path: "/plateforme/entreprises"');
    expect(shellSource).toContain("setLocation(path)");
    expect(shellSource).not.toContain("scrollIntoView");
    expect(appSource).toContain('path="/plateforme/abonnements"');
    expect(appSource).toContain('path="/plateforme/audit"');
  });
});
