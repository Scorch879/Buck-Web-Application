import { MFA_VERIFY_PATH, createMfaVerifyPath } from "@/utils/mfa/assurance";

/**
 * Browser-side helpers for the two-factor UI (ADR-048). Wraps the
 * /api/auth/mfa/* routes with typed results. Never logs, stores or puts
 * backup codes or secrets in URLs.
 */

export const DEFAULT_MFA_REDIRECT = "/dashboard/home";
export const MAX_TOTP_FACTORS = 2;
export const LOW_RECOVERY_CODES = 3;

export interface MfaFactorSummary {
  id: string;
  friendlyName: string | null;
  createdAt: string;
}

export type MfaEmailRecovery =
  | { state: "awaiting_email"; expiresAt: string }
  | { state: "scheduled"; availableAt: string };

export interface MfaStatus {
  currentLevel: "aal1" | "aal2";
  satisfied: boolean;
  enabled: boolean;
  factors: MfaFactorSummary[];
  recoveryCodesLeft: number;
  emailRecovery: MfaEmailRecovery | null;
}

export interface MfaRecoveryCodesResult {
  codes: string[];
  message: string;
}

export interface MfaEmailRecoveryResult {
  state: "awaiting_email" | "scheduled";
  availableAt: string | null;
  message: string;
}

