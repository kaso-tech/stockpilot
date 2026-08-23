import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

function requestHostname(req: Request) {
  if (req.hostname) return req.hostname;
  const host = req.headers.host;
  const rawHost = Array.isArray(host) ? host[0] : host;
  return rawHost?.split(":")[0] ?? "";
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  const hostname = requestHostname(req);
  const localRequest = LOCAL_HOSTS.has(hostname) || isIpAddress(hostname);
  // In production, Express can see the gateway hop as HTTP even though the
  // browser communicates over HTTPS. A SameSite=None cookie without Secure is
  // discarded by modern browsers, which makes OAuth appear to succeed but
  // immediately returns the user to an unauthenticated state.
  const secure = localRequest ? isSecureRequest(req) : true;

  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure,
  };
}
