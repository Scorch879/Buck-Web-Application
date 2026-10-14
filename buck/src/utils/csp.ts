/**
 * Content-Security-Policy with a per-request nonce (middleware sets it, the
 * root layout stamps it on the inline theme script, Next stamps its own).
 * 'strict-dynamic' lets nonce-trusted scripts load their chunks; the host
 * allow-list below is only a fallback for old browsers.
 */

function toOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

export function buildCsp(
  nonce: string,
  options: {
    isDev?: boolean;
    supabaseUrl?: string;
    aiBackendUrl?: string;
  } = {}
) {
  const supabaseOrigin = toOrigin(options.supabaseUrl);
  const aiOrigin = toOrigin(options.aiBackendUrl);
  const connect = ["'self'"];

  if (supabaseOrigin) {
    connect.push(supabaseOrigin, supabaseOrigin.replace(/^http/, "ws"));
  }
  if (aiOrigin) connect.push(aiOrigin);

  const img = ["'self'", "data:", "blob:"];
  if (supabaseOrigin) img.push(supabaseOrigin);

  const script = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // React's dev tooling evals; never in production.
    ...(options.isDev ? ["'unsafe-eval'"] : []),
  ];

  return [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    // Framer Motion and React inline style attributes need this; scripts stay strict.
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "media-src 'self' blob: data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
