import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminUser } from "./adminAccess";
import { isBearerAuthorized, secureCompare } from "./secureCompare";

describe("secureCompare / isBearerAuthorized", () => {
  it("compares equal and unequal strings", () => {
    expect(secureCompare("abc", "abc")).toBe(true);
    expect(secureCompare("abc", "abd")).toBe(false);
    expect(secureCompare("abc", "abcd")).toBe(false);
  });

  it("fails closed when no secret is configured", () => {
    expect(isBearerAuthorized("Bearer ", undefined)).toBe(false);
    expect(isBearerAuthorized("Bearer ", "  ")).toBe(false);
    expect(isBearerAuthorized(null, "")).toBe(false);
  });

  it("accepts only the exact bearer secret", () => {
    expect(isBearerAuthorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(isBearerAuthorized("s3cret", "s3cret")).toBe(false);
    expect(isBearerAuthorized("Bearer wrong", "s3cret")).toBe(false);
    expect(isBearerAuthorized(null, "s3cret")).toBe(false);
  });
});

describe("isAdminUser", () => {
  afterEach(() => vi.unstubAllEnvs());

  const confirmed = "2026-01-01T00:00:00Z";

  it("rejects missing and unconfirmed users", () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    expect(isAdminUser(null)).toBe(false);
    expect(
      isAdminUser({ email: "admin@example.com", email_confirmed_at: undefined, app_metadata: {} })
    ).toBe(false);
  });

  it("accepts the configured admin email case-insensitively", () => {
    vi.stubEnv("ADMIN_EMAIL", "Admin@Example.com");
    expect(
      isAdminUser({ email: "admin@example.com", email_confirmed_at: confirmed, app_metadata: {} })
    ).toBe(true);
    expect(
      isAdminUser({ email: "other@example.com", email_confirmed_at: confirmed, app_metadata: {} })
    ).toBe(false);
  });

  it("fails closed when ADMIN_EMAIL is unset and there is no role claim", () => {
    vi.stubEnv("ADMIN_EMAIL", "");
    expect(
      isAdminUser({
        email: "buckthebudgettracker@gmail.com",
        email_confirmed_at: confirmed,
        app_metadata: {},
      })
    ).toBe(false);
    expect(
      isAdminUser({ email: "", email_confirmed_at: confirmed, app_metadata: {} })
    ).toBe(false);
  });

  it("accepts the server-managed admin role claim", () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    expect(
      isAdminUser({
        email: "other@example.com",
        email_confirmed_at: confirmed,
        app_metadata: { role: "admin" },
      })
    ).toBe(true);
  });
});
