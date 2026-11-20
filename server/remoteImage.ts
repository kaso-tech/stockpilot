// Téléchargement d'une photo de produit depuis une adresse web (import CSV, colonne photo_url).
// Protégé contre les requêtes vers le réseau interne (SSRF) : https uniquement, chaque
// adresse IP résolue est vérifiée au moment de la connexion (y compris après redirection).
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request } from "node:https";
import { isIP } from "node:net";
import { detectImageType } from "./productImages";

export const REMOTE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export class RemoteImageError extends Error {}

function ipv4ToNumber(address: string) {
  return address
    .split(".")
    .reduce((value, part) => value * 256 + Number(part), 0);
}

function inRange(address: string, base: string, bits: number) {
  const mask = bits === 0 ? 0 : 2 ** 32 - 2 ** (32 - bits);
  return (
    (ipv4ToNumber(address) & mask) >>> 0 === (ipv4ToNumber(base) & mask) >>> 0
  );
}

/** Adresses que le serveur ne doit jamais joindre pour le compte d'un utilisateur. */
export function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ].some(([base, bits]) => inRange(address, base as string, bits as number));
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb") ||
      lower.startsWith("ff")
    );
  }
  return true;
}

/** Vérifie l'adresse saisie : https, pas d'identifiants, pas d'hôte interne évident. */
export function parseRemoteImageUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new RemoteImageError("adresse de photo invalide");
  }
  if (url.protocol !== "https:")
    throw new RemoteImageError(
      "l’adresse de la photo doit commencer par https://"
    );
  if (url.username || url.password)
    throw new RemoteImageError("adresse de photo invalide");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    (isIP(host) && isBlockedAddress(host))
  )
    throw new RemoteImageError("adresse de photo non autorisée");
  return url;
}

/** Résolution DNS qui refuse les adresses internes : appliquée à chaque connexion. */
export function safeLookup(
  hostname: string,
  options: object,
  callback: (
    error: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number
  ) => void
) {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "");
    const list = addresses as LookupAddress[];
    if (!list.length || list.some(item => isBlockedAddress(item.address)))
      return callback(
        Object.assign(new Error("adresse de photo non autorisée"), {
          code: "EBLOCKED",
        }),
        ""
      );
    if ((options as { all?: boolean }).all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

function download(
  url: URL,
  redirects: number
): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        lookup: safeLookup as never,
        timeout: TIMEOUT_MS,
        headers: { Accept: "image/*", "User-Agent": "StockPilot-Import/1.0" },
      },
      response => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          if (redirects >= MAX_REDIRECTS)
            return reject(new RemoteImageError("trop de redirections"));
          try {
            const next = parseRemoteImageUrl(
              new URL(response.headers.location, url).toString()
            );
            download(next, redirects + 1).then(resolve, reject);
          } catch (error) {
            reject(error);
          }
          return;
        }
        if (status !== 200) {
          response.resume();
          return reject(
            new RemoteImageError(`photo inaccessible (erreur ${status})`)
          );
        }
        const declared = Number(response.headers["content-length"] ?? 0);
        if (declared > REMOTE_IMAGE_MAX_BYTES) {
          response.destroy();
          return reject(
            new RemoteImageError("photo trop lourde (8 Mo maximum)")
          );
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > REMOTE_IMAGE_MAX_BYTES) {
            response.destroy();
            reject(new RemoteImageError("photo trop lourde (8 Mo maximum)"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: String(response.headers["content-type"] ?? ""),
          })
        );
        response.on("error", reject);
      }
    );
    req.on("timeout", () => {
      req.destroy(
        new RemoteImageError("délai dépassé pour télécharger la photo")
      );
    });
    req.on("error", error =>
      reject(
        error instanceof RemoteImageError
          ? error
          : new RemoteImageError(
              (error as NodeJS.ErrnoException).code === "EBLOCKED"
                ? "adresse de photo non autorisée"
                : "photo inaccessible"
            )
      )
    );
    req.end();
  });
}

/** Télécharge une photo et la renvoie en data URL, prête à être compressée par le navigateur. */
export async function fetchRemoteImage(value: string) {
  const url = parseRemoteImageUrl(value);
  const { buffer } = await download(url, 0);
  const type = detectImageType(buffer);
  if (!type)
    throw new RemoteImageError(
      "le fichier n’est pas une photo WEBP, JPEG ou PNG"
    );
  return { dataUrl: `data:${type};base64,${buffer.toString("base64")}` };
}
