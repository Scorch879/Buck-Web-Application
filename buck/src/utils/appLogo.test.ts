import { describe, expect, it, vi } from "vitest";
import {
  APP_LOGO_MAX_BYTES,
  APP_LOGO_MAX_REDIRECTS,
  checkLogoUrl,
  createSafeLookup,
  fetchAppLogo,
  isPublicAddress,
  sniffImageType,
  type LogoResponse,
  type LogoTransport,
} from "./appLogo";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const GIF = new TextEncoder().encode("GIF89a\u0001\u0000");
const WEBP = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

async function* chunks(...parts: Uint8Array[]) {
  for (const part of parts) yield part;
}

function reply(overrides: Partial<LogoResponse> = {}): LogoResponse {
  return {
    status: 200,
    location: null,
    contentLength: null,
    body: chunks(PNG),
    cancel: vi.fn(),
    ...overrides,
  };
}

/** Transport that answers each requested URL from a map, recording what was dialled. */
function transportFor(routes: Record<string, () => LogoResponse>) {
  const dialled: string[] = [];
  const transport: LogoTransport = async (url) => {
    dialled.push(url.toString());
    const route = routes[url.toString()];
    if (!route) throw new Error(`unexpected request to ${url}`);
    return route();
  };
  return { transport, dialled };
}

describe("isPublicAddress (ADR-051)", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a00:1",
    "2002:a00:1::",
    "[::1]",
    "not-an-ip",
  ])("refuses %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"])("accepts %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
});

describe("checkLogoUrl (ADR-051)", () => {
  it.each([
    ["not a url", "invalid_url"],
    ["http://cdn.example.com/logo.png", "not_https"],
    ["data:image/png;base64,AAAA", "not_https"],
    ["file:///etc/passwd", "not_https"],
    ["https://user:pass@cdn.example.com/logo.png", "credentials_in_url"],
    ["https://cdn.example.com:8443/logo.png", "non_default_port"],
    ["https://127.0.0.1/logo.png", "private_address"],
    ["https://169.254.169.254/latest/meta-data", "private_address"],
    ["https://[::1]/logo.png", "private_address"],
    ["https://[::ffff:10.0.0.1]/logo.png", "private_address"],
  ])("refuses %s", (value, reason) => {
    expect(checkLogoUrl(value)).toBe(reason);
  });

  it("accepts a plain https URL", () => {
    expect(checkLogoUrl("https://cdn.example.com/logo.png")).toBeInstanceOf(URL);
  });
});

