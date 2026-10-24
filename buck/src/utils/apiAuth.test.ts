import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserWithToken = vi.fn();
const getUserFromCookie = vi.fn();
const getSessionFromCookie = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: getUserWithToken } }),
}));
vi.mock("@/utils/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserFromCookie, getSession: getSessionFromCookie },
  }),
}));
vi.mock("@/utils/supabaseConfig", () => ({
  isSupabaseConfigured: true,
  supabaseUrl: "https://proj.supabase.co",
  supabaseAnonKey: "anon",
}));

const { getRequestAuth, getRequestUserId, readBearerToken } = await import("./apiAuth");

const request = (authorization?: string) =>
  new Request("https://buck.test/api/ai/chat", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });

describe("readBearerToken", () => {
  it("accepts only a single well-formed bearer token", () => {
    expect(readBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(readBearerToken("bearer abc")).toBe("abc");
    expect(readBearerToken("Basic abc")).toBeNull();
    expect(readBearerToken("Bearer ")).toBeNull();
    expect(readBearerToken("Bearer a b")).toBeNull();
    expect(readBearerToken(null)).toBeNull();
  });
});

describe("getRequestUserId", () => {
  beforeEach(() => {
    getUserWithToken.mockReset();
    getUserFromCookie.mockReset();
    getSessionFromCookie.mockReset();
    getSessionFromCookie.mockResolvedValue({ data: { session: { access_token: "cookie-token" } } });
  });

  it("verifies a mobile bearer token with Supabase Auth", async () => {
    getUserWithToken.mockResolvedValue({ data: { user: { id: "mobile-user" } }, error: null });
    expect(await getRequestUserId(request("Bearer tok"))).toBe("mobile-user");
    expect(getUserWithToken).toHaveBeenCalledWith("tok");
    expect(getUserFromCookie).not.toHaveBeenCalled();
  });

  it("rejects an invalid token without falling back to the cookie", async () => {
    getUserWithToken.mockResolvedValue({ data: { user: null }, error: new Error("invalid JWT") });
    getUserFromCookie.mockResolvedValue({ data: { user: { id: "cookie-user" } }, error: null });
    expect(await getRequestUserId(request("Bearer forged"))).toBeNull();
    expect(getUserFromCookie).not.toHaveBeenCalled();
  });

  it("uses the web session cookie when there is no bearer header", async () => {
    getUserFromCookie.mockResolvedValue({ data: { user: { id: "cookie-user" } }, error: null });
    expect(await getRequestUserId(request())).toBe("cookie-user");
    expect(getUserWithToken).not.toHaveBeenCalled();
  });

  it("fails closed when Supabase Auth is unreachable", async () => {
    getUserWithToken.mockRejectedValue(new Error("network"));
    expect(await getRequestUserId(request("Bearer tok"))).toBeNull();
  });
});

describe("two-factor (ADR-048)", () => {
  const jwt = (claims: object) =>
    `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
  const twoFactorUser = {
    id: "2fa-user",
    factors: [{ id: "f1", factor_type: "totp", status: "verified" }],
  };

  beforeEach(() => {
    getUserWithToken.mockReset();
    getUserFromCookie.mockReset();
    getSessionFromCookie.mockReset();
  });

  it("refuses a mobile aal1 token of a user with 2FA on, but still identifies them", async () => {
    const token = jwt({ aal: "aal1" });
    getUserWithToken.mockResolvedValue({ data: { user: twoFactorUser }, error: null });

    expect(await getRequestUserId(request(`Bearer ${token}`))).toBeNull();
    const auth = await getRequestAuth(request(`Bearer ${token}`));
    expect(auth?.user.id).toBe("2fa-user");
    expect(auth?.mfa).toMatchObject({ satisfied: false, hasVerifiedFactor: true, currentLevel: "aal1" });
  });

  it("accepts the same user once the token is aal2", async () => {
    getUserWithToken.mockResolvedValue({ data: { user: twoFactorUser }, error: null });
    expect(await getRequestUserId(request(`Bearer ${jwt({ aal: "aal2" })}`))).toBe("2fa-user");
  });

  it("reads the aal claim of the cookie session", async () => {
    getUserFromCookie.mockResolvedValue({ data: { user: twoFactorUser }, error: null });
    getSessionFromCookie.mockResolvedValue({ data: { session: { access_token: jwt({ aal: "aal1" }) } } });
    expect(await getRequestUserId(request())).toBeNull();

    getSessionFromCookie.mockResolvedValue({ data: { session: { access_token: jwt({ aal: "aal2" }) } } });
    expect(await getRequestUserId(request())).toBe("2fa-user");
  });

  it("refuses a connected app's token (ADR-049) without asking Supabase", async () => {
    getUserWithToken.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const appToken = jwt({ aal: "aal2", client_id: "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d" });

    expect(await getRequestAuth(request(`Bearer ${appToken}`))).toBeNull();
    expect(getUserWithToken).not.toHaveBeenCalled();
  });
});
