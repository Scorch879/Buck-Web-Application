import { createHmac, randomBytes } from "node:crypto";

/**
 * Single-use 2FA backup codes (ADR-048). Ten codes of 10 Crockford base32
 * characters (~50 bits each), shown once as `XXXXX-XXXXX`. Only an HMAC bound
 * to the user id is stored, so a leaked table row cannot be replayed for
 * another account and the codes cannot be brute-forced offline without
 * MFA_RECOVERY_SECRET.
 */

export const RECOVERY_CODE_COUNT = 10;
const CODE_LENGTH = 10;
// Crockford base32: no I, L, O, U, so codes read and type unambiguously.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function getRecoverySecret() {
  const secret = process.env.MFA_RECOVERY_SECRET?.trim();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("2FA backup codes need MFA_RECOVERY_SECRET on the server.");
  }

  return "buck-local-mfa-recovery-secret";
}

export function generateRecoveryCode() {
  // 256 is a multiple of 32, so `byte & 31` is uniform.
  const chars = Array.from(randomBytes(CODE_LENGTH), (byte) => ALPHABET[byte & 31]);
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  const codes = new Set<string>();

  while (codes.size < count) {
    codes.add(generateRecoveryCode());
  }

  return Array.from(codes);
}

/**
 * Uppercases, drops spaces and dashes, and maps the Crockford look-alikes
 * (O→0, I/L→1). Returns null for anything that cannot be a code.
 */
export function normalizeRecoveryCode(input: unknown) {
  if (typeof input !== "string") {
    return null;
  }

  const normalized = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

  if (normalized.length !== CODE_LENGTH) {
    return null;
  }

  return [...normalized].every((char) => ALPHABET.includes(char)) ? normalized : null;
}

/** `code` must already be normalized. */
export function hashRecoveryCode(userId: string, code: string) {
  return createHmac("sha256", getRecoverySecret())
    .update(`${userId}:${code}`)
    .digest("hex");
}
