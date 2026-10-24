import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

/**
 * Connected-app logos (ADR-051): the server fetches an app's `logo_uri` so the
 * user's browser only ever loads `/api/oauth/app-logo` from Buck. Self-registered
 * apps choose their own URL, so it is untrusted input: https only, public
 * addresses only (checked at connect time, so DNS rebinding cannot slip past),
 * raster images only, small and fast. Server-only (node:https, node:dns).
 */

export const APP_LOGO_MAX_BYTES = 256 * 1024;
export const APP_LOGO_TIMEOUT_MS = 5000;
export const APP_LOGO_MAX_REDIRECTS = 3;

export type AppLogoImageType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export type AppLogoRefusal =
  | "invalid_url"
  | "not_https"
  | "credentials_in_url"
  | "non_default_port"
  | "private_address"
  | "too_many_redirects"
  | "bad_status"
  | "too_large"
  | "unsupported_type"
  | "timeout"
  | "network_error";

export type AppLogoResult =
  | { ok: true; body: Uint8Array; contentType: AppLogoImageType }
  | { ok: false; reason: AppLogoRefusal };

export class AppLogoError extends Error {
  constructor(readonly reason: AppLogoRefusal) {
    super(`App logo refused: ${reason}`);
    this.name = "AppLogoError";
  }
}

// Everything that is not the public internet: private, loopback, link-local,
// CGNAT, multicast, reserved, documentation, and IPv6 forms that embed an IPv4
// address (mapped, NAT64, 6to4, Teredo) so a private one cannot hide inside.
const NON_PUBLIC = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  NON_PUBLIC.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  NON_PUBLIC.addSubnet(network, prefix, "ipv6");
}

// BlockList also matches IPv4 input against IPv4-mapped IPv6 rules, so the
// mapped range lives apart and is checked only for IPv6 input.
const IPV4_MAPPED = new BlockList();
IPV4_MAPPED.addSubnet("::ffff:0:0", 96, "ipv6");

/** True only for a public unicast IPv4 or IPv6 address. */
export function isPublicAddress(address: string) {
  const value = address.replace(/^\[|\]$/g, "");
  const family = isIP(value);

  if (family === 0) {
    return false;
  }

  if (family === 6 && IPV4_MAPPED.check(value, "ipv6")) {
    return false;
  }

  return !NON_PUBLIC.check(value, family === 4 ? "ipv4" : "ipv6");
}

/** Checks a logo URL before any connection: https, port 443, no credentials, no private IP literal. */
export function checkLogoUrl(value: string): URL | AppLogoRefusal {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    return "invalid_url";
  }

  if (url.protocol !== "https:") return "not_https";
  if (url.username || url.password) return "credentials_in_url";
  // Port "" means 443 for https; anything else could probe internal services.
  if (url.port !== "") return "non_default_port";

  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (isIP(host) !== 0 && !isPublicAddress(host)) return "private_address";

  return url;
}

/** Image type from the first bytes; upstream `Content-Type` is never trusted. SVG is never accepted. */
export function sniffImageType(bytes: Uint8Array): AppLogoImageType | null {
  const startsWith = (signature: number[], offset = 0) =>
    bytes.length >= offset + signature.length &&
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWith([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) {
    return "image/gif";
  }
  // "RIFF" <size> "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";

  return null;
}

type LookupFn = (
  hostname: string,
  options: LookupOptions & { all: true },
  callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void
) => void;

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number
) => void;

/**
 * A `lookup` for the socket that refuses the connection when any resolved
 * address is not public. Used at connect time, so the checked address is the
 * one actually dialled.
 */
export function createSafeLookup(resolve: LookupFn = dnsLookup as unknown as LookupFn) {
  return (hostname: string, options: LookupOptions, callback: LookupCallback) => {
    resolve(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) {
        callback(error, []);
        return;
      }

      if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address))) {
        callback(new AppLogoError("private_address"), []);
        return;
      }

      if (options.all) {
        callback(null, addresses);
      } else {
        callback(null, addresses[0].address, addresses[0].family);
      }
    });
  };
}

export type LogoResponse = {
  status: number;
  location: string | null;
  contentLength: number | null;
  body: AsyncIterable<Uint8Array>;
  /** Stops reading and closes the connection. */
  cancel: () => void;
};

export type LogoTransport = (url: URL, signal: AbortSignal) => Promise<LogoResponse>;

/** The real transport: node:https with the safe lookup, no cookies, no proxy, no redirects of its own. */
export const httpsLogoTransport: LogoTransport = (url, signal) =>
  new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: "GET",
        signal,
        lookup: createSafeLookup() as never,
        headers: {
          accept: "image/png,image/jpeg,image/webp,image/gif",
          "user-agent": "Buck-AppLogo/1.0 (+https://bucktbt.vercel.app)",
        },
      },
      (response) => {
        const length = Number(response.headers["content-length"]);

        resolve({
          status: response.statusCode ?? 0,
          location: response.headers.location ?? null,
          contentLength: Number.isFinite(length) ? length : null,
          body: response,
          cancel: () => response.destroy(),
        });
      }
    );

    request.on("error", reject);
    request.end();
  });

async function readCapped(response: LogoResponse) {
  const chunks: Uint8Array[] = [];
  let total = 0;

  for await (const chunk of response.body) {
    total += chunk.byteLength;

    if (total > APP_LOGO_MAX_BYTES) {
      response.cancel();
      throw new AppLogoError("too_large");
    }

    chunks.push(chunk);
  }

  const body = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
}

async function fetchChecked(start: string, transport: LogoTransport, signal: AbortSignal) {
  let next = start;

  for (let hop = 0; hop <= APP_LOGO_MAX_REDIRECTS; hop += 1) {
    const url = checkLogoUrl(next);

    if (typeof url === "string") {
      throw new AppLogoError(url);
    }

    const response = await transport(url, signal);

    if (response.status >= 300 && response.status < 400 && response.location) {
      response.cancel();
      // Every hop is checked again: a redirect must not reach http or a private host.
      next = new URL(response.location, url).toString();
      continue;
    }

    if (response.status !== 200) {
      response.cancel();
      throw new AppLogoError("bad_status");
    }

    if (response.contentLength !== null && response.contentLength > APP_LOGO_MAX_BYTES) {
      response.cancel();
      throw new AppLogoError("too_large");
    }

    return readCapped(response);
  }

  throw new AppLogoError("too_many_redirects");
}

/** Fetches and validates an app logo. Never throws; refusals come back as `{ ok: false, reason }`. */
export async function fetchAppLogo(
  logoUri: string,
  options: { transport?: LogoTransport; timeoutMs?: number } = {}
): Promise<AppLogoResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? APP_LOGO_TIMEOUT_MS);

  try {
    const body = await fetchChecked(logoUri, options.transport ?? httpsLogoTransport, controller.signal);
    const contentType = sniffImageType(body);

    return contentType ? { ok: true, body, contentType } : { ok: false, reason: "unsupported_type" };
  } catch (error) {
    if (error instanceof AppLogoError) {
      return { ok: false, reason: error.reason };
    }

    if (controller.signal.aborted) {
      return { ok: false, reason: "timeout" };
    }

    // The safe lookup's refusal reaches us wrapped by the socket error path.
    if (error instanceof Error && (error.cause instanceof AppLogoError || error.name === "AppLogoError")) {
      return { ok: false, reason: "private_address" };
    }

    return { ok: false, reason: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}
