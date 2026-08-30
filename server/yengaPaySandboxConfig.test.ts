import { createServer } from "node:http";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { getYengaPaySandboxConfig, isYengaPaySandboxPayInEnabled } from "./yengaPayConfig";

describe("configuration YengaPay SANDBOX", () => {
  it("construit côté serveur la cible de test avec les identifiants configurés", async () => {
    const config = getYengaPaySandboxConfig();
    const server = createServer((request, response) => {
      expect(request.url).toBe(`/groups/${config.organizationId}/payment-intent/${config.projectId}`);
      expect(request.headers["x-api-key"]).toBe(config.apiKey);
      response.writeHead(204).end();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Serveur de validation indisponible");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/groups/${config.organizationId}/payment-intent/${config.projectId}`, {
        headers: { "x-api-key": config.apiKey },
      });
      expect(response.status).toBe(204);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("n’autorise pas le PayIn tant qu’il n’est pas validé explicitement", () => {
    const previous = process.env.YENGAPAY_PAYIN_ENABLED;
    delete process.env.YENGAPAY_PAYIN_ENABLED;
    expect(isYengaPaySandboxPayInEnabled()).toBe(false);
    process.env.YENGAPAY_PAYIN_ENABLED = "true";
    expect(isYengaPaySandboxPayInEnabled()).toBe(true);
    if (previous === undefined) delete process.env.YENGAPAY_PAYIN_ENABLED;
    else process.env.YENGAPAY_PAYIN_ENABLED = previous;
  });
});
