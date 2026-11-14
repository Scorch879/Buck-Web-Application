import { expect, test, type APIResponse } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/",
  "/sign-in",
  "/create-account",
  "/forgot-password",
  "/check-email",
  "/privacy",
  "/terms",
  "/design-preview",
] as const;

const AUTH_NO_STORE_ROUTES = [
  "/sign-in",
  "/create-account",
  "/forgot-password",
] as const;

const DASHBOARD_ROUTE_PATHS = [
  "/dashboard/home",
  "/dashboard/expenses",
  "/dashboard/wallet",
  "/dashboard/categories",
  "/dashboard/financial-advisor",
  "/dashboard/forecast",
  "/dashboard/statistics",
  "/dashboard/goals",
  "/dashboard/settings",
  "/dashboard/admin",
] as const;

async function expectJsonResponse(response: APIResponse) {
  const contentType = response.headers()["content-type"] ?? "";
  expect(contentType).toContain("application/json");
  const raw = await response.text();
  expect(() => JSON.parse(raw)).not.toThrow();
  return JSON.parse(raw) as Record<string, unknown>;
}

test.describe("Public & Protected Route Responses (F9)", () => {
  test("public routes return 200 with security headers and zero runtime errors", async ({
    page,
  }) => {
    for (const route of PUBLIC_ROUTES) {
      const pageErrors: string[] = [];
      const serverErrors: string[] = [];
      const onPageError = (err: Error) => pageErrors.push(err.message);
      const onResponse = (res: { status: () => number; url: () => string }) => {
        if (res.status() >= 500) {
          serverErrors.push(`${res.status()} ${res.url()}`);
        }
      };

      page.on("pageerror", onPageError);
      page.on("response", onResponse);

      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response, `Expected response for ${route}`).not.toBeNull();
      expect(response!.status(), `Expected HTTP 200 on ${route}`).toBe(200);

      const headers = response!.headers();
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["x-powered-by"]).toBeUndefined();
      expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(headers["content-security-policy"]).toContain("object-src 'none'");

      if ((AUTH_NO_STORE_ROUTES as readonly string[]).includes(route)) {
        expect(headers["cache-control"]).toContain("no-store");
      }

      await expect(page.locator("h1").first()).toBeVisible();
      expect(pageErrors, `Unexpected pageerrors on ${route}`).toEqual([]);
      expect(serverErrors, `Unexpected 5xx responses on ${route}`).toEqual([]);

      page.off("pageerror", onPageError);
      page.off("response", onResponse);
    }
  });

  test("unmapped legacy paths and unauthenticated recovery endpoints never 500", async ({
    request,
  }) => {
    for (const legacyPath of ["/login", "/signup", "/reactivate"]) {
      const res = await request.get(legacyPath, { maxRedirects: 0 });
      expect(res.status(), `${legacyPath} should return clean 404`).toBe(404);
      expect(res.status()).toBeLessThan(500);
    }

    const deleteConfirm = await request.get("/account/delete/confirm", {
      maxRedirects: 0,
    });
    expect([307, 308]).toContain(deleteConfirm.status());
    expect(deleteConfirm.headers()["location"]).toContain("/sign-in");

    const mfaRecoverConfirm = await request.get("/account/mfa/recover/confirm", {
      maxRedirects: 0,
    });
    expect([307, 308]).toContain(mfaRecoverConfirm.status());
    expect(mfaRecoverConfirm.headers()["location"]).toContain(
      "/verify-2fa?emailRecovery=invalid-link"
    );
  });

  test("all 10 dashboard routes and MFA/OAuth gates redirect unauthenticated traffic cleanly", async ({
    request,
  }) => {
    const protectedRoutes = [
      ...DASHBOARD_ROUTE_PATHS,
      "/verify-2fa",
      "/oauth/consent",
    ];

    for (const route of protectedRoutes) {
      const res = await request.get(route, { maxRedirects: 0 });
      expect(res.status(), `Expected 307 redirect on ${route}`).toBe(307);

      const location = res.headers()["location"] ?? "";
      expect(location, `Expected redirect to /sign-in for ${route}`).toContain(
        "/sign-in"
      );

      if (!location.includes("error=")) {
        expect(location).toContain(`redirectTo=${encodeURIComponent(route)}`);
      }

      expect(res.headers()["cache-control"]).toBe("no-store, max-age=0");
      expect(res.headers()["content-security-policy"]).toContain(
        "frame-ancestors 'none'"
      );
    }
  });

  test("browser navigation to protected dashboard routes lands cleanly on sign-in", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/dashboard/expenses", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.locator("#sign-in-story-title")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    await page.goto("/dashboard/wallet", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/sign-in/);
    expect(pageErrors).toEqual([]);
  });
});

