import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LayoutDashboard } from "lucide-react";
import { DashboardHeaderTitle } from "./DashboardHeaderTitle";

describe("DashboardHeaderTitle", () => {
  it("affiche le titre de secours et aucune icône lorsque le menu est vide", () => {
    const markup = renderToStaticMarkup(
      createElement(DashboardHeaderTitle, { activeMenuItem: undefined }),
    );

    expect(markup).toContain("Vue d’ensemble");
    expect(markup).not.toContain("<svg");
  });

  it("conserve le label et l’icône de l’élément actif lorsqu’il existe", () => {
    const markup = renderToStaticMarkup(
      createElement(DashboardHeaderTitle, {
        activeMenuItem: { label: "Produits", icon: LayoutDashboard },
      }),
    );

    expect(markup).toContain("Produits");
    expect(markup).toContain("<svg");
    expect(markup).not.toContain("Vue d’ensemble");
  });
});
