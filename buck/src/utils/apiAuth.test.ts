import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserWithToken = vi.fn();
const getUserFromCookie = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: getUserWithToken } }),
}));
vi.mock("@/utils/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserFromCookie } }),
}));
vi.mock("@/utils/supabaseConfig", () => ({
  isSupabaseConfigured: true,
  supabaseUrl: "https://proj.supabase.co",
  supabaseAnonKey: "anon",
}));

const { getRequestUserId, readBearerToken } = await import("./apiAuth");

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
