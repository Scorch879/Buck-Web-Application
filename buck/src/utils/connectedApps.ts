/**
 * Connected apps (ADR-049): display helpers shared by the consent page and the
 * Settings › Connected apps list. Pure functions only, so they can be tested.
 */

const SCOPE_LABELS: Record<string, string> = {
  openid: "Confirm who you are",
  email: "See your email address",
  profile: "See your username and avatar",
  phone: "See your phone number",
};

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Plain-words label for an OAuth scope; unknown scopes are shown as they are. */
export function describeScope(scope: string) {
  return SCOPE_LABELS[scope] ?? scope;
}

/** True for `localhost`, `127.0.0.1` or `[::1]`, with or without a port. */
export function isLoopbackHost(host: string) {
  const value = host.trim().toLowerCase();

  if (!value) {
    return false;
  }

  try {
    return LOOPBACK_HOSTNAMES.has(new URL(`http://${value}`).hostname);
  } catch {
    return false;
  }
}

/**
 * Apps Buck has not reviewed: self-registered ("dynamic") or unknown because
 * the lookup failed. Only "manual" apps were registered by the Buck team.
 */
export function isUnreviewedApp(registration: string) {
  return registration !== "manual";
}

/** An unreviewed app that calls itself "Buck…": the main phishing risk. */
export function isBuckLookalike(name: string, registration: string) {
  return isUnreviewedApp(registration) && /buck/i.test(name);
}

/** First letter for the logo fallback. */
export function getAppInitial(name: string) {
  const letter = Array.from(name.trim())[0];
  return letter ? letter.toUpperCase() : "?";
}

/** Host of the app's website, or null when there is none or it isn't a URL. */
export function getWebsiteHost(website: string | null | undefined) {
  if (!website?.trim()) {
    return null;
  }

  try {
    return new URL(website.trim()).host || null;
  } catch {
    return null;
  }
}

/** Only http(s) links are safe to render as `href` or `src`. */
export function toSafeHttpUrl(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