describe("sniffImageType (ADR-051)", () => {
  it("recognises PNG, JPEG, GIF and WebP from their bytes", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(GIF)).toBe("image/gif");
    expect(sniffImageType(WEBP)).toBe("image/webp");
  });

  it("refuses SVG, HTML and empty bodies", () => {
    expect(sniffImageType(SVG)).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<!doctype html><html></html>"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("createSafeLookup (ADR-051)", () => {
  const run = (addresses: { address: string; family: number }[], all = false) =>
    new Promise<{ error: Error | null; result: unknown }>((resolve) => {
      const lookup = createSafeLookup((_host, _options, callback) => callback(null, addresses));
      lookup("cdn.example.com", { all }, (error, address) => resolve({ error, result: address }));
    });

  it("refuses a host that resolves to a private address (DNS rebinding)", async () => {
    const { error } = await run([{ address: "10.0.0.5", family: 4 }]);
    expect(error).toMatchObject({ reason: "private_address" });
  });

  it("refuses when any one of several addresses is private", async () => {
    const { error } = await run([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    expect(error).toMatchObject({ reason: "private_address" });
  });

  it("passes public addresses through in either callback shape", async () => {
    expect(await run([{ address: "93.184.216.34", family: 4 }])).toEqual({
      error: null,
      result: "93.184.216.34",
    });
    expect(await run([{ address: "93.184.216.34", family: 4 }], true)).toEqual({
      error: null,
      result: [{ address: "93.184.216.34", family: 4 }],
    });
  });
});

describe("fetchAppLogo (ADR-051)", () => {
  const LOGO = "https://cdn.example.com/logo.png";

  it("returns the image with its sniffed type, ignoring the upstream Content-Type", async () => {
    const { transport } = transportFor({ [LOGO]: () => reply({ body: chunks(JPEG) }) });

    await expect(fetchAppLogo(LOGO, { transport })).resolves.toEqual({
      ok: true,
      body: JPEG,
      contentType: "image/jpeg",
    });
  });

  it("refuses a URL that is not https without connecting", async () => {
    const { transport, dialled } = transportFor({});

    await expect(fetchAppLogo("http://cdn.example.com/logo.png", { transport })).resolves.toEqual({
      ok: false,
      reason: "not_https",
    });
    expect(dialled).toEqual([]);
  });

  it("refuses a redirect to http", async () => {
    const { transport, dialled } = transportFor({
      [LOGO]: () => reply({ status: 302, location: "http://cdn.example.com/logo.png" }),
    });

    await expect(fetchAppLogo(LOGO, { transport })).resolves.toEqual({ ok: false, reason: "not_https" });
    expect(dialled).toEqual([LOGO]);
  });

  it("refuses a redirect to a private address", async () => {
    const { transport, dialled } = transportFor({
      [LOGO]: () => reply({ status: 301, location: "https://169.254.169.254/latest/meta-data" }),
    });

    await expect(fetchAppLogo(LOGO, { transport })).resolves.toEqual({
      ok: false,
      reason: "private_address",
    });
    expect(dialled).toEqual([LOGO]);
  });

  it("follows a few redirects, then gives up", async () => {
    const { transport, dialled } = transportFor(
      Object.fromEntries(
        Array.from({ length: APP_LOGO_MAX_REDIRECTS + 2 }, (_, hop) => [
          hop === 0 ? LOGO : `https://cdn.example.com/hop-${hop}.png`,
          () => reply({ status: 302, location: `/hop-${hop + 1}.png` }),
        ])
      )
    );

    await expect(fetchAppLogo(LOGO, { transport })).resolves.toEqual({
      ok: false,
      reason: "too_many_redirects",
    });
    expect(dialled).toHaveLength(APP_LOGO_MAX_REDIRECTS + 1);
  });

  it("refuses a non-200 response", async () => {
    const { transport } = transportFor({ [LOGO]: () => reply({ status: 404 }) });

    await expect(fetchAppLogo(LOGO, { transport })).resolves.toEqual({ ok: false, reason: "bad_status" });
  });

  it("refuses a declared size over the cap before reading the body", async () => {
    const body = { [Symbol.asyncIterator]: vi.fn() };
    const { transport } = transportFor({
      [LOGO]: () => reply({ contentLength: APP_LOGO_MAX_BYTES + 1, body }),
    });

    await expect(fetchAppLogo(LOGO, { transport })).resolves.toEqual({ ok: false, reason: "too_large" });
    expect(body[Symbol.asyncIterator]).not.toHaveBeenCalled();
  });

  it("stops reading once an undeclared body passes the cap", async () => {
    const cancel = vi.fn();
    const big = new Uint8Array(APP_LOGO_MAX_BYTES);
    big.set(PNG);
    const { transport } = transportFor({
      [LOGO]: () => reply({ body: chunks(big, new Uint8Array(1)), cancel }),
    });

    await expect(fetchAppLogo(LOGO, { transport })).resolves.toEqual({ ok: false, reason: "too_large" });
    expect(cancel).toHaveBeenCalled();
  });

  it("refuses SVG even when served as an image", async () => {
    const { transport } = transportFor({ [LOGO]: () => reply({ body: chunks(SVG) }) });

    await expect(fetchAppLogo(LOGO, { transport })).resolves.toEqual({
      ok: false,
      reason: "unsupported_type",
    });
  });

  it("times out a slow server", async () => {
    const transport: LogoTransport = (_url, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      });

    await expect(fetchAppLogo(LOGO, { transport, timeoutMs: 20 })).resolves.toEqual({
      ok: false,
      reason: "timeout",
    });
  });

  it("refuses a host that resolves to loopback with the real transport", async () => {
    await expect(fetchAppLogo("https://localhost/logo.png")).resolves.toEqual({
      ok: false,
      reason: "private_address",
    });
  });
});
