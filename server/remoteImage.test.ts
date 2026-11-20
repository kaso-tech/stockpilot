import { describe, expect, it } from "vitest";
import {
  fetchRemoteImage,
  isBlockedAddress,
  parseRemoteImageUrl,
  safeLookup,
} from "./remoteImage";

describe("photos importées depuis une adresse web", () => {
  it("refuse les adresses du réseau interne", () => {
    for (const address of [
      "127.0.0.1",
      "10.2.3.4",
      "172.20.0.5",
      "192.168.1.10",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ])
      expect(isBlockedAddress(address), address).toBe(true);
    for (const address of ["8.8.8.8", "151.101.1.69", "2606:4700::1111"])
      expect(isBlockedAddress(address), address).toBe(false);
  });

  it("n'accepte que des adresses https publiques", () => {
    expect(() => parseRemoteImageUrl("http://exemple.com/a.jpg")).toThrow(
      /https/
    );
    expect(() => parseRemoteImageUrl("https://localhost/a.jpg")).toThrow(
      /non autorisée/
    );
    expect(() => parseRemoteImageUrl("https://127.0.0.1/a.jpg")).toThrow(
      /non autorisée/
    );
    expect(() => parseRemoteImageUrl("https://[::1]/a.jpg")).toThrow(
      /non autorisée/
    );
    expect(() =>
      parseRemoteImageUrl("https://user:pass@exemple.com/a.jpg")
    ).toThrow(/invalide/);
    expect(() => parseRemoteImageUrl("pas une adresse")).toThrow(/invalide/);
    expect(parseRemoteImageUrl("https://cdn.exemple.com/p.jpg").hostname).toBe(
      "cdn.exemple.com"
    );
  });

  it("bloque un nom de domaine qui se résout vers une adresse interne", async () => {
    // localtest.me et ses sous-domaines se résolvent publiquement vers 127.0.0.1 ;
    // sans accès DNS, la requête échoue aussi : dans les deux cas rien n'est téléchargé.
    await expect(
      fetchRemoteImage("https://localtest.me/photo.jpg")
    ).rejects.toThrow(/non autorisée|inaccessible/);
  });

  it("la résolution DNS à la connexion refuse un nom qui pointe vers la machine", async () => {
    const error = await new Promise<NodeJS.ErrnoException | null>(resolve =>
      safeLookup("localhost", {}, err => resolve(err))
    );
    expect(error?.code).toBe("EBLOCKED");
  });
});
