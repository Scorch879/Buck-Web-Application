import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getRequestAuth: vi.fn(),
  getAuthorizationDetails: vi.fn(),
  approveAuthorization: vi.fn(),
  denyAuthorization: vi.fn(),
  revokeGrant: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/utils/apiAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/apiAuth")>()),
  getRequestAuth: m.getRequestAuth,
}));
vi.mock("@/utils/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      oauth: {
        getAuthorizationDetails: m.getAuthorizationDetails,
        approveAuthorization: m.approveAuthorization,
        denyAuthorization: m.denyAuthorization,
        revokeGrant: m.revokeGrant,
      },
    },
  }),
}));
vi.mock("@/utils/supabase/admin", () => ({
  isSupabaseAdminConfigured: true,
  createSupabaseAdminClient: () => ({ rpc: m.rpc }),
}));

const { POST } = await import("./route");

const AUTH_ID = "auth_abc123";
const CLIENT_ID = "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d";

const call = (decision: unknown, headers: Record<string, string> = {}, id = AUTH_ID) =>
  POST(
    new Request(`https://buck.test/api/oauth/authorizations/${id}/consent`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ decision }),
    }),
    { params: Promise.resolve({ id }) }
  );

const session = (overrides: Partial<{ satisfied: boolean; currentLevel: "aal1" | "aal2" }> = {}) => ({
  user: { id: "user-1" },
  accessToken: "cookie-token",
  mfa: {
    currentLevel: "aal2",
    verifiedFactorCount: 1,
    hasVerifiedFactor: true,
    satisfied: true,
    ...overrides,
  },
});

describe("POST /api/oauth/authorizations/[id]/consent (ADR-049)", () => {
  beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset());
    m.getRequestAuth.mockResolvedValue(session());
    m.getAuthorizationDetails.mockResolvedValue({
      data: {
        authorization_id: AUTH_ID,
        redirect_uri: "https://app.test/cb",
        client: { id: CLIENT_ID, name: "App", uri: "", logo_uri: "" },
        user: { id: "user-1", email: "u@test" },
        scope: "openid email",
      },
      error: null,
    });
    m.approveAuthorization.mockResolvedValue({ data: { redirect_url: "https://app.test/cb?code=1" }, error: null });
    m.denyAuthorization.mockResolvedValue({ data: { redirect_url: "https://app.test/cb?error=access_denied" }, error: null });
    m.rpc.mockResolvedValue({ data: "consent-1", error: null });
    m.revokeGrant.mockResolvedValue({ data: {}, error: null });
  });

  it("approves, records the grant as 2FA-verified and returns the app's redirect", async () => {
    const response = await call("approve");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirectUrl: "https://app.test/cb?code=1" });
    expect(m.approveAuthorization).toHaveBeenCalledWith(AUTH_ID, { skipBrowserRedirect: true });
    expect(m.rpc).toHaveBeenCalledWith("record_oauth_app_grant", {
      p_user_id: "user-1",
      p_client_id: CLIENT_ID,
      p_mfa_verified: true,
    });
  });

  it("records an aal1 approval (user without 2FA) as not verified", async () => {
    m.getRequestAuth.mockResolvedValue(
      session({ currentLevel: "aal1", satisfied: true })
    );
    await call("approve");
    expect(m.rpc).toHaveBeenCalledWith("record_oauth_app_grant", expect.objectContaining({ p_mfa_verified: false }));
  });

  it("undoes the approval when the grant cannot be recorded", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const response = await call("approve");

    expect(response.status).toBe(500);
    expect(m.revokeGrant).toHaveBeenCalledWith({ clientId: CLIENT_ID });
  });

  it("refuses a session that still owes its 2FA code", async () => {
    m.getRequestAuth.mockResolvedValue(session({ currentLevel: "aal1", satisfied: false }));
    const response = await call("approve");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "mfa_required" });
    expect(m.approveAuthorization).not.toHaveBeenCalled();
  });

  it("refuses bearer tokens: approving is a web-session step", async () => {
    const response = await call("approve", { authorization: "Bearer tok" });

    expect(response.status).toBe(400);
    expect(m.getRequestAuth).not.toHaveBeenCalled();
  });

  it("rejects ids that could change Supabase's URL, and unknown decisions", async () => {
    expect((await call("approve", {}, "../admin")).status).toBe(400);
    expect((await call("maybe")).status).toBe(400);
    expect(m.getRequestAuth).not.toHaveBeenCalled();
  });

  it("denies without recording anything", async () => {
    const response = await call("deny");

    expect(await response.json()).toEqual({ redirectUrl: "https://app.test/cb?error=access_denied" });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("passes an earlier approval straight through", async () => {
    m.getAuthorizationDetails.mockResolvedValue({ data: { redirect_url: "https://app.test/cb?code=2" }, error: null });
    const response = await call("approve");

    expect(await response.json()).toEqual({ redirectUrl: "https://app.test/cb?code=2" });
    expect(m.approveAuthorization).not.toHaveBeenCalled();
  });
});
