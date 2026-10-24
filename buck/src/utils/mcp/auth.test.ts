import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser } }),
}));
vi.mock("@/utils/supabaseConfig", () => ({
  supabaseUrl: "https://proj.supabase.co",
  supabaseAnonKey: "anon",
}));

const { buildProtectedResourceMetadata, connectedAppTokenVerifier, getMcpResourceMetadataUrl } = await import("./auth");
const { addDays, daysInclusive, isDayKey, manilaToday, monthStart } = await import("./dates");

const jwt = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
const APP_TOKEN = jwt({ sub: "user-1", client_id: "client-1", exp: 2_000_000_000, scope: "openid email" });

describe("connected-app token verifier (ADR-050)", () => {
  beforeEach(() => getUser.mockReset());

  it("accepts a live connected-app token", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    await expect(connectedAppTokenVerifier.verifyAccessToken(APP_TOKEN)).resolves.toEqual({
      token: APP_TOKEN,
      clientId: "client-1",
      scopes: ["openid", "email"],
      expiresAt: 2_000_000_000,
      extra: { userId: "user-1" },
    });
    expect(getUser).toHaveBeenCalledWith(APP_TOKEN);
  });

  it("refuses Buck's own session tokens without asking Supabase", async () => {
    await expect(
      connectedAppTokenVerifier.verifyAccessToken(jwt({ sub: "user-1", aal: "aal2", exp: 2_000_000_000 }))
    ).rejects.toMatchObject({ code: "invalid_token" });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("refuses revoked or expired tokens", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("session not found") });
    await expect(connectedAppTokenVerifier.verifyAccessToken(APP_TOKEN)).rejects.toMatchObject({
      code: "invalid_token",
    });
  });

  it("reports an outage as a server error, not a bad token", async () => {
    // A reply that can't be read stands in for a network failure: vitest 5
    // reports errors thrown inside a mocked module even when the code catches them.
    getUser.mockResolvedValue(null);
    const failure = await connectedAppTokenVerifier.verifyAccessToken(APP_TOKEN).catch((error: unknown) => error);

    expect((failure as { code?: string }).code).toBe("server_error");
  });

  it("points clients at Supabase as the authorization server", () => {
    expect(getMcpResourceMetadataUrl("https://bucktbt.vercel.app")).toBe(
      "https://bucktbt.vercel.app/.well-known/oauth-protected-resource/api/mcp"
    );
    expect(buildProtectedResourceMetadata("https://bucktbt.vercel.app")).toMatchObject({
      resource: "https://bucktbt.vercel.app/api/mcp",
      authorization_servers: ["https://proj.supabase.co/auth/v1"],
    });
  });
});

describe("Manila calendar days", () => {
  it("takes today in Asia/Manila, not UTC", () => {
    // 16:30 UTC is already the next day in Manila (UTC+8).
    expect(manilaToday(new Date("2026-10-23T16:30:00Z"))).toBe("2026-10-24");
    expect(manilaToday(new Date("2026-10-23T15:59:00Z"))).toBe("2026-10-23");
  });

  it("does day arithmetic on keys", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(monthStart("2026-10-24")).toBe("2026-10-01");
    expect(daysInclusive("2026-10-01", "2026-10-24")).toBe(24);
    expect(isDayKey("2026-02-29")).toBe(false);
    expect(isDayKey("2028-02-29")).toBe(true);
    expect(isDayKey("2026-1-05")).toBe(false);
  });
});
