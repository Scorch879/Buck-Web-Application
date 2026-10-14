import type { NextConfig } from "next";
import path from "node:path";

const securityHeaders = [
  // The Content-Security-Policy (with its per-request nonce) is set in middleware.ts.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Lets a second dev server run beside the main one without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingRoot: path.resolve(__dirname),
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
