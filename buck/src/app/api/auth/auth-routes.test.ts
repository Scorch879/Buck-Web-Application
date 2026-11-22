import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const insertSecurityEvent = vi.fn();
const resetPasswordForEmail = vi.fn();
const signUp = vi.fn();
const resend = vi.fn();
const signInWithOtp = vi.fn();
const getRequestAuth = vi.fn();

const mockEventQueryChain = () => {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    in: () => chain,
    neq: () => chain,
    order: () => chain,
    limit: async () => ({ data: [], error: null }),
    then: (resolve: (value: { count: number; error: null }) => void) =>
      resolve({ count: 0, error: null }),
  };
  return chain;
};

let eventCountOverride = 0;

vi.mock("@/utils/supabaseConfig", () => ({
  isSupabaseConfigured: true,
  isSupabaseAdminConfigured: true,
  supabaseConfigError: "Supabase not configured",
  supabaseUrl: "https://proj.supabase.co",
  supabaseAnonKey: "anon",
}));

vi.mock("@/utils/supabase/admin", () => ({
  isSupabaseAdminConfigured: true,
  createSupabaseAdminClient: () => ({
    rpc,
    from: () => ({
      insert: insertSecurityEvent,
      select: () => {
        const chain: Record<string, unknown> = {
          eq: () => chain,
          gte: () => chain,
          in: () => chain,
          neq: () => chain,
          order: () => chain,
          limit: async () => ({ data: [], error: null }),
          then: (resolve: (value: { count: number; error: null }) => void) =>
            resolve({ count: eventCountOverride, error: null }),
        };
        return chain;
      },
    }),
  }),
}));

vi.mock("@/utils/supabase/stateless", () => ({
  createSupabaseStatelessClient: () => ({
    auth: {
      resetPasswordForEmail,
      signUp,
      resend,
      signInWithOtp,
    },
  }),
}));

vi.mock("@/utils/apiAuth", async () => {
  const actual = await vi.importActual<typeof import("@/utils/apiAuth")>("@/utils/apiAuth");
  return {
    ...actual,
    getRequestAuth,
  };
});

const { POST: postPasswordReset } = await import("./password-reset/route");
const { POST: postSignUp } = await import("./sign-up/route");
const { POST: postResendConfirmation } = await import("./resend-confirmation/route");
const { GET: getCredentials } = await import("./credentials/route");

void mockEventQueryChain;