test.describe("API Boundary Health & Unauthorized Guards (F9)", () => {
  test("POST /api/forecast enforces session auth and returns no-store JSON 401", async ({
    request,
  }) => {
    const res = await request.post("/api/forecast", {
      data: { periodType: "monthly", forceRefresh: true },
    });
    expect(res.status()).toBe(401);
    expect(res.headers()["cache-control"]).toContain("no-store");
    const body = await expectJsonResponse(res);
    expect(body.error).toBe("You need to sign in again first.");

    const malformed = await request.post("/api/forecast", {
      headers: { "content-type": "application/json" },
      data: "{invalid-json",
    });
    expect(malformed.status()).toBe(401);
    const malformedBody = await expectJsonResponse(malformed);
    expect(typeof malformedBody.error).toBe("string");
  });

  test("admin API routes reject unauthenticated requests with clean JSON boundaries", async ({
    request,
  }) => {
    const getEndpoints = [
      "/api/admin/overview",
      "/api/admin/supabase",
      "/api/admin/vercel",
    ];

    for (const endpoint of getEndpoints) {
      const res = await request.get(endpoint);
      const body = await expectJsonResponse(res);
      expect([403, 500]).toContain(res.status());
      expect(typeof body.error).toBe("string");
      expect((body.error as string).length).toBeGreaterThan(0);

      if (res.status() === 403) {
        expect(body.error).toBe("Unauthorized access");
      }
    }

    const mfaResetRes = await request.post(
      "/api/admin/users/00000000-0000-0000-0000-000000000000/mfa/reset"
    );
    const mfaResetBody = await expectJsonResponse(mfaResetRes);
    expect([403, 500]).toContain(mfaResetRes.status());
    expect(typeof mfaResetBody.error).toBe("string");
  });

  test("cron, deletion, MFA status, password-reset, and MCP boundaries return clean JSON errors", async ({
    request,
  }) => {
    const cronRes = await request.post("/api/cron/generate-insights");
    expect(cronRes.status()).toBe(401);
    const cronBody = await expectJsonResponse(cronRes);
    expect(cronBody.error).toBe("Unauthorized cron trigger.");

    const purgeRes = await request.post("/api/account/deletion/purge");
    expect(purgeRes.status()).toBe(401);
    const purgeBody = await expectJsonResponse(purgeRes);
    expect(purgeBody).toEqual({ success: false, message: "Not authorized." });

    const mfaStatusRes = await request.get("/api/auth/mfa/status");
    const mfaStatusBody = await expectJsonResponse(mfaStatusRes);
    expect([401, 500]).toContain(mfaStatusRes.status());
    expect(typeof mfaStatusBody.error).toBe("string");

    const recoverRes = await request.post("/api/account/deletion/recover");
    const recoverBody = await expectJsonResponse(recoverRes);
    expect([401, 500]).toContain(recoverRes.status());
    expect(recoverBody.success).toBe(false);
    expect(typeof recoverBody.message).toBe("string");

    const resetInvalidRes = await request.post("/api/auth/password-reset", {
      data: { email: "invalid-email" },
    });
    const resetInvalidBody = await expectJsonResponse(resetInvalidRes);
    expect([400, 500]).toContain(resetInvalidRes.status());
    expect(resetInvalidBody.success).toBe(false);
    expect(typeof resetInvalidBody.message).toBe("string");

    const mcpRes = await request.post("/api/mcp", {
      data: { jsonrpc: "2.0", id: 1, method: "initialize" },
    });
    expect([401, 503]).toContain(mcpRes.status());
    if (mcpRes.status() === 401) {
      expect(mcpRes.headers()["www-authenticate"]).toContain(
        "/.well-known/oauth-protected-resource/api/mcp"
      );
    }

    const wellKnownRes = await request.get(
      "/.well-known/oauth-protected-resource/api/mcp"
    );
    const wellKnownBody = await expectJsonResponse(wellKnownRes);
    expect([200, 404]).toContain(wellKnownRes.status());
    if (wellKnownRes.status() === 200) {
      expect(wellKnownBody.resource).toContain("/api/mcp");
      expect(Array.isArray(wellKnownBody.authorization_servers)).toBe(true);
    }
  });
});

test.describe("Navigation Flows & Responsive Layout Integrity", () => {
  test("design-preview lists core Buck routes and links cleanly across auth and legal pages", async ({
    page,
  }) => {
    await page.goto("/design-preview", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Review Buck screens/i })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Sign In/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Create Account/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Forgot Password/i })).toBeVisible();

    await page.getByRole("link", { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.locator("#sign-in-story-title")).toBeVisible();

    await page.goto("/privacy", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toBeVisible();
    await page.getByRole("link", { name: /Read Terms/i }).click();
    await expect(page).toHaveURL(/\/terms/);
    await page.getByRole("link", { name: /Read Privacy/i }).click();
    await expect(page).toHaveURL(/\/privacy/);
  });

  test("public pages maintain zero horizontal overflow on desktop and mobile viewports", async ({
    page,
  }) => {
    const viewports = [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ];
    const routesToCheck = [
      "/",
      "/sign-in",
      "/create-account",
      "/forgot-password",
      "/privacy",
      "/terms",
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const route of routesToCheck) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        const hasOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1
        );
        expect(
          hasOverflow,
          `Horizontal overflow detected on ${route} at ${viewport.width}x${viewport.height}`
        ).toBe(false);
      }
    }
  });
});
