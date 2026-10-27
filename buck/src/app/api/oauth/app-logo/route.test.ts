import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getRequestAuth: vi.fn(),
  getClient: vi.fn(),
  fetchAppLogo: vi.fn(),
}));

vi.mock("@/utils/apiAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/apiAuth")>()),
  getRequestAuth: m.getRequestAuth,
}));
vi.mock("@/utils/supabase/admin", () => ({
  isSupabaseAdminConfigured: true,
  createSupabaseAdminClient: () => ({ auth: { admin: { oauth: { getClient: m.getClient } } } }),
}));
vi.mock("@/utils/appLogo", () => ({ fetchAppLogo: m.fetchAppLogo }));

const { GET } = await import("./route");

const CLIENT_ID = "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d";
const LOGO_URI = "https://cdn.app.test/logo.png";
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const call = (query = `client_id=${CLIENT_ID}`, headers: Record<string, string> = {}) =>
  GET(new Request(`https://buck.test/api/oauth/app-logo?${query}`, { headers }));

const session = (satisfied = true) => ({
  user: { id: "user-1" },
  accessToken: "cookie-token",
  mfa: {
    currentLevel: satisfied ? "aal2" : "aal1",
    verifiedFactorCount: 1,
    hasVerifiedFactor: true,
    satisfied,
  },
});

describe("GET /api/oauth/app-logo (ADR-051)", () => {
  beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset());
    m.getRequestAuth.mockResolvedValue(session());
    m.getClient.mockResolvedValue({ data: { client_id: CLIENT_ID, logo_uri: LOGO_URI }, error: null });
    m.fetchAppLogo.mockResolvedValue({ ok: true, body: PNG, contentType: "image/png" });
  });

  it("serves the registered logo with a sniffed type, nosniff and a private one-day cache", async () => {
    const response = await call();

    expect(response.status).toBe(200);
    expect(m.getClient).toHaveBeenCalledWith(CLIENT_ID);
    expect(m.fetchAppLogo).toHaveBeenCalledWith(LOGO_URI);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  it("refuses without a signed-in session", async () => {
    m.getRequestAuth.mockResolvedValue(null);

    expect((await call()).status).toBe(401);
    expect(m.getClient).not.toHaveBeenCalled();
  });

  it("refuses a session that has not passed 2FA", async () => {
    m.getRequestAuth.mockResolvedValue(session(false));

    const response = await call();

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "mfa_required" });
    expect(m.getClient).not.toHaveBeenCalled();
  });

  it("refuses a bearer token (mobile or a connected app)", async () => {
    expect((await call(undefined, { authorization: "Bearer app-token" })).status).toBe(400);
    expect(m.getRequestAuth).not.toHaveBeenCalled();
  });

  it.each(["", "client_id=", "client_id=not-a-uuid", `client_id=${CLIENT_ID}/../x`])(
    "refuses an invalid client id (%s)",
    async (query) => {
      expect((await call(query)).status).toBe(400);
      expect(m.getClient).not.toHaveBeenCalled();
    }
  );

  it("never fetches a URL from the query string", async () => {
    await call(`client_id=${CLIENT_ID}&url=https://evil.test/track.png&logo_uri=http://10.0.0.1/`);

    expect(m.fetchAppLogo).toHaveBeenCalledTimes(1);
    expect(m.fetchAppLogo).toHaveBeenCalledWith(LOGO_URI);
  });

  it("returns 404 for an unknown app", async () => {
    m.getClient.mockResolvedValue({ data: null, error: { message: "OAuth client not found" } });

    expect((await call()).status).toBe(404);
    expect(m.fetchAppLogo).not.toHaveBeenCalled();
  });

  it("returns 404 for an app without a logo", async () => {
    m.getClient.mockResolvedValue({ data: { client_id: CLIENT_ID, logo_uri: "  " }, error: null });

    expect((await call()).status).toBe(404);
    expect(m.fetchAppLogo).not.toHaveBeenCalled();
  });

  it.each(["not_https", "private_address", "unsupported_type", "too_large", "timeout"])(
    "returns an uncached 404 when the logo is refused (%s)",
    async (reason) => {
      m.fetchAppLogo.mockResolvedValue({ ok: false, reason });

      const response = await call();

      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
      expect(response.headers.get("content-type")).toContain("application/json");
    }
  );
});
