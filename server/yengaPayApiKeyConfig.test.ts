import { createServer } from "node:http";
import { once } from "node:events";
import { describe, expect, it } from "vitest";

describe("clé API YengaPay SANDBOX", () => {
  it("est disponible uniquement dans un appel HTTP serveur authentifié", async () => {
    const apiKey = process.env.YENGAPAY_API_KEY;
    expect(apiKey).toBeTruthy();

    const server = createServer((request, response) => {
      expect(request.headers["x-api-key"]).toBe(apiKey);
      response.writeHead(204).end();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Serveur de validation indisponible");

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/sandbox-check`, {
        headers: { "x-api-key": apiKey! },
      });
      expect(response.status).toBe(204);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
