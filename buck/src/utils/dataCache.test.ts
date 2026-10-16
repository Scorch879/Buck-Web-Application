import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bumpDataEpoch,
  cachedRead,
  clearDataCache,
  createInvalidatingFetch,
} from "./dataCache";
import { buildCsp, createNonce } from "./csp";

describe("cachedRead", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearDataCache();
  });
  afterEach(() => vi.useRealTimers());

  it("reuses a fresh entry and shares in-flight loads", async () => {
    const load = vi.fn(async () => [1, 2]);
    const [a, b] = await Promise.all([cachedRead("k", load), cachedRead("k", load)]);
    await cachedRead("k", load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it("refetches after a write or after the TTL", async () => {
    const load = vi.fn(async () => "x");
    await cachedRead("k", load);
    bumpDataEpoch();
    await cachedRead("k", load);
    expect(load).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(16_000);
    await cachedRead("k", load);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("never caches failures", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    await expect(cachedRead("k", load)).rejects.toThrow("boom");
    await expect(cachedRead("k", load)).resolves.toBe("ok");
  });

  it("keys are independent", async () => {
    const load = vi.fn(async () => 1);
    await cachedRead("a", load);
    await cachedRead("b", load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("createInvalidatingFetch", () => {
  beforeEach(() => clearDataCache());

  it("invalidates on mutating REST/RPC calls only", async () => {
    const base = vi.fn(async () => new Response("{}")) as unknown as typeof fetch;
    const wrapped = createInvalidatingFetch(base);
    const load = vi.fn(async () => 1);

    await cachedRead("k", load);
    await wrapped("https://x.supabase.co/rest/v1/expenses?select=id");
    await cachedRead("k", load);
    expect(load).toHaveBeenCalledTimes(1);

    await wrapped("https://x.supabase.co/rest/v1/rpc/add_expense_atomic", { method: "POST" });
    await cachedRead("k", load);
    expect(load).toHaveBeenCalledTimes(2);

    await wrapped("https://x.supabase.co/auth/v1/token", { method: "POST" });
    await cachedRead("k", load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("buildCsp", () => {
  it("is nonce-based, blocks framing/objects and allows only known origins", () => {
    const csp = buildCsp("abc", {
      supabaseUrl: "https://proj.supabase.co",
      buckAiUrl: "https://buck-ai.vercel.app/advisor",
    });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self' https://proj.supabase.co wss://proj.supabase.co https://buck-ai.vercel.app");
    expect(buildCsp("abc", { isDev: true })).toContain("'unsafe-eval'");
  });

  it("creates unpredictable nonces", () => {
    expect(createNonce()).not.toBe(createNonce());
  });
});
