import type { User } from "@supabase/supabase-js";

/**
 * The one "2FA passed" rule (ADR-048). Identical copies live in SQL
 * (private.mfa_satisfied(), used by RLS) and Buck_AI (shared/auth.py):
 *
 *   satisfied = session is aal2  OR  the user has no verified MFA factor
 *
 * Passkey sign-ins are aal1 and do not pass on their own: a password-only
 * attacker could otherwise register a passkey at aal1 and skip TOTP.
 *
 * Edge-safe (used by middleware): no Node APIs.
 */

/** Page that asks for the authenticator code. Built by the frontend team. */
export const MFA_VERIFY_PATH = "/verify-2fa";

/** Target of the 2FA recovery email; reachable at aal1 by design. */
export const EMAIL_RECOVERY_CONFIRM_PATH = "/account/mfa/recover/confirm";

/** Fresh step-up window for destructive actions (account deletion). */
export const MFA_STEP_UP_MAX_AGE_MS = 10 * 60 * 1000;

const TOTP_AMR_METHODS = new Set(["totp", "mfa/totp"]);

export type AccessTokenClaims = {
  aal?: string;
  amr?: Array<{ method?: string; timestamp?: number } | string>;
};

export type MfaState = {
  currentLevel: "aal1" | "aal2";
  verifiedFactorCount: number;
  hasVerifiedFactor: boolean;
  satisfied: boolean;
};

function decodeBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);

  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0))
  );
}

/**
 * Reads the payload of a Supabase access token WITHOUT verifying it. Only call
 * this on a token Supabase Auth has just accepted (getUser), so the claims are
 * trustworthy.
 */
export function readAccessTokenClaims(token: string | null | undefined): AccessTokenClaims | null {
  const payload = token?.split(".")[1];

  if (!payload) {
    return null;
  }

  try {
    const claims: unknown = JSON.parse(decodeBase64Url(payload));
    return claims && typeof claims === "object" ? (claims as AccessTokenClaims) : null;
  } catch {
    return null;
  }
}

export function countVerifiedFactors(user: Pick<User, "factors"> | null | undefined) {
  return user?.factors?.filter((factor) => factor.status === "verified").length ?? 0;
}

export function isMfaSatisfied(aal: string | null | undefined, verifiedFactorCount: number) {
  return aal === "aal2" || verifiedFactorCount === 0;
}

export function getMfaState(
  user: Pick<User, "factors"> | null | undefined,
  accessToken: string | null | undefined
): MfaState {
  const claims = readAccessTokenClaims(accessToken);
  const currentLevel = claims?.aal === "aal2" ? "aal2" : "aal1";
  const verifiedFactorCount = countVerifiedFactors(user);

  return {
    currentLevel,
    verifiedFactorCount,
    hasVerifiedFactor: verifiedFactorCount > 0,
    satisfied: isMfaSatisfied(currentLevel, verifiedFactorCount),
  };
}

/** Epoch ms of the most recent TOTP verification in this session, or null. */
export function getLastTotpVerificationMs(accessToken: string | null | undefined) {
  const amr = readAccessTokenClaims(accessToken)?.amr;

  if (!Array.isArray(amr)) {
    return null;
  }

  const timestamps = amr.flatMap((entry) =>
    typeof entry === "object" &&
    entry?.method &&
    TOTP_AMR_METHODS.has(entry.method) &&
    typeof entry.timestamp === "number"
      ? [entry.timestamp * 1000]
      : []
  );

  return timestamps.length ? Math.max(...timestamps) : null;
}

/**
 * Destructive actions by a 2FA user need a TOTP check from the last 10 min.
 * Users without 2FA are not asked (their password is the check).
 */
export function hasFreshStepUp(
  state: MfaState,
  accessToken: string | null | undefined,
  now = Date.now()
) {
  if (!state.hasVerifiedFactor) {
    return true;
  }

  const lastTotpMs = getLastTotpVerificationMs(accessToken);

  return lastTotpMs !== null && now - lastTotpMs <= MFA_STEP_UP_MAX_AGE_MS;
}

/** Safe in-app path for `redirectTo` after the 2FA step. */
export function createMfaVerifyPath(redirectTo: string) {
  const params = new URLSearchParams({ redirectTo });
  return `${MFA_VERIFY_PATH}?${params.toString()}`;
}
