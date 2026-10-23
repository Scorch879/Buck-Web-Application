import { describe, expect, it } from "vitest";
import {
  createMfaVerifyPath,
  getLastTotpVerificationMs,
  getMfaState,
  hasFreshStepUp,
  isMfaSatisfied,
  readAccessTokenClaims,
} from "./assurance";
import {
  generateRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
} from "./recoveryCodes";

const jwt = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
const verified = { factors: [{ status: "verified" }] } as never;
const unverifiedOnly = { factors: [{ status: "unverified" }] } as never;

describe("isMfaSatisfied (same rule as private.mfa_satisfied)", () => {
  it.each([
    ["aal1", 0, true],
    ["aal2", 0, true],
    ["aal1", 1, false],
    ["aal2", 1, true],
    [undefined, 1, false],
    [null, 0, true],
  ] as const)("aal=%s factors=%i → %s", (aal, count, expected) => {
    expect(isMfaSatisfied(aal, count)).toBe(expected);
  });
});

describe("getMfaState", () => {
  it("only counts verified factors", () => {
    expect(getMfaState(unverifiedOnly, jwt({ aal: "aal1" }))).toMatchObject({
      verifiedFactorCount: 0,
      satisfied: true,
    });
  });

  it("treats a passkey sign-in (aal1) of a 2FA user as not satisfied", () => {
    const token = jwt({ aal: "aal1", amr: [{ method: "webauthn", timestamp: 1 }] });
    expect(getMfaState(verified, token).satisfied).toBe(false);
  });

  it("fails closed on a missing or garbled token", () => {
    expect(getMfaState(verified, undefined)).toMatchObject({ currentLevel: "aal1", satisfied: false });
    expect(getMfaState(verified, "not-a-jwt").satisfied).toBe(false);
    expect(readAccessTokenClaims("a.%%%.c")).toBeNull();
  });
});

describe("step-up", () => {
  const now = 1_800_000_000_000;
  const tokenAt = (ms: number, method = "totp") =>
    jwt({ aal: "aal2", amr: [{ method: "password", timestamp: 1 }, { method, timestamp: ms / 1000 }] });

  it("reads the latest TOTP timestamp in either amr spelling", () => {
    expect(getLastTotpVerificationMs(tokenAt(now))).toBe(now);
    expect(getLastTotpVerificationMs(tokenAt(now, "mfa/totp"))).toBe(now);
    expect(getLastTotpVerificationMs(jwt({ amr: ["password"] }))).toBeNull();
  });

  it("needs a TOTP check from the last 10 minutes when 2FA is on", () => {
    const state = getMfaState(verified, tokenAt(now - 5 * 60_000));
    expect(hasFreshStepUp(state, tokenAt(now - 5 * 60_000), now)).toBe(true);
    expect(hasFreshStepUp(state, tokenAt(now - 11 * 60_000), now)).toBe(false);
  });

  it("does not ask users without 2FA", () => {
    const state = getMfaState({ factors: [] } as never, jwt({ aal: "aal1" }));
    expect(hasFreshStepUp(state, jwt({ aal: "aal1" }), now)).toBe(true);
  });
});

describe("createMfaVerifyPath", () => {
  it("keeps the destination as a query parameter", () => {
    expect(createMfaVerifyPath("/dashboard/wallet?tab=income")).toBe(
      "/verify-2fa?redirectTo=%2Fdashboard%2Fwallet%3Ftab%3Dincome"
    );
  });
});

describe("recovery codes", () => {
  it("generates 10 distinct XXXXX-XXXXX Crockford codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    codes.forEach((code) => expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/));
  });

  it("normalizes what users actually type", () => {
    const code = generateRecoveryCode();
    const compact = code.replace("-", "");
    expect(normalizeRecoveryCode(code)).toBe(compact);
    expect(normalizeRecoveryCode(` ${code.toLowerCase()} `)).toBe(compact);
    expect(normalizeRecoveryCode("abcde-fgh0o")).toBe("ABCDEFGH00");
    expect(normalizeRecoveryCode("ilo12-34567")).toBe("11012" + "34567");
  });

  it("rejects malformed input", () => {
    expect(normalizeRecoveryCode("short")).toBeNull();
    expect(normalizeRecoveryCode("UUUUU-UUUUU")).toBeNull();
    expect(normalizeRecoveryCode(12345)).toBeNull();
    expect(normalizeRecoveryCode(undefined)).toBeNull();
  });

  it("binds the hash to the user", () => {
    const code = normalizeRecoveryCode(generateRecoveryCode())!;
    expect(hashRecoveryCode("user-a", code)).toBe(hashRecoveryCode("user-a", code));
    expect(hashRecoveryCode("user-a", code)).not.toBe(hashRecoveryCode("user-b", code));
    expect(hashRecoveryCode("user-a", code)).toMatch(/^[0-9a-f]{64}$/);
  });
});
