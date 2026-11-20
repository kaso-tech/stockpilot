import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";

describe("cookies de session OAuth", () => {
  it("conserve Secure et SameSite=None sur un domaine publié derrière un proxy", () => {
    const options = getSessionCookieOptions({ protocol: "http", hostname: "stockpilot-gpaoheuz.manus.space", headers: {} } as never);
    expect(options).toMatchObject({ secure: true, sameSite: "none", httpOnly: true, path: "/" });
  });

  it("utilise un cookie compatible pour le développement local HTTP", () => {
    const options = getSessionCookieOptions({ protocol: "http", hostname: "localhost", headers: {} } as never);
    expect(options).toMatchObject({ secure: false, sameSite: "lax" });
  });
});
