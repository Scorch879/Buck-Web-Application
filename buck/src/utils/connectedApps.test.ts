import { describe, expect, it } from "vitest";
import {
  describeScope,
  getAppInitial,
  getWebsiteHost,
  isBuckLookalike,
  isLoopbackHost,
  isUnreviewedApp,
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
