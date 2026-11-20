import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postcss, { type Node } from "postcss";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const css = read("../index.css");
const root = postcss.parse(css);

function ancestors(node: Node): string[] {
  const values: string[] = [];
  let current = node.parent;
  while (current) {
    if (current.type === "atrule") values.push(`${current.name} ${current.params}`);
    current = current.parent;
  }
  return values;
}

describe("portage visuel sélectif GitHub", () => {
  it("réserve les transformations lift aux cartes opt-in sous motion autorisée", () => {
    const motionRules: string[] = [];
    root.walkRules(rule => {
      if (!rule.selector.includes(".lift")) return;
      rule.walkDecls("transform", declaration => {
        if (declaration.value === "none") return;
        expect(ancestors(rule)).toContain("media (prefers-reduced-motion: no-preference)");
        motionRules.push(rule.selector);
      });
    });
    expect(motionRules.length).toBeGreaterThan(0);
    root.walkRules(rule => {
      if (rule.selector !== 'a, button, [role="button"], tr') return;
      expect(ancestors(rule)).toContain("layer base");
      expect(ancestors(rule)).toContain("media (prefers-reduced-motion: no-preference)");
    });
  });

  it("neutralise transformation, translation et transition quand le mouvement est réduit", () => {
    const declarations = new Map<string, string>();
    root.walkRules(rule => {
      if (rule.selector === ".lift" && ancestors(rule).includes("media (prefers-reduced-motion: reduce)")) {
        rule.walkDecls(declaration => declarations.set(declaration.prop, declaration.value));
      }
    });
    expect(Object.fromEntries(declarations)).toMatchObject({ transition: "none", transform: "none" });
    // Les anciennes translations Tailwind sont retirées : ne pas réintroduire
    // translate:none, compilé avec transform:none en translate(0) par Lightning CSS.
    expect(declarations.has("translate")).toBe(false);
  });

  it("conserve le bleu et n'anime aucun conteneur partagé ou panneau de caisse", () => {
    expect(css).toContain("--app-primary: #2563EB;");
    for (const path of ["../components/DashboardLayout.tsx", "../components/CheckoutSheet.tsx", "../pages/PointOfSale.tsx"]) {
      const source = read(path);
      expect(source).not.toMatch(/className=.{0,150}\b(lift|stagger|animate-enter)\b/);
    }
    for (const name of ["Agents", "PurchaseOrders", "SupplierDetail"]) {
      expect(read(`../pages/${name}.tsx`)).toContain("lift surface");
      expect(read(`../pages/${name}.tsx`)).not.toContain("hover:-translate-y-0.5");
    }
    for (const name of ["Agents", "Quotes"]) {
      expect(read(`../pages/${name}.tsx`)).toContain("hover:bg-accent");
      expect(read(`../pages/${name}.tsx`)).not.toContain("hover:bg-[#141e2d]");
    }
  });
});
