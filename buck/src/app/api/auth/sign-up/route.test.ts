import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  capabilities: vi.fn(),
  checkRateLimit: vi.fn(),
  recordSecurityEvent: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
  signInWithOtp: vi.fn(),
  isSmtpConfigured: vi.fn(),
  sendExistingAccountSignUpEmail: vi.fn(),
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
vi.mock("@/utils/supabase/stateless", () => ({
  createSupabaseStatelessClient: () => ({
    auth: { signUp: m.signUp, resend: m.resend, signInWithOtp: m.signInWithOtp },
  }),
}));
vi.mock("@/utils/authRateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/authRateLimit")>()),
  getEmailActionSecurityContext: (_request: Request, normalizedEmail: string) => ({
    emailHash: "email-hash",
    ipHash: "ip-hash",
    normalizedEmail,
  }),
  checkEmailActionRateLimit: m.checkRateLimit,
  recordSecurityEvent: m.recordSecurityEvent,
}));
vi.mock("@/utils/authCapabilities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/authCapabilities")>()),
  getAuthAccountCapabilitiesByEmail: m.capabilities,
}));
vi.mock("@/utils/mailer", () => ({
  isSmtpConfigured: m.isSmtpConfigured,
  sendExistingAccountSignUpEmail: m.sendExistingAccountSignUpEmail,
}));

const { POST } = await import("./route");

const EMAIL = "juan.dela@example.com";
const STRONG = "Tr1cky!Ledger#2026";
const NEUTRAL = {
  success: true,
  needsEmailConfirmation: true,
  message: "Check your email to finish creating your account.",
};
const none = { exists: false, emailConfirmed: false, hasEmailIdentity: false, hasGoogleIdentity: false, hasPassword: false, hasPasskey: false };
const confirmedEmail = { ...none, exists: true, emailConfirmed: true, hasEmailIdentity: true, hasPassword: true };
const googleOnly = { ...none, exists: true, emailConfirmed: true, hasGoogleIdentity: true };
const unconfirmed = { ...none, exists: true, hasEmailIdentity: true, hasPassword: true };

const signUp = (body: Record<string, unknown> = {}) =>
  POST(new Request("https://buck.test/api/auth/sign-up", {
    method: "POST",
    body: JSON.stringify({ username: "juanito", email: EMAIL, password: STRONG, ...body }),
  }));
const outcomes = () => m.recordSecurityEvent.mock.calls.map(([, event]) => event.outcome);
const answer = async (response: Response) => ({ status: response.status, body: await response.json() });

