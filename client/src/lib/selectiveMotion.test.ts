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

  it("utilise le pétrole par défaut et ne déclare les animations que sous mouvement autorisé", () => {
    expect(css).toContain("--app-primary: #0B6E76;");
    // Entrée des pages, cascade, rebond et glissement : jamais actifs quand le mouvement est réduit.
    for (const selector of [".animate-enter", ".stagger > *", ".animate-pop", ".animate-slide-in"]) {
      let found = false;
      root.walkRules(rule => {
        if (rule.selector !== selector) return;
        found = true;
        expect(ancestors(rule)).toContain("media (prefers-reduced-motion: no-preference)");
      });
      expect(found).toBe(true);
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
