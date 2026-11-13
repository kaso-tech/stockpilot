import { expect, type Page } from "@playwright/test";

export const PASSWORD = "MotDePasse!2026";

/** Relève les erreurs JavaScript de la page pour les faire échouer explicitement. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (
      message.type() === "error" &&
      !/Failed to load resource|401|403/.test(message.text())
    )
      errors.push(message.text());
  });
  return errors;
}

export async function register(
  page: Page,
  email: string,
  company = "Boutique E2E"
) {
  await page.goto("/inscription");
  await page.getByPlaceholder("Nom de l’entreprise").fill(company);
  await page.getByPlaceholder("Votre nom complet").fill("Awa Diallo");
  await page.getByPlaceholder("Adresse e-mail professionnelle").fill(email);
  await page
    .getByPlaceholder("Mot de passe (10 caractères minimum)")
    .fill(PASSWORD);
  await page.getByPlaceholder("Confirmer le mot de passe").fill(PASSWORD);
  const submit = page.getByRole("button", { name: "Créer mon espace" });
  await expect(submit).toBeEnabled({ timeout: 10_000 });
  await submit.click();
  await page.waitForURL("**/parametres/identite");
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/");
  await page.getByPlaceholder("Adresse e-mail").fill(email);
  await page.getByPlaceholder("Mot de passe").first().fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Vue d’ensemble").first()).toBeVisible({
    timeout: 15_000,
  });
}

/** Appel tRPC authentifié depuis le navigateur (cookie de session de la page). */
export async function trpc<T>(
  page: Page,
  path: string,
  input: unknown
): Promise<T> {
  const response = await page.request.post(`/api/trpc/${path}`, {
    data: { json: input },
    headers: { "content-type": "application/json" },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).result.data.json as T;
}

/** Lecture tRPC (procédure « query ») en GET. */
export async function trpcQuery<T>(
  page: Page,
  path: string,
  input?: unknown
): Promise<T> {
  const query =
    input === undefined
      ? ""
      : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const response = await page.request.get(`/api/trpc/${path}${query}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).result.data.json as T;
}
