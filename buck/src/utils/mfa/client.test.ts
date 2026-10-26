import { describe, expect, it } from "vitest";
import {
  DEFAULT_MFA_REDIRECT,
  getSafeMfaRedirect,
  isCompleteRecoveryCode,
  isMfaRequiredResponse,
  normalizeRecoveryCode,
  parseMfaStatus,
  sanitizeTotpInput,
} from "@/utils/mfa/client";

describe("getSafeMfaRedirect", () => {
  it("keeps same-origin paths with their query", () => {
    expect(getSafeMfaRedirect("/dashboard/wallet?tab=history")).toBe("/dashboard/wallet?tab=history");
    expect(getSafeMfaRedirect("/oauth/consent?authorization_id=abc")).toBe("/oauth/consent?authorization_id=abc");
  });

  it("falls back for missing, absolute and protocol-relative targets", () => {
    for (const value of [null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "dashboard"]) {
      expect(getSafeMfaRedirect(value)).toBe(DEFAULT_MFA_REDIRECT);
    }
  });

  it("never loops back to the verify page", () => {
    expect(getSafeMfaRedirect("/verify-2fa?redirectTo=/dashboard/home")).toBe(DEFAULT_MFA_REDIRECT);
  });
});

describe("backup code input", () => {
  it("normalizes case, spaces and a missing dash", () => {
    expect(normalizeRecoveryCode("abcde-12345")).toBe("ABCDE-12345");
    expect(normalizeRecoveryCode(" abcde 12345 ")).toBe("ABCDE-12345");
    expect(normalizeRecoveryCode("abcde12345")).toBe("ABCDE-12345");
  });

  it("only accepts the full XXXXX-XXXXX shape", () => {
    expect(isCompleteRecoveryCode("abcde12345")).toBe(true);
    expect(isCompleteRecoveryCode("abcd-12345")).toBe(false);
    expect(isCompleteRecoveryCode("abcde-123456")).toBe(false);
  });
});

describe("sanitizeTotpInput", () => {
  it("keeps up to six digits from pasted text", () => {
    expect(sanitizeTotpInput("123 456")).toBe("123456");
    expect(sanitizeTotpInput("12a34-5678")).toBe("123456");
  });
});

describe("parseMfaStatus", () => {
  it("reads a full status body", () => {
    const status = parseMfaStatus({
      currentLevel: "aal2",
      satisfied: true,
      enabled: true,
      factors: [{ id: "f1", friendlyName: "Aegis", createdAt: "2026-10-26T00:00:00Z" }, { nope: true }],
      recoveryCodesLeft: 7,
      emailRecovery: { state: "scheduled", availableAt: "2026-10-27T00:00:00Z" },
    });

    expect(status).toEqual({
      currentLevel: "aal2",
      satisfied: true,
      enabled: true,
      factors: [{ id: "f1", friendlyName: "Aegis", createdAt: "2026-10-26T00:00:00Z" }],
      recoveryCodesLeft: 7,
      emailRecovery: { state: "scheduled", availableAt: "2026-10-27T00:00:00Z" },
    });
  });

  it("defaults safely on junk", () => {
    expect(parseMfaStatus(null)).toEqual({
      currentLevel: "aal1",
      satisfied: false,
      enabled: false,
      factors: [],
      recoveryCodesLeft: 0,
      emailRecovery: null,
    });
  });
});

describe("isMfaRequiredResponse", () => {
  it("spots a Buck API 401 mfa_required", async () => {
    const response = new Response(JSON.stringify({ error: "mfa_required" }), { status: 401 });
    expect(await isMfaRequiredResponse(response)).toBe(true);
    // The body is still readable by the caller.
    expect(await response.json()).toEqual({ error: "mfa_required" });
  });

  it("spots the Buck_AI header", async () => {
    const response = new Response("", { status: 403, headers: { "X-Buck-Error": "mfa_required" } });
    expect(await isMfaRequiredResponse(response)).toBe(true);
  });

  it("ignores other failures", async () => {
    expect(await isMfaRequiredResponse(new Response(JSON.stringify({ error: "nope" }), { status: 401 }))).toBe(false);
    expect(await isMfaRequiredResponse(new Response("", { status: 500 }))).toBe(false);
  });
});
