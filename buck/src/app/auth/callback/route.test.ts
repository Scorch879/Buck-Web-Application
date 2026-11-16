import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();
const signOut = vi.fn();
const rpc = vi.fn();

vi.mock("@/utils/supabaseConfig", () => ({
  isSupabaseConfigured: true,
  isSupabaseAdminConfigured: true,
  supabaseUrl: "https://proj.supabase.co",
  supabaseAnonKey: "anon-key",
  supabaseCookieOptions: {},
}));

vi.mock("@/utils/supabase/admin", () => ({
  isSupabaseAdminConfigured: true,
  createSupabaseAdminClient: () => ({ rpc }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: (cookies: Array<{ name: string; value: string; options: Record<string, unknown> }>) => void } }
  ) => ({
    auth: {
      getUser,
      verifyOtp: async (args: unknown) => {
        const res = await verifyOtp(args);
        if (!res.error) {
          options.cookies.setAll([
            { name: "sb-proj-auth-token", value: "session-cookie", options: { path: "/" } },
          ]);
        }
        return res;
      },
      exchangeCodeForSession: async (code: string) => {
        const res = await exchangeCodeForSession(code);
        if (!res.error) {
          options.cookies.setAll([
            { name: "sb-proj-auth-token", value: "session-cookie", options: { path: "/" } },
          ]);
        }
        return res;
      },
      signOut,
    },
  }),
}));

const { GET, POST } = await import("./route");

describe("auth callback hash fallback (implicit-flow e-mail links)", () => {
  beforeEach(() => {
    getUser.mockReset();
    verifyOtp.mockReset();
    exchangeCodeForSession.mockReset();
    signOut.mockReset();
    rpc.mockReset();
    getUser.mockResolvedValue({ data: { user: null } });
  });

  it("stamps the CSP nonce on its inline redirect script", async () => {
    const request = new NextRequest(
      "http://localhost:3000/auth/callback?next=%2Fforgot-password%3Ftype%3Drecovery",
      { headers: { "x-nonce": "abc123==" } }
    );

    const html = await (await GET(request)).text();

    expect(html).toContain('<script nonce="abc123==">');
    expect(html).toContain('data-next="/forgot-password?type=recovery"');
  });

  it("escapes the nonce and still renders without one", async () => {
    const withQuote = await (
      await GET(
        new NextRequest("http://localhost:3000/auth/callback", {
          headers: { "x-nonce": 'a"b' },
        })
      )
    ).text();
    const without = await (
      await GET(new NextRequest("http://localhost:3000/auth/callback"))
    ).text();

    expect(withQuote).toContain('<script nonce="a&quot;b">');
    expect(without).toContain("<script>");
  });

  it("still inspects hash fragments for /forgot-password even if a stale session cookie exists", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "stale-user" } } });
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/auth/callback?next=%2Fforgot-password%3Ftype%3Drecovery",
        { headers: { "x-nonce": "n1" } }
      )
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('data-next="/forgot-password?type=recovery"');
  });
});

describe("auth callback contextual errors & scanner-safe token_hash flow", () => {
  beforeEach(() => {
    getUser.mockReset();
    verifyOtp.mockReset();
    exchangeCodeForSession.mockReset();
    signOut.mockReset();
    rpc.mockReset();
    getUser.mockResolvedValue({ data: { user: null } });
  });

  it("routes expired recovery query errors to /forgot-password?error=recovery-link-expired", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/auth/callback?next=%2Fforgot-password%3Ftype%3Drecovery&error=access_denied&error_code=otp_expired"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/forgot-password?error=recovery-link-expired"
    );
  });

  it("routes expired signup verification query errors to /check-email?error=email-verification-expired", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/auth/callback?next=%2Fdashboard%2Fhome&error=access_denied&error_code=otp_expired"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/check-email?error=email-verification-expired"
    );
  });

  it("routes OAuth denial errors to /sign-in?error=google-signin-failed", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/auth/callback?error=access_denied&error_description=User+denied+access"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?error=google-signin-failed"
    );
  });

  it("renders a POST confirmation page on GET with token_hash without consuming the OTP", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/auth/callback?token_hash=tok_abc&type=recovery&next=%2Fforgot-password%3Ftype%3Drecovery",
        { headers: { "x-nonce": "csp123" } }
      )
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    const html = await response.text();
    expect(html).toContain('<form method="POST" action="/auth/callback">');
    expect(html).toContain('name="token_hash" value="tok_abc"');
    expect(html).toContain('name="type" value="recovery"');
    expect(html).toContain("Continue to Reset Password");
    expect(html).toContain('<style nonce="csp123">');
  });

  it("renders Confirm Email Address button on GET with type=signup", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/auth/callback?token_hash=tok_signup&type=signup&next=%2Fdashboard%2Fhome"
      )
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    const html = await response.text();
    expect(html).toContain("Confirm Email Address");
  });

  it("verifies signup token_hash on POST and redirects with 303 to /dashboard/home", async () => {
    verifyOtp.mockResolvedValue({
      data: {
        user: { id: "user-1" },
        session: { access_token: "tok", user: { id: "user-1", factors: [] } },
      },
      error: null,
    });

    const form = new URLSearchParams({
      token_hash: "tok_signup",
      type: "signup",
      next: "/dashboard/home",
    });

    const response = await POST(
      new NextRequest("http://localhost:3000/auth/callback", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      })
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "tok_signup",
      type: "signup",
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard/home"
    );
  });

  it("redirects expired recovery POST verification to /forgot-password?error=recovery-link-expired", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "otp_expired", message: "Email link is invalid or has expired" },
    });

    const form = new URLSearchParams({
      token_hash: "expired_tok",
      type: "recovery",
      next: "/forgot-password?type=recovery",
    });

    const response = await POST(
      new NextRequest("http://localhost:3000/auth/callback", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/forgot-password?error=recovery-link-expired"
    );
  });

  it("blocks Google-only users without password/passkey from completing password recovery", async () => {
    verifyOtp.mockResolvedValue({
      data: {
        user: { id: "google-user-1" },
        session: {
          access_token: "tok",
          user: { id: "google-user-1", factors: [] },
        },
      },
      error: null,
    });
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
    signOut.mockResolvedValue({ error: null });

    const form = new URLSearchParams({
      token_hash: "tok_rec",
      type: "recovery",
      next: "/forgot-password?type=recovery",
    });

    const response = await POST(
      new NextRequest("http://localhost:3000/auth/callback", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      })
    );

    expect(signOut).toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?error=recovery-not-available-for-google"
    );
  });

  it("preserves /forgot-password?type=recovery behind 2FA gate for 2FA-enabled password users", async () => {
    const jwt = `h.${Buffer.from(JSON.stringify({ aal: "aal1" })).toString("base64url")}.s`;
    verifyOtp.mockResolvedValue({
      data: {
        user: { id: "pw-user-2fa" },
        session: {
          access_token: jwt,
          user: {
            id: "pw-user-2fa",
            factors: [{ id: "f1", factor_type: "totp", status: "verified" }],
          },
        },
      },
      error: null,
    });
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

    const form = new URLSearchParams({
      token_hash: "tok_rec_2fa",
      type: "recovery",
      next: "/forgot-password?type=recovery",
    });

    const response = await POST(
      new NextRequest("http://localhost:3000/auth/callback", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/verify-2fa?redirectTo=%2Fforgot-password%3Ftype%3Drecovery"
    );
  });
});