function jsonPost(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/password-reset", () => {
  beforeEach(() => {
    eventCountOverride = 0;
    rpc.mockReset();
    insertSecurityEvent.mockReset();
    insertSecurityEvent.mockResolvedValue({ error: null });
    resetPasswordForEmail.mockReset();
    resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("returns generic 200 without sending email when account does not exist (SEC-020)", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          exists: false,
          email_confirmed: false,
          has_email_identity: false,
          has_google_identity: false,
          has_password: false,
          has_passkey: false,
        },
      ],
      error: null,
    });

    const response = await postPasswordReset(
      jsonPost("http://localhost:3000/api/auth/password-reset", { email: "nobody@example.com" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
    expect(insertSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "password_reset", outcome: "not_found" })
    );
  });

  it("blocks Google-only accounts without password or passkey while returning identical SEC-020 200", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          exists: true,
          email_confirmed: true,
          has_email_identity: false,
          has_google_identity: true,
          has_password: false,
          has_passkey: false,
        },
      ],
      error: null,
    });

    const response = await postPasswordReset(
      jsonPost("http://localhost:3000/api/auth/password-reset", { email: "googleonly@example.com" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
    expect(insertSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "password_reset", outcome: "blocked_provider" })
    );
  });

  it("allows Google account WITH a registered passkey to receive a password reset email", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          exists: true,
          email_confirmed: true,
          has_email_identity: false,
          has_google_identity: true,
          has_password: false,
          has_passkey: true,
        },
      ],
      error: null,
    });

    const response = await postPasswordReset(
      jsonPost("http://localhost:3000/api/auth/password-reset", { email: "googlepasskey@example.com" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "googlepasskey@example.com",
      { redirectTo: "http://localhost:3000/auth/callback?next=%2Fforgot-password%3Ftype%3Drecovery" }
    );
    expect(insertSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "password_reset", outcome: "sent" })
    );
  });

  it("returns 429 with Retry-After when rate-limited", async () => {
    eventCountOverride = 10;

    const response = await postPasswordReset(
      jsonPost("http://localhost:3000/api/auth/password-reset", { email: "user@example.com" })
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.errorCode).toBe("rate_limited");
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/sign-up", () => {
  beforeEach(() => {
    eventCountOverride = 0;
    rpc.mockReset();
    insertSecurityEvent.mockReset();
    insertSecurityEvent.mockResolvedValue({ error: null });
    signUp.mockReset();
    resend.mockReset();
    signInWithOtp.mockReset();
    signInWithOtp.mockResolvedValue({ error: null });
  });

  it("answers a Google-only address with the neutral 200 and e-mails its owner (SEC-046)", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          exists: true,
          email_confirmed: true,
          has_email_identity: false,
          has_google_identity: true,
          has_password: false,
          has_passkey: false,
        },
      ],
      error: null,
    });

    const response = await postSignUp(
      jsonPost("http://localhost:3000/api/auth/sign-up", {
        username: "Jane",
        email: "jane@gmail.com",
        password: "StrongPassword123!",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      needsEmailConfirmation: true,
      message: "Check your email to finish creating your account.",
    });
    expect(signUp).not.toHaveBeenCalled();
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jane@gmail.com" })
    );
  });

  it("answers a confirmed e-mail account with the neutral 200 and e-mails its owner (SEC-046)", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          exists: true,
          email_confirmed: true,
          has_email_identity: true,
          has_google_identity: false,
          has_password: true,
          has_passkey: false,
        },
      ],
      error: null,
    });

    const response = await postSignUp(
      jsonPost("http://localhost:3000/api/auth/sign-up", {
        username: "Jane",
        email: "jane@example.com",
        password: "StrongPassword123!",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      needsEmailConfirmation: true,
      message: "Check your email to finish creating your account.",
    });
    expect(signUp).not.toHaveBeenCalled();
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jane@example.com" })
    );
  });

  it("resends confirmation for an unconfirmed existing email account", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          exists: true,
          email_confirmed: false,
          has_email_identity: true,
          has_google_identity: false,
          has_password: true,
          has_passkey: false,
        },
      ],
      error: null,
    });
    resend.mockResolvedValue({ error: null });

    const response = await postSignUp(
      jsonPost("http://localhost:3000/api/auth/sign-up", {
        username: "Jane",
        email: "pending@example.com",
        password: "StrongPassword123!",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, needsEmailConfirmation: true });
    expect(resend).toHaveBeenCalledWith({
      type: "signup",
      email: "pending@example.com",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Fdashboard%2Fhome" },
    });
  });

  it("creates a new email+password account and requires confirmation", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          exists: false,
          email_confirmed: false,
          has_email_identity: false,
          has_google_identity: false,
          has_password: false,
          has_passkey: false,
        },
      ],
      error: null,
    });
    signUp.mockResolvedValue({
      data: { user: { id: "new-user", identities: [{ provider: "email" }] }, session: null },
      error: null,
    });

    const response = await postSignUp(
      jsonPost("http://localhost:3000/api/auth/sign-up", {
        username: "New User",
        email: "newuser@example.com",
        password: "StrongPassword123!",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, needsEmailConfirmation: true });
    expect(signUp).toHaveBeenCalledWith({
      email: "newuser@example.com",
      password: "StrongPassword123!",
      options: {
        data: { username: "New User", full_name: "New User" },
        emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Fdashboard%2Fhome",
      },
    });
  });
});

