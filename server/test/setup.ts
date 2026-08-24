// Synthetic defaults keep unit tests deterministic when no test environment is supplied.
// CI and integration environments may override these values explicitly.
process.env.JWT_SECRET ??= "stockpilot-test-jwt-secret-only";
process.env.VITE_APP_ID ??= "stockpilot-test-app";
process.env.OWNER_OPEN_ID ??= "stockpilot-test-owner";
process.env.ADMIN_FALLBACK_EMAIL ??= "admin@example.test";
process.env.ADMIN_FALLBACK_PASSWORD ??= "stockpilot-test-password-only";
process.env.ALLOW_LEGACY_ADMIN_FALLBACK ??= "true";