describe("POST /api/auth/sign-up (SEC-046, no account enumeration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.checkRateLimit.mockResolvedValue({ limited: false });
    m.capabilities.mockResolvedValue(none);
    m.signUp.mockResolvedValue({ data: { user: { id: "u1", identities: [{ id: "i1" }] }, session: null }, error: null });
    m.resend.mockResolvedValue({ error: null });
    m.signInWithOtp.mockResolvedValue({ error: null });
    m.isSmtpConfigured.mockReturnValue(false);
    m.sendExistingAccountSignUpEmail.mockResolvedValue(true);
  });

  it("creates a new account and answers with the neutral message", async () => {
    expect(await answer(await signUp())).toEqual({ status: 200, body: NEUTRAL });
    expect(m.signUp).toHaveBeenCalledOnce();
    expect(m.signInWithOtp).not.toHaveBeenCalled();
    expect(outcomes()).toEqual(["sent"]);
  });

  it("gives an existing e-mail account the identical answer and e-mails its owner", async () => {
    m.capabilities.mockResolvedValue(confirmedEmail);
    expect(await answer(await signUp())).toEqual({ status: 200, body: NEUTRAL });
    expect(m.signUp).not.toHaveBeenCalled();
    expect(m.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({
      email: EMAIL,
      options: expect.objectContaining({ shouldCreateUser: false }),
    }));
    expect(outcomes()).toEqual(["already_exists"]);
  });

  it("gives a Google-only account the identical answer and e-mails its owner", async () => {
    m.capabilities.mockResolvedValue(googleOnly);
    expect(await answer(await signUp())).toEqual({ status: 200, body: NEUTRAL });
    expect(m.signInWithOtp).toHaveBeenCalledOnce();
    expect(outcomes()).toEqual(["blocked_provider"]);
  });

  it("uses Buck's own e-mail when SMTP is set, naming how the account signs in", async () => {
    m.isSmtpConfigured.mockReturnValue(true);
    m.capabilities.mockResolvedValue(googleOnly);
    await signUp();

    expect(m.sendExistingAccountSignUpEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: EMAIL,
      provider: "google",
      signInUrl: "https://buck.test/sign-in",
      resetUrl: "https://buck.test/forgot-password",
    }));
    expect(m.signInWithOtp).not.toHaveBeenCalled();
  });

  it("falls back to the Supabase sign-in link when SMTP fails", async () => {
    m.isSmtpConfigured.mockReturnValue(true);
    m.sendExistingAccountSignUpEmail.mockRejectedValue(new Error("smtp down"));
    m.capabilities.mockResolvedValue(confirmedEmail);

    expect(await answer(await signUp())).toEqual({ status: 200, body: NEUTRAL });
    expect(m.signInWithOtp).toHaveBeenCalledOnce();
  });

  it("still answers neutrally when the owner's notice can't be sent", async () => {
    m.capabilities.mockResolvedValue(confirmedEmail);
    m.signInWithOtp.mockResolvedValue({ error: { status: 429, message: "rate limit" } });

    expect(await answer(await signUp())).toEqual({ status: 200, body: NEUTRAL });
  });

  it("resends the confirmation for an unverified account with the identical answer, even on failure", async () => {
    m.capabilities.mockResolvedValue(unconfirmed);
    expect(await answer(await signUp())).toEqual({ status: 200, body: NEUTRAL });
    expect(m.resend).toHaveBeenCalledWith(expect.objectContaining({ type: "signup", email: EMAIL }));

    m.resend.mockResolvedValue({ error: { status: 429, message: "Too many requests" } });
    expect(await answer(await signUp())).toEqual({ status: 200, body: NEUTRAL });
    expect(outcomes()).toEqual(["sent", "provider_error"]);
  });

  it("treats Supabase's obfuscated user (identities: []) as an existing account", async () => {
    m.signUp.mockResolvedValue({ data: { user: { id: "fake", identities: [] }, session: null }, error: null });
    expect(await answer(await signUp())).toEqual({ status: 200, body: NEUTRAL });
    expect(m.signInWithOtp).toHaveBeenCalledOnce();
    expect(outcomes()).toEqual(["already_exists"]);
  });

  it("treats Supabase's user_already_exists error as an existing account", async () => {
    m.signUp.mockResolvedValue({ data: { user: null, session: null }, error: { code: "user_already_exists", message: "User already registered", status: 422 } });
    expect(await answer(await signUp())).toEqual({ status: 200, body: NEUTRAL });
    expect(m.signInWithOtp).toHaveBeenCalledOnce();
  });

  it("never returns Supabase's raw error text", async () => {
    m.signUp.mockResolvedValue({ data: { user: null, session: null }, error: { code: "unexpected_failure", message: "db detail", status: 500 } });
    const { status, body } = await answer(await signUp());

    expect(status).toBe(400);
    expect(body.message).not.toContain("db detail");
  });

  it("starts the same 60 s cooldown for new and existing addresses", async () => {
    await signUp();
    const config = m.checkRateLimit.mock.calls[0][2];
    expect(config.cooldownOutcomes).toEqual(
      expect.arrayContaining(["sent", "already_exists", "blocked_provider", "provider_error"])
    );
  });

  it("still rejects a weak password before looking the address up", async () => {
    const response = await signUp({ password: "short" });
    expect(response.status).toBe(400);
    expect(m.capabilities).not.toHaveBeenCalled();
  });
});
