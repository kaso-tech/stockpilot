import { afterEach, describe, expect, it } from "vitest";
import {
  buildGoogleDriveAuthorizationUrl,
  decryptSecret,
  encryptSecret,
  googleDriveConfigured,
} from "./googleDrive";

const originalClientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const originalClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

afterEach(() => {
  process.env.GOOGLE_DRIVE_CLIENT_ID = originalClientId;
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = originalClientSecret;
});

describe("google drive configuration", () => {
  it("requires OAuth credentials and protects persisted tokens", () => {
    delete process.env.GOOGLE_DRIVE_CLIENT_ID;
    delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    expect(googleDriveConfigured()).toBe(false);
    expect(() =>
      buildGoogleDriveAuthorizationUrl("https://example.test/callback", "state")
    ).toThrow("n’est pas encore configuré");

    process.env.GOOGLE_DRIVE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = "test-client-secret";
    const url = new URL(
      buildGoogleDriveAuthorizationUrl(
        "https://example.test/callback",
        "secure-state"
      )
    );
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/drive.file"
    );
    expect(url.searchParams.get("state")).toBe("secure-state");
    expect(decryptSecret(encryptSecret("refresh-token"))).toBe("refresh-token");
  });
});

describe("Google Drive OAuth (lot 5)", async () => {
  const { oauthStateIsValid, newOauthState, redirectUri } = await import(
    "./googleDriveRoutes"
  );
  it("refuse un state expiré ou différent", () => {
    const state = newOauthState(1_000);
    expect(oauthStateIsValid(state, state, 1_000 + 60_000)).toBe(true);
    expect(oauthStateIsValid(state, state, 1_000 + 11 * 60_000)).toBe(false);
    expect(oauthStateIsValid("autre", state, 1_000)).toBe(false);
  });
  it("utilise PUBLIC_APP_URL quand elle est définie", () => {
    const req = { protocol: "http", get: () => "interne:3000" } as never;
    process.env.PUBLIC_APP_URL = "https://app.example.test/";
    expect(redirectUri(req)).toBe(
      "https://app.example.test/api/integrations/google-drive/callback"
    );
    delete process.env.PUBLIC_APP_URL;
    expect(redirectUri(req)).toBe(
      "http://interne:3000/api/integrations/google-drive/callback"
    );
  });
});
