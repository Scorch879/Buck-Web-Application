import { createHash, timingSafeEqual } from "node:crypto";

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
