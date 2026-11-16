import { createHash, timingSafeEqual } from "node:crypto";

/** Computes the lowercase hex SHA-256 digest of a verification/recovery token. */
export function hashSha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time verification of a raw token against a stored hex SHA-256 hash. */
export function matchesSha256Hex(raw: string, expectedHex: string): boolean {
  const actual = Buffer.from(hashSha256Hex(raw), "hex");
  const expected = Buffer.from(expectedHex, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Constant-time string comparison. Both inputs are hashed first so the
 * comparison length never depends on the secret's length.
 */
export function secureCompare(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();

  return timingSafeEqual(left, right);
}

/**
 * True only when a non-empty secret is configured and the request carries
 * `Authorization: Bearer <secret>`. Fails closed when the secret is missing.
 */
export function isBearerAuthorized(
  authorizationHeader: string | null,
  expectedSecret: string | undefined
) {
  const secret = expectedSecret?.trim();

  if (!secret) {
    return false;
  }

  return secureCompare(authorizationHeader ?? "", `Bearer ${secret}`);
}
