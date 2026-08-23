import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { appRouter } from "./routers";

describe("auth.adminFallbackLogin", () => {
  it("accepte les secrets administrateur configurés et émet une session", async () => {
    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const ctx = { user: null, req: { protocol: "https", hostname: "stockpilot-gpaoheuz.manus.space", headers: {} }, res: { cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }) } } as never;
    const result = await appRouter.createCaller(ctx).auth.adminFallbackLogin({ email: ENV.adminFallbackEmail, password: ENV.adminFallbackPassword });
    expect(result).toEqual({ success: true });
    expect(cookies[0]?.value).toBeTruthy();
    expect(cookies[0]?.options).toMatchObject({ secure: true, sameSite: "none", httpOnly: true });
  });

  it("refuse un mot de passe incorrect sans émettre de session", async () => {
    const cookies: unknown[] = [];
    const ctx = { user: null, req: { protocol: "https", hostname: "stockpilot-gpaoheuz.manus.space", headers: {} }, res: { cookie: (...args: unknown[]) => cookies.push(args) } } as never;
    const caller = appRouter.createCaller(ctx);
    await expect(caller.auth.adminFallbackLogin({ email: ENV.adminFallbackEmail, password: "mot-de-passe-invalide" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(cookies).toHaveLength(0);
  });

  it("refuse la connexion si OWNER_OPEN_ID manque et qu’aucun compte administrateur correspondant n’est disponible", async () => {
    const ownerOpenId = ENV.ownerOpenId;
    const cookies: unknown[] = [];
    const ctx = { user: null, req: { protocol: "https", hostname: "stockpilot-gpaoheuz.manus.space", headers: {} }, res: { cookie: (...args: unknown[]) => cookies.push(args) } } as never;
    try {
      ENV.ownerOpenId = "";
      await expect(appRouter.createCaller(ctx).auth.adminFallbackLogin({ email: ENV.adminFallbackEmail, password: ENV.adminFallbackPassword })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(cookies).toHaveLength(0);
    } finally {
      ENV.ownerOpenId = ownerOpenId;
    }
  });
});
