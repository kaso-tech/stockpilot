import { afterEach, describe, expect, it } from "vitest";
import { buildGoogleDriveAuthorizationUrl, decryptSecret, encryptSecret, googleDriveConfigured } from "./googleDrive";

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
    expect(() => buildGoogleDriveAuthorizationUrl("https://example.test/callback", "state")).toThrow("n’est pas encore configuré");

    process.env.GOOGLE_DRIVE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = "test-client-secret";
    const url = new URL(buildGoogleDriveAuthorizationUrl("https://example.test/callback", "secure-state"));
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file");
    expect(url.searchParams.get("state")).toBe("secure-state");
    expect(decryptSecret(encryptSecret("refresh-token"))).toBe("refresh-token");
  });
});