describe("POST /api/auth/resend-confirmation", () => {
  beforeEach(() => {
    eventCountOverride = 0;
    rpc.mockReset();
    insertSecurityEvent.mockReset();
    insertSecurityEvent.mockResolvedValue({ error: null });
    resend.mockReset();
  });

  it("answers Google-only emails with the same neutral 200 (SEC-046)", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          exists: true,
          email_confirmed: true,
          has_email_identity: false,
          has_google_identity: true,
          has_password: false,
          has_passkey: false,
        },
      ],
      error: null,
    });

    const response = await postResendConfirmation(
      jsonPost("http://localhost:3000/api/auth/resend-confirmation", { email: "g@gmail.com" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.errorCode).toBeUndefined();
    expect(resend).not.toHaveBeenCalled();
  });

  it("returns generic 200 for unknown emails without calling resend", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          exists: false,
          email_confirmed: false,
          has_email_identity: false,
          has_google_identity: false,
          has_password: false,
          has_passkey: false,
        },
      ],
      error: null,
    });

    const response = await postResendConfirmation(
      jsonPost("http://localhost:3000/api/auth/resend-confirmation", { email: "unknown@example.com" })
    );

    expect(response.status).toBe(200);
    expect(resend).not.toHaveBeenCalled();
  });

  it("resends confirmation for unconfirmed account", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          exists: true,
          email_confirmed: false,
          has_email_identity: true,
          has_google_identity: false,
          has_password: true,
          has_passkey: false,
        },
      ],
      error: null,
    });
    resend.mockResolvedValue({ error: null });

    const response = await postResendConfirmation(
      jsonPost("http://localhost:3000/api/auth/resend-confirmation", { email: "pending@example.com" })
    );

    expect(response.status).toBe(200);
    expect(resend).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/auth/credentials", () => {
  beforeEach(() => {
    getRequestAuth.mockReset();
    rpc.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    getRequestAuth.mockResolvedValue(null);
    const response = await getCredentials(new Request("http://localhost:3000/api/auth/credentials"));
    expect(response.status).toBe(401);
  });

  it("returns 401 mfa_required when session has not satisfied 2FA", async () => {
    getRequestAuth.mockResolvedValue({
      user: { id: "u1" },
      accessToken: "t",
      mfa: { currentLevel: "aal1", verifiedFactorCount: 1, hasVerifiedFactor: true, satisfied: false },
    });
    const response = await getCredentials(new Request("http://localhost:3000/api/auth/credentials"));
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.error).toBe("mfa_required");
  });

  it("reports canResetPassword=false for Google-only without passkey and true with passkey", async () => {
    getRequestAuth.mockResolvedValue({
      user: { id: "g1" },
      accessToken: "t",
      mfa: { currentLevel: "aal1", verifiedFactorCount: 0, hasVerifiedFactor: false, satisfied: true },
    });
    rpc.mockResolvedValueOnce({
      data: [
        {
          exists: true,
          email_confirmed: true,
          has_email_identity: false,
          has_google_identity: true,
          has_password: false,
          has_passkey: false,
        },
      ],
      error: null,
    });

    const res1 = await getCredentials(new Request("http://localhost:3000/api/auth/credentials"));
    expect(await res1.json()).toEqual({
      isPasswordUser: false,
      isGoogleOnlyUser: true,
      hasEmailIdentity: false,
      hasGoogleIdentity: true,
      hasPassword: false,
      hasPasskey: false,
      canResetPassword: false,
    });

    rpc.mockResolvedValueOnce({
      data: [
        {
          exists: true,
          email_confirmed: true,
          has_email_identity: false,
          has_google_identity: true,
          has_password: false,
          has_passkey: true,
        },
      ],
      error: null,
    });

    const res2 = await getCredentials(new Request("http://localhost:3000/api/auth/credentials"));
    expect(await res2.json()).toEqual({
      isPasswordUser: false,
      isGoogleOnlyUser: true,
      hasEmailIdentity: false,
      hasGoogleIdentity: true,
      hasPassword: false,
      hasPasskey: true,
      canResetPassword: true,
    });
  });
});
