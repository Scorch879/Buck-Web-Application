import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  capabilities: vi.fn(),
  checkRateLimit: vi.fn(),
  recordSecurityEvent: vi.fn(),
  resend: vi.fn(),
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
  createSupabaseStatelessClient: () => ({ auth: { resend: m.resend } }),
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

const { POST } = await import("./route");

const NEUTRAL = {
  success: true,
  message: "If an unverified Buck account exists for that email, a confirmation email is on its way.",
};
const none = { exists: false, emailConfirmed: false, hasEmailIdentity: false, hasGoogleIdentity: false, hasPassword: false, hasPasskey: false };
const states = {
  unknown: none,
  unconfirmed: { ...none, exists: true, hasEmailIdentity: true, hasPassword: true },
  confirmed: { ...none, exists: true, emailConfirmed: true, hasEmailIdentity: true, hasPassword: true },
  googleOnly: { ...none, exists: true, emailConfirmed: true, hasGoogleIdentity: true },
};

const resendConfirmation = () =>
  POST(new Request("https://buck.test/api/auth/resend-confirmation", {
    method: "POST",
    body: JSON.stringify({ email: "juan.dela@example.com" }),
  }));

describe("POST /api/auth/resend-confirmation (SEC-046)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.checkRateLimit.mockResolvedValue({ limited: false });
    m.resend.mockResolvedValue({ error: null });
  });

  it.each(Object.entries(states))("answers the same for a %s address", async (_name, capabilities) => {
    m.capabilities.mockResolvedValue(capabilities);
    const response = await resendConfirmation();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(NEUTRAL);
  });

  it("only sends a confirmation to an unverified account", async () => {
    for (const capabilities of Object.values(states)) {
      m.capabilities.mockResolvedValue(capabilities);
      await resendConfirmation();
    }
    expect(m.resend).toHaveBeenCalledOnce();
  });

  it("answers neutrally when Supabase refuses to send", async () => {
    m.capabilities.mockResolvedValue(states.unconfirmed);
    m.resend.mockResolvedValue({ error: { status: 429, message: "Too many requests" } });
    const response = await resendConfirmation();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(NEUTRAL);
  });

  it("starts the same cooldown whatever the account state", async () => {
    m.capabilities.mockResolvedValue(states.unknown);
    await resendConfirmation();
    expect(m.checkRateLimit.mock.calls[0][2].cooldownOutcomes).toEqual(
      expect.arrayContaining(["sent", "not_found", "already_exists", "blocked_provider", "provider_error"])
    );
  });
});
