import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getRequestAuth: vi.fn(),
  countSecurityEvents: vi.fn(),
  recordSecurityEvent: vi.fn(),
}));

vi.mock("@/utils/supabaseConfig", () => ({
  isSupabaseConfigured: true,
  supabaseConfigError: "Supabase not configured",
  supabaseUrl: "https://proj.supabase.co",
  supabaseAnonKey: "anon-key",
}));
vi.mock("@/utils/supabase/admin", () => ({
  isSupabaseAdminConfigured: true,
  createSupabaseAdminClient: () => ({}),
}));
vi.mock("@/utils/apiAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/apiAuth")>()),
  getRequestAuth: m.getRequestAuth,
}));
vi.mock("@/utils/authRateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/authRateLimit")>()),
  countSecurityEvents: m.countSecurityEvents,
  recordSecurityEvent: m.recordSecurityEvent,
  hashClientIp: () => "ip-hash",
}));

const { POST } = await import("./route");

const STRONG = "Tr1cky!Ledger#2026";
const satisfiedAuth = {
  user: { id: "user-1", email: "juan.dela@example.com", user_metadata: { username: "juanito" } },
  accessToken: "user-token",
  mfa: { currentLevel: "aal1", verifiedFactorCount: 0, hasVerifiedFactor: false, satisfied: true },
};
const fetchMock = vi.fn();

const update = (body: unknown) =>
  POST(new Request("https://buck.test/api/auth/password/update", {
    method: "POST",
    body: JSON.stringify(body),
  }));
const outcomes = () => m.recordSecurityEvent.mock.calls.map(([, event]) => event.outcome);

describe("POST /api/auth/password/update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getRequestAuth.mockResolvedValue(satisfiedAuth);
    m.countSecurityEvents.mockResolvedValue(0);
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("needs a session", async () => {
    m.getRequestAuth.mockResolvedValue(null);
    const response = await update({ password: STRONG });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a session that still owes its 2FA code", async () => {
    m.getRequestAuth.mockResolvedValue({
      ...satisfiedAuth,
      mfa: { currentLevel: "aal1", verifiedFactorCount: 1, hasVerifiedFactor: true, satisfied: false },
    });
    const response = await update({ password: STRONG });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "mfa_required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 with the issues when the policy fails, without calling Supabase", async () => {
    const response = await update({ password: "short" });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe("weak_password");
    expect(body.issues).toContain("At least 10 characters");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcomes()).toEqual(["invalid"]);
  });

  it("rejects a password containing the username or e-mail name", async () => {
    const withName = await update({ password: "Juanito!2026xyz" });
    expect(withName.status).toBe(400);
    expect((await withName.json()).issues).toContain("Do not include your username");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a password longer than bcrypt's 72 bytes", async () => {
    const response = await update({ password: `Aa1!${"x".repeat(80)}` });
    expect(response.status).toBe(400);
    expect((await response.json()).issues).toContain("Keep it to 72 characters or fewer");
  });

  it("updates the password as the user and logs success", async () => {
    const response = await update({ password: STRONG });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ success: true, message: "Password updated successfully." });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://proj.supabase.co/auth/v1/user",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ apikey: "anon-key", Authorization: "Bearer user-token" }),
        body: JSON.stringify({ password: STRONG }),
      })
    );
    expect(outcomes()).toEqual(["success"]);
  });

  it("passes a reauthentication nonce through", async () => {
    await update({ password: STRONG, nonce: "123456" });
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ password: STRONG, nonce: "123456" }));
  });

  it("explains a leaked password refused by Supabase", async () => {
    fetchMock.mockResolvedValue(new Response(
      JSON.stringify({ error_code: "weak_password", msg: "weak", weak_password: { reasons: ["pwned"] } }),
      { status: 422 }
    ));
    const response = await update({ password: STRONG });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/data breach/);
    expect(outcomes()).toEqual(["invalid"]);
  });

  it("asks for reauthentication when Supabase requires it", async () => {
    fetchMock.mockResolvedValue(new Response(
      JSON.stringify({ error_code: "reauthentication_needed" }),
      { status: 400 }
    ));
    const response = await update({ password: STRONG });

    expect(response.status).toBe(401);
    expect((await response.json()).errorCode).toBe("reauthentication_needed");
  });

  it("maps Supabase's insufficient_aal to mfa_required", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error_code: "insufficient_aal" }), { status: 401 }));
    const response = await update({ password: STRONG });

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("mfa_required");
  });

  it("rate-limits after 5 attempts in 15 minutes", async () => {
    m.countSecurityEvents.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
    const response = await update({ password: STRONG });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcomes()).toEqual(["rate_limited"]);
  });

  it("returns 502 without leaking Supabase's error text", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ msg: "internal detail" }), { status: 500 }));
    const response = await update({ password: STRONG });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.message).not.toContain("internal detail");
    expect(outcomes()).toEqual(["provider_error"]);
  });
});
