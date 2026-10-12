import { describe, expect, it, vi } from "vitest";
import { requireJsonForTrpcMutations, securityHeaders, trustProxySetting } from "./httpSecurity";

function response() {
  const headers: Record<string, string> = {};
  const res = { statusCode: 200, body: undefined as unknown, setHeader: (name: string, value: string) => { headers[name] = value; }, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
  return { res, headers };
}

describe("sécurité HTTP", () => {
  it("refuse les mutations tRPC non JSON (CSRF par formulaire)", () => {
    for (const contentType of ["multipart/form-data; boundary=x", "text/plain", "application/x-www-form-urlencoded", undefined]) {
      const { res } = response();
      const next = vi.fn();
      requireJsonForTrpcMutations({ method: "POST", headers: contentType ? { "content-type": contentType } : {} } as never, res as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(415);
    }
  });

  it("laisse passer les requêtes JSON et les lectures", () => {
    const next = vi.fn();
    requireJsonForTrpcMutations({ method: "POST", headers: { "content-type": "application/json" } } as never, response().res as never, next);
    requireJsonForTrpcMutations({ method: "GET", headers: {} } as never, response().res as never, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("pose les en-têtes de sécurité et HSTS en production", () => {
    const { res, headers } = response();
    securityHeaders(true)({} as never, res as never, () => undefined);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'self'");
    expect(headers["Strict-Transport-Security"]).toContain("max-age=");
  });

  it("interprète TRUST_PROXY", () => {
    expect(trustProxySetting(undefined)).toBe(1);
    expect(trustProxySetting("2")).toBe(2);
    expect(trustProxySetting("false")).toBe(false);
    expect(trustProxySetting("loopback")).toBe("loopback");
  });
});