/** A failed MFA route call. `availableAt` comes from 409 on recovery complete. */
export class MfaRequestError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly availableAt: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    status: number,
    options: { code?: string | null; availableAt?: string | null; retryAfterSeconds?: number | null } = {}
  ) {
    super(message);
    this.name = "MfaRequestError";
    this.status = status;
    this.code = options.code ?? null;
    this.availableAt = options.availableAt ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readRetryAfter(response: Response) {
  const seconds = Number(response.headers.get("Retry-After"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** Turns the route's `{ error }` (or `{ message }`) body into readable text. */
function describeFailure(body: JsonObject, status: number) {
  const message = asString(body.message);
  const error = asString(body.error);

  // Machine codes like "mfa_required" read badly; prefer the message.
  if (message && (!error || /^[a-z_]+$/.test(error))) {
    return message;
  }

  if (error && !/^[a-z_]+$/.test(error)) {
    return error;
  }

  if (status === 429) {
    return "Too many tries. Please wait a little and try again.";
  }

  return "Something went wrong. Please try again.";
}

async function mfaFetch(path: string, init: RequestInit = {}): Promise<JsonObject> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: init.body ? { "Content-Type": "application/json", ...init.headers } : init.headers,
  });
  const body = asObject(await response.json().catch(() => null));

  if (!response.ok) {
    const error = asString(body.error);
    throw new MfaRequestError(describeFailure(body, response.status), response.status, {
      code: error && /^[a-z_]+$/.test(error) ? error : null,
      availableAt: asString(body.availableAt),
      retryAfterSeconds: readRetryAfter(response),
    });
  }

  return body;
}

function parseEmailRecovery(value: unknown): MfaEmailRecovery | null {
  const recovery = asObject(value);
  const availableAt = asString(recovery.availableAt);
  const expiresAt = asString(recovery.expiresAt);

  if (recovery.state === "scheduled" && availableAt) {
    return { state: "scheduled", availableAt };
  }

  if (recovery.state === "awaiting_email" && expiresAt) {
    return { state: "awaiting_email", expiresAt };
  }

  return null;
}

export function parseMfaStatus(value: unknown): MfaStatus {
  const body = asObject(value);
  const factors = Array.isArray(body.factors) ? body.factors : [];

  return {
    currentLevel: body.currentLevel === "aal2" ? "aal2" : "aal1",
    satisfied: body.satisfied === true,
    enabled: body.enabled === true,
    factors: factors.flatMap((entry) => {
      const factor = asObject(entry);
      const id = asString(factor.id);

      return id
        ? [{ id, friendlyName: asString(factor.friendlyName), createdAt: asString(factor.createdAt) ?? "" }]
        : [];
    }),
    recoveryCodesLeft: typeof body.recoveryCodesLeft === "number" ? body.recoveryCodesLeft : 0,
    emailRecovery: parseEmailRecovery(body.emailRecovery),
  };
}

export async function fetchMfaStatus(): Promise<MfaStatus> {
  return parseMfaStatus(await mfaFetch("/api/auth/mfa/status"));
}

/** Creates 10 new backup codes (replacing any old ones). Show them once. */
export async function generateRecoveryCodes(): Promise<MfaRecoveryCodesResult> {
  const body = await mfaFetch("/api/auth/mfa/recovery-codes", { method: "POST" });
  const codes = Array.isArray(body.codes) ? body.codes.filter((code): code is string => typeof code === "string") : [];

  if (codes.length === 0) {
    throw new MfaRequestError("No backup codes came back. Please try again.", 500);
  }

  return { codes, message: asString(body.message) ?? "" };
}

/** Redeems a backup code. On success 2FA is OFF for the account. */
export async function redeemRecoveryCode(code: string): Promise<string> {
  const body = await mfaFetch("/api/auth/mfa/recovery-codes/redeem", {
    method: "POST",
    body: JSON.stringify({ code: normalizeRecoveryCode(code) }),
  });

  return asString(body.message) ?? "Two-factor authentication was turned off.";
}

export async function requestEmailRecovery(): Promise<MfaEmailRecoveryResult> {
  const body = await mfaFetch("/api/auth/mfa/email-recovery", { method: "POST" });

  return {
    state: body.state === "scheduled" ? "scheduled" : "awaiting_email",
    availableAt: asString(body.availableAt),
    message: asString(body.message) ?? "Check your email for a recovery link.",
  };
}

export async function completeEmailRecovery(): Promise<string> {
  const body = await mfaFetch("/api/auth/mfa/email-recovery/complete", { method: "POST" });
  return asString(body.message) ?? "Two-factor authentication was turned off.";
}

export async function cancelEmailRecovery(): Promise<string> {
  const body = await mfaFetch("/api/auth/mfa/email-recovery", { method: "DELETE" });
  return asString(body.message) ?? "Recovery canceled.";
}

/** `abcde-12345`, `ABCDE 12345` and `abcde12345` all become `ABCDE-12345`. */
export function normalizeRecoveryCode(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.length === 10 ? `${compact.slice(0, 5)}-${compact.slice(5)}` : compact;
}

export function isCompleteRecoveryCode(value: string) {
  return /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(normalizeRecoveryCode(value));
}

/** Keeps digits only, max 6. */
export function sanitizeTotpInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

/**
 * Same-origin path only: must start with "/" and not "//" or "/\". Never sends
 * the user back to the verify page itself. Defaults to the dashboard.
 */
export function getSafeMfaRedirect(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return DEFAULT_MFA_REDIRECT;
  }

  try {
    const parsed = new URL(value, "http://buck.local");

    if (parsed.origin !== "http://buck.local" || parsed.pathname === MFA_VERIFY_PATH) {
      return DEFAULT_MFA_REDIRECT;
    }

    return parsed.pathname + parsed.search;
  } catch {
    return DEFAULT_MFA_REDIRECT;
  }
}

/** True for a Buck API 401 `mfa_required` or a Buck_AI `X-Buck-Error`. */
export async function isMfaRequiredResponse(response: Response) {
  if (response.headers.get("X-Buck-Error") === "mfa_required") {
    return true;
  }

  if (response.status !== 401) {
    return false;
  }

  const body = asObject(await response.clone().json().catch(() => null));
  return body.error === "mfa_required";
}

/** Path to the verify page that returns the user to where they are now. */
export function currentPageMfaVerifyPath() {
  return createMfaVerifyPath(window.location.pathname + window.location.search);
}

export function describeAuthError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  const message = asString(asObject(error).message);
  return message || fallback;
}
