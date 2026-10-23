import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/utils/supabaseConfig", () => ({
  isSupabaseConfigured: true,
  supabaseUrl: "https://proj.supabase.co",
  supabaseAnonKey: "anon-key",
  supabaseCookieOptions: {},
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

const { GET } = await import("./route");

describe("auth callback hash fallback (implicit-flow e-mail links)", () => {
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
      await GET(new NextRequest("http://localhost:3000/auth/callback", { headers: { "x-nonce": 'a"b' } }))
    ).text();
    const without = await (await GET(new NextRequest("http://localhost:3000/auth/callback"))).text();

    expect(withQuote).toContain('<script nonce="a&quot;b">');
    expect(without).toContain("<script>");
  });
});
