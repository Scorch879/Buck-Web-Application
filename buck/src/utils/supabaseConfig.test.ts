import { afterEach, describe, expect, it, vi } from "vitest";

describe("supabaseConfig env helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns narrowed url and anonKey when configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co ");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", " anon-key ");
    vi.resetModules();

    const { getSupabaseEnv } = await import("./supabaseConfig");
    expect(getSupabaseEnv()).toEqual({
      url: "https://proj.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("throws when public supabase env is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.resetModules();

    const { getSupabaseEnv } = await import("./supabaseConfig");
    expect(() => getSupabaseEnv()).toThrow("Supabase is not configured.");
  });

  it("returns narrowed admin env when service role key is set and throws otherwise", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.resetModules();

    const missing = await import("./supabaseConfig");
    expect(() => missing.getSupabaseAdminEnv()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);

    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.resetModules();

    const configured = await import("./supabaseConfig");
    expect(configured.getSupabaseAdminEnv()).toEqual({
      url: "https://proj.supabase.co",
      serviceRoleKey: "service-key",
    });
  });
});
