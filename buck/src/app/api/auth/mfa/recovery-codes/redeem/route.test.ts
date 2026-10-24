import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getRequestAuth: vi.fn(),
  countSecurityEvents: vi.fn(),
  recordSecurityEvent: vi.fn(),
  removeTwoFactor: vi.fn(),
  signOutOtherSessions: vi.fn(),
  updateResult: { data: [] as { id: string }[] | null, error: null as { message: string } | null },
  updateFilters: [] as Array<[string, unknown]>,
}));

vi.mock("@/utils/apiAuth", () => ({ getRequestAuth: m.getRequestAuth }));
vi.mock("@/utils/supabase/admin", () => ({
  isSupabaseAdminConfigured: true,
  createSupabaseAdminClient: () => ({
    from: () => {
      const chain = {
        update: () => chain,
        eq: (column: string, value: unknown) => (m.updateFilters.push([column, value]), chain),
        is: (column: string, value: unknown) => (m.updateFilters.push([column, value]), chain),
        select: async () => m.updateResult,
      };
      return chain;
    },
  }),
}));
vi.mock("@/utils/authRateLimit", () => ({
  countSecurityEvents: m.countSecurityEvents,
  recordSecurityEvent: m.recordSecurityEvent,
  hashClientIp: () => "ip-hash",
  toIsoDate: () => "2026-10-24T00:00:00.000Z",
  getRetryAfterSeconds: () => 900,
}));
vi.mock("@/utils/mfa/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/mfa/server")>()),
  removeTwoFactor: m.removeTwoFactor,
  signOutOtherSessions: m.signOutOtherSessions,
}));

const { POST } = await import("./route");
const { hashRecoveryCode } = await import("@/utils/mfa/recoveryCodes");

const twoFactorAuth = {
  user: { id: "user-1" },
  accessToken: "aal1-token",
  mfa: { currentLevel: "aal1", verifiedFactorCount: 1, hasVerifiedFactor: true, satisfied: false },
};
const redeem = (code: unknown) =>
  POST(new Request("https://buck.test/api/auth/mfa/recovery-codes/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  }));
const outcomes = () => m.recordSecurityEvent.mock.calls.map(([, event]) => event.outcome);

describe("POST /api/auth/mfa/recovery-codes/redeem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getRequestAuth.mockResolvedValue(twoFactorAuth);
    m.countSecurityEvents.mockResolvedValue(0);
    m.updateResult = { data: [], error: null };
    m.updateFilters = [];
  });

  it("needs a session", async () => {
    m.getRequestAuth.mockResolvedValue(null);
    expect((await redeem("ABCDE-FGH12")).status).toBe(401);
  });

  it("is only for users with 2FA on", async () => {
    m.getRequestAuth.mockResolvedValue({ ...twoFactorAuth, mfa: { ...twoFactorAuth.mfa, hasVerifiedFactor: false } });
    expect((await redeem("ABCDE-FGH12")).status).toBe(400);
    expect(m.removeTwoFactor).not.toHaveBeenCalled();
  });

  it("turns 2FA off and ends other sessions for a valid unused code", async () => {
    m.updateResult = { data: [{ id: "code-1" }], error: null };
    const response = await redeem("abcde-fgh12");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(m.updateFilters).toContainEqual(["code_hash", hashRecoveryCode("user-1", "ABCDEFGH12")]);
    expect(m.updateFilters).toContainEqual(["used_at", null]);
    expect(m.removeTwoFactor).toHaveBeenCalledWith(expect.anything(), "user-1");
    expect(m.signOutOtherSessions).toHaveBeenCalledWith(expect.anything(), "aal1-token");
    expect(outcomes()).toEqual(["success"]);
  });

  it("rejects a wrong or already-used code and logs the failure", async () => {
    const response = await redeem("ABCDE-FGH12");

    expect(response.status).toBe(400);
    expect(m.removeTwoFactor).not.toHaveBeenCalled();
    expect(outcomes()).toEqual(["invalid"]);
  });

  it("counts malformed input as a failed try", async () => {
    expect((await redeem("nope")).status).toBe(400);
    expect(outcomes()).toEqual(["invalid"]);
  });

  it("locks out after 5 failures in 15 minutes", async () => {
    m.countSecurityEvents.mockResolvedValueOnce(5).mockResolvedValueOnce(5);
    m.updateResult = { data: [{ id: "code-1" }], error: null };
    const response = await redeem("ABCDE-FGH12");

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
    expect(m.removeTwoFactor).not.toHaveBeenCalled();
    expect(outcomes()).toEqual(["rate_limited"]);
  });
});
