import { describe, expect, it } from "vitest";
import {
  appLogoPath,
  describeScope,
  getAppInitial,
  getWebsiteHost,
  isBuckLookalike,
  isLoopbackHost,
  isUnreviewedApp,
  toAppLogoSrc,
  toSafeHttpUrl,
} from "./connectedApps";

describe("describeScope", () => {
  it("maps the standard scopes to plain words", () => {
    expect(describeScope("openid")).toBe("Confirm who you are");
    expect(describeScope("email")).toBe("See your email address");
    expect(describeScope("profile")).toBe("See your username and avatar");
    expect(describeScope("phone")).toBe("See your phone number");
  });

  it("shows any other scope as it is", () => {
    expect(describeScope("offline_access")).toBe("offline_access");
  });
});

describe("isLoopbackHost", () => {
  it.each(["localhost", "localhost:3334", "127.0.0.1", "127.0.0.1:53682", "[::1]", "[::1]:8080", "LOCALHOST:1"])(
    "treats %s as this computer",
    (host) => {
      expect(isLoopbackHost(host)).toBe(true);
    }
  );

  it.each(["", "example.com", "localhost.example.com", "127.0.0.1.evil.com", "buck.app:443"])(
    "does not treat %s as this computer",
    (host) => {
      expect(isLoopbackHost(host)).toBe(false);
    }
  );
});

describe("app review warnings", () => {
  it("only trusts apps the Buck team registered", () => {
    expect(isUnreviewedApp("manual")).toBe(false);
    expect(isUnreviewedApp("dynamic")).toBe(true);
    expect(isUnreviewedApp("unknown")).toBe(true);
  });

  it("flags self-registered apps that call themselves Buck", () => {
    expect(isBuckLookalike("Buck Helper", "dynamic")).toBe(true);
    expect(isBuckLookalike("my bUCK sync", "unknown")).toBe(true);
    expect(isBuckLookalike("Buck Mobile", "manual")).toBe(false);
    expect(isBuckLookalike("Claude Desktop", "dynamic")).toBe(false);
  });
});

describe("display helpers", () => {
  it("picks an uppercase initial", () => {
    expect(getAppInitial("  cursor")).toBe("C");
    expect(getAppInitial("")).toBe("?");
  });

  it("reads the website host", () => {
    expect(getWebsiteHost("https://claude.ai/download")).toBe("claude.ai");
    expect(getWebsiteHost("not a url")).toBeNull();
    expect(getWebsiteHost(null)).toBeNull();
  });

  it("only allows http(s) links", () => {
    expect(toSafeHttpUrl("https://example.com/logo.png")).toBe("https://example.com/logo.png");
    expect(toSafeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(toSafeHttpUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(toSafeHttpUrl("")).toBeNull();
  });
});

describe("app logo proxy (ADR-051)", () => {
  const CLIENT_ID = "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d";

  it("points at Buck's proxy only when the app has a logo", () => {
    expect(appLogoPath(CLIENT_ID, "https://cdn.app.test/logo.png")).toBe(
      `/api/oauth/app-logo?client_id=${CLIENT_ID}`
    );
    expect(appLogoPath(CLIENT_ID, " ")).toBeNull();
    expect(appLogoPath(CLIENT_ID, null)).toBeNull();
  });

  it("renders only the proxy path, never an app's own URL", () => {
    expect(toAppLogoSrc(`/api/oauth/app-logo?client_id=${CLIENT_ID}`)).toBe(
      `/api/oauth/app-logo?client_id=${CLIENT_ID}`
    );
    expect(toAppLogoSrc("https://tracker.test/pixel.png")).toBeNull();
    expect(toAppLogoSrc("//tracker.test/api/oauth/app-logo?client_id=" + CLIENT_ID)).toBeNull();
    expect(toAppLogoSrc(`/api/oauth/app-logo?client_id=${CLIENT_ID}&x=1`)).toBeNull();
    expect(toAppLogoSrc(null)).toBeNull();
  });
});
