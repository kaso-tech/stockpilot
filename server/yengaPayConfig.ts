const YENGAPAY_API_BASE_URL = "https://api.yengapay.com";

export function isYengaPaySandboxPayInEnabled() {
  return process.env.YENGAPAY_PAYIN_ENABLED === "true";
}

function requiredDecimalIdentifier(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized || !/^\d{1,20}$/.test(normalized)) {
    throw new Error(`Configuration YengaPay invalide : ${label} requis.`);
  }
  return normalized;
}

/** Configuration SANDBOX uniquement ; aucun identifiant n’est retourné aux composants client. */
export function getYengaPaySandboxConfig() {
  const organizationId = requiredDecimalIdentifier(process.env.YENGAPAY_ORGANIZATION_ID, "organisation");
  const projectId = requiredDecimalIdentifier(process.env.YENGAPAY_SANDBOX_PROJECT_ID, "projet SANDBOX");
  const apiKey = process.env.YENGAPAY_API_KEY?.trim();
  if (!apiKey) throw new Error("Configuration YengaPay invalide : clé API SANDBOX requise.");

  return {
    apiKey,
    organizationId,
    projectId,
    paymentIntentUrl: `${YENGAPAY_API_BASE_URL}/api/v1/groups/${organizationId}/payment-intent/${projectId}`,
  };
}
