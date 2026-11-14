import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { Plugin, ViteDevServer } from "vite";
import {
  DASHBOARD_ROUTES,
  findDashboardRoute,
  getDashboardDisplayName,
  getDashboardPageChrome,
  getDashboardSkeletonVariant,
} from "../src/utils/dashboardRoutes";

const EXPECTED_ROUTE_TABLE = [
  { id: "home", label: "Home", href: "/dashboard/home", skeletonVariant: "home", adminOnly: false },
  { id: "expenses", label: "Expenses", href: "/dashboard/expenses", skeletonVariant: "expenses", adminOnly: false },
  { id: "wallet", label: "Wallet", href: "/dashboard/wallet", skeletonVariant: "wallet", adminOnly: false },
  { id: "categories", label: "Categories", href: "/dashboard/categories", skeletonVariant: "categories", adminOnly: false },
  { id: "advisor", label: "Financial Advisor", href: "/dashboard/financial-advisor", skeletonVariant: "financial-advisor", adminOnly: false },
  { id: "forecast", label: "Forecast", href: "/dashboard/forecast", skeletonVariant: "forecast", adminOnly: false },
  { id: "statistics", label: "Statistics", href: "/dashboard/statistics", skeletonVariant: "statistics", adminOnly: false },
  { id: "goals", label: "Goals", href: "/dashboard/goals", skeletonVariant: "goals", adminOnly: false },
  { id: "admin", label: "Admin", href: "/dashboard/admin", skeletonVariant: "admin", adminOnly: true },
  { id: "settings", label: "Settings", href: "/dashboard/settings", skeletonVariant: "settings", adminOnly: false },
] as const;

type FrameSample = {
  t: number;
  railWidth: number;
  collapseVar: number;
  trayHeight: number;
  navHeights: number[];
  animating: boolean;
  collapsedClass: boolean;
};

type SidebarMetrics = {
  railWidth: number;
  collapseVar: number;
  trayHeight: number;
  trayTop: number;
  traySignOutCount: number;
  trayCollapseCount: number;
  navCount: number;
  navHeights: number[];
  navLabelCount: number;
  brandCopyCount: number;
  accountCopyCount: number;
  collapsedClass: boolean;
  animatingClass: boolean;
  htmlSidebarAttr: string | null;
  iconCenterOffsets: number[];
  clippedIcons: number;
  wrappedLabels: number;
};

const BUCK_ROOT = path.resolve(__dirname, "..");

const HARNESS_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Buck Sidebar E2E Harness</title>
    <script>
      (() => {
        try {
          const savedTheme = window.localStorage.getItem("buck-landing-theme");
          const theme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : "light";
          const root = document.documentElement;
          root.dataset.buckTheme = theme;
          root.classList.toggle("buck-theme-dark", theme === "dark");
          root.classList.toggle("buck-theme-light", theme === "light");
          root.dataset.buckSidebar =
            window.localStorage.getItem("buck:sidebar-collapsed") === "true" ? "collapsed" : "expanded";
        } catch {
          document.documentElement.dataset.buckTheme = "light";
          document.documentElement.dataset.buckSidebar = "expanded";
        }
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/harness-entry.tsx"></script>
  </body>
</html>`;

const NEXT_IMAGE_STUB = `import React from "react";

export default function Image({
  priority: _priority,
  fill: _fill,
  blurDataURL: _blurDataURL,
  placeholder: _placeholder,
  loader: _loader,
  unoptimized: _unoptimized,
  quality: _quality,
  alt = "",
  ...rest
}) {
  return React.createElement("img", { alt, ...rest });
}
`;

const NEXT_NAVIGATION_STUB = `import { useEffect, useState } from "react";

const listeners = new Set();

function getInitialPath() {
  const params = new URLSearchParams(window.location.search);
  return params.get("path") || "/dashboard/home";
}

let currentPath = typeof window !== "undefined" ? getInitialPath() : "/dashboard/home";

function setPath(nextPath) {
  currentPath = nextPath;
  if (typeof window !== "undefined") {
    window.__buckNavigations = window.__buckNavigations || [];
    window.__buckNavigations.push(nextPath);
  }
  listeners.forEach((listener) => listener(currentPath));
}

export function usePathname() {
  const [pathname, setPathname] = useState(currentPath);

  useEffect(() => {
    listeners.add(setPathname);
    setPathname(currentPath);
    return () => {
      listeners.delete(setPathname);
    };
  }, []);

  return pathname;
}

export function useRouter() {
  return {
    push(href) {
      setPath(href);
    },
    replace(href) {
      setPath(href);
    },
    prefetch(href) {
      if (typeof window !== "undefined") {
        window.__buckPrefetched = window.__buckPrefetched || [];
        if (!window.__buckPrefetched.includes(href)) {
          window.__buckPrefetched.push(href);
        }
      }
    },
    back() {},
    forward() {},
    refresh() {},
  };
}
`;

const SIDEBAR_HARNESS_ENTRY = `import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "@/app/globals.css";
import DashboardHeader from "@/component/dashboardheader";
import MotionProvider from "@/component/MotionProvider";
import { ToastProvider } from "@/component/toast/ToastContext";
import { DashboardUserProvider } from "@/context/DashboardUserContext";
import { FinancialContext } from "@/context/FinancialContext";

const params = new URLSearchParams(window.location.search);
const isAdmin = params.get("admin") === "1";
const now = new Date().toISOString();

const mockUser = {
  id: "e2e-sidebar-user",
  uid: "e2e-sidebar-user",
  app_metadata: {},
  aud: "authenticated",
  confirmed_at: now,
  created_at: now,
  displayName: "Buck Tester",
  email: "tester@buck.local",
  authProviders: ["email"],
  identities: [],
  isGoogleOnlyUser: false,
  isAdmin,
  isPasswordUser: true,
  role: "authenticated",
  updated_at: now,
  user_metadata: {
    full_name: "Buck Tester",
    username: "Buck Tester",
  },
};

function HarnessApp() {
  const [dashboardCache, setDashboardCache] = useState({
    userId: mockUser.uid,
    profile: {
      id: mockUser.uid,
      username: "Buck Tester",
      email: "tester@buck.local",
      avatar_url: null,
      updated_at: now,
    },
    activeWalletBudget: 12500,
  });

  const financialValue = useMemo(
    () => ({
      dashboardCache,
      setDashboardCache,
      tableErrors: {},
      refreshTable: async () => {},
    }),
    [dashboardCache]
  );

  return (
    <MotionProvider>
      <ToastProvider>
        <FinancialContext.Provider value={financialValue}>
          <DashboardUserProvider user={mockUser}>
            <div className="dashboard">
              <DashboardHeader />
              <main className="dashboard-main">
                <div style={{ padding: "24px" }}>
                  <h1>Sidebar Motion Harness</h1>
                </div>
              </main>
            </div>
          </DashboardUserProvider>
        </FinancialContext.Provider>
      </ToastProvider>
    </MotionProvider>
  );
}

createRoot(document.getElementById("root")).render(<HarnessApp />);
`;

function createSidebarHarnessPlugin(
  transformWithOxc: typeof import("vite").transformWithOxc
): Plugin {
  const virtualEntries: Record<string, { resolvedId: string; code: string }> = {
    "/harness-entry.tsx": {
      resolvedId: "\0virtual:harness-entry.tsx",
      code: SIDEBAR_HARNESS_ENTRY,
    },
    "next/image": {
      resolvedId: "\0virtual:next-image.tsx",
      code: NEXT_IMAGE_STUB,
    },
    "next/navigation": {
      resolvedId: "\0virtual:next-navigation.tsx",
      code: NEXT_NAVIGATION_STUB,
    },
  };

  return {
    name: "buck-sidebar-e2e-harness",
    enforce: "pre",
    resolveId(id) {
      return virtualEntries[id]?.resolvedId ?? null;
    },
    load(id) {
      for (const entry of Object.values(virtualEntries)) {
        if (id === entry.resolvedId) {
          return entry.code;
        }
      }
      return null;
    },
    async transform(code, id) {
      const cleanId = id.split("?")[0];
      if (!/\.(tsx?|jsx)$/.test(cleanId) || cleanId.includes("node_modules")) {
        return null;
      }
      const res = await transformWithOxc(code, cleanId, {
        jsx: { runtime: "automatic" },
        tsconfig: false,
      });
      return {
        code: res.code,
        map: res.map ?? null,
      };
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/harness.html" && url !== "/") {
          next();
          return;
        }
        const transformed = await server.transformIndexHtml(req.url || "/harness.html", HARNESS_HTML);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(transformed);
      });
    },
  };
}

async function readSidebarMetrics(page: Page): Promise<SidebarMetrics> {
  return page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".dashboard-header");
    const tray = document.querySelector<HTMLElement>(".dashboard-header-actions .dashboard-account-tray");
    const navButtons = Array.from(document.querySelectorAll<HTMLElement>(".dashboard-nav .nav-button"));
    const navIcons = Array.from(document.querySelectorAll<HTMLElement>(".dashboard-nav .nav-button-icon"));
    const navLabels = Array.from(document.querySelectorAll<HTMLElement>(".dashboard-nav .nav-button-label"));

    if (!header || !tray) {
      throw new Error("Missing .dashboard-header or .dashboard-account-tray in DOM");
    }

    const headerBox = header.getBoundingClientRect();
    const trayBox = tray.getBoundingClientRect();
    const collapseRaw = getComputedStyle(header).getPropertyValue("--buck-collapse").trim();
    const collapseVar = collapseRaw === "" ? 0 : Number.parseFloat(collapseRaw);

    let clippedIcons = 0;
    const iconCenterOffsets = navIcons.map((icon) => {
      const box = icon.getBoundingClientRect();
      if (box.left < headerBox.left - 0.5 || box.right > headerBox.right + 0.5) {
        clippedIcons += 1;
      }
      const railInnerCenter = headerBox.left + (headerBox.width - 1) / 2;
      return Math.abs(box.left + box.width / 2 - railInnerCenter);
    });

    let wrappedLabels = 0;
    for (const label of navLabels) {
      if (label.scrollHeight > label.clientHeight + 2) {
        wrappedLabels += 1;
      }
    }

    return {
      railWidth: headerBox.width,
      collapseVar,
      trayHeight: trayBox.height,
      trayTop: trayBox.top,
      traySignOutCount: document.querySelectorAll(".dashboard-header-actions .dashboard-tray-btn--signout").length,
      trayCollapseCount: document.querySelectorAll(".dashboard-header-actions .dashboard-tray-btn--collapse").length,
      navCount: navButtons.length,
      navHeights: navButtons.map((button) => button.getBoundingClientRect().height),
      navLabelCount: navLabels.length,
      brandCopyCount: document.querySelectorAll(".dashboard-brand-copy").length,
      accountCopyCount: document.querySelectorAll(".dashboard-header-actions .dashboard-account-copy").length,
      collapsedClass: header.classList.contains("dashboard-header--collapsed"),
      animatingClass: header.classList.contains("dashboard-header--animating"),
      htmlSidebarAttr: document.documentElement.dataset.buckSidebar ?? null,
      iconCenterOffsets,
      clippedIcons,
      wrappedLabels,
    };
  });
}

async function sampleToggleMotion(page: Page, targetCollapse: number, durationMs = 650): Promise<FrameSample[]> {
  return page.evaluate(
    ({ target, maxMs }) =>
      new Promise<FrameSample[]>((resolve) => {
        const header = document.querySelector<HTMLElement>(".dashboard-header");
        const tray = document.querySelector<HTMLElement>(".dashboard-header-actions .dashboard-account-tray");
        const toggleButton = document.querySelector<HTMLButtonElement>(".dashboard-tray-btn--collapse");

        if (!header || !tray || !toggleButton) {
          throw new Error("Missing sidebar controls for motion sampling");
        }

        const samples: FrameSample[] = [];
        const startedAt = performance.now();
        let settledFrames = 0;

        const capture = () => {
          const headerBox = header.getBoundingClientRect();
          const trayBox = tray.getBoundingClientRect();
          const navButtons = Array.from(document.querySelectorAll<HTMLElement>(".dashboard-nav .nav-button"));
          const collapseRaw = getComputedStyle(header).getPropertyValue("--buck-collapse").trim();
          const collapseVar = collapseRaw === "" ? 0 : Number.parseFloat(collapseRaw);
          const animating = header.classList.contains("dashboard-header--animating");

          samples.push({
            t: performance.now() - startedAt,
            railWidth: headerBox.width,
            collapseVar,
            trayHeight: trayBox.height,
            navHeights: navButtons.map((button) => button.getBoundingClientRect().height),
            animating,
            collapsedClass: header.classList.contains("dashboard-header--collapsed"),
          });

          const expectedWidth = target === 1 ? 80 : 250;
          const isSettled =
            !animating &&
            Math.abs(headerBox.width - expectedWidth) < 0.25 &&
            Math.abs(collapseVar - target) < 0.01;

          if (isSettled) {
            settledFrames += 1;
          } else {
            settledFrames = 0;
          }

          if (settledFrames >= 2 || performance.now() - startedAt >= maxMs) {
            resolve(samples);
            return;
          }

          requestAnimationFrame(capture);
        };

        toggleButton.click();
        requestAnimationFrame(capture);
      }),
    { target: targetCollapse, maxMs: durationMs }
  );
}

test.describe("Route Table & Unauthenticated Middleware Protection (F5)", () => {
  test("DASHBOARD_ROUTES and helpers cover all 10 routes with clean fallbacks", () => {
    expect(DASHBOARD_ROUTES).toHaveLength(10);

    expect(
      DASHBOARD_ROUTES.map((route) => ({
        id: route.id,
        label: route.label,
        href: route.href,
        skeletonVariant: route.skeletonVariant,
        adminOnly: Boolean(route.adminOnly),
      }))
    ).toEqual([...EXPECTED_ROUTE_TABLE]);

    for (const route of EXPECTED_ROUTE_TABLE) {
      expect(findDashboardRoute(route.href).id).toBe(route.id);
      expect(findDashboardRoute(`${route.href}?tab=overview`).id).toBe(route.id);
      expect(getDashboardSkeletonVariant(route.href)).toBe(route.skeletonVariant);

      const chrome = getDashboardPageChrome(route.href);
      expect(chrome.title.length).toBeGreaterThan(0);
      expect(chrome.eyebrow.length).toBeGreaterThan(0);
      expect(chrome.description.length).toBeGreaterThan(0);
    }

    expect(findDashboardRoute(null).id).toBe("home");
    expect(findDashboardRoute("/unknown").id).toBe("home");
    expect(getDashboardSkeletonVariant(null)).toBe("home");

    expect(getDashboardDisplayName({ profile: { username: "BuckHero" } }, { displayName: "Fallback", email: "a@b.com" })).toBe("BuckHero");
    expect(getDashboardDisplayName({}, { displayName: "Display User", email: "a@b.com" })).toBe("Display User");
    expect(getDashboardDisplayName({}, { displayName: null, email: "alex@buck.local" })).toBe("alex");
    expect(getDashboardDisplayName({}, null)).toBe("Buck user");
  });

  test("unauthenticated requests to all /dashboard/* routes redirect cleanly to /sign-in with no-store and CSP headers", async ({
    request,
  }) => {
    for (const route of EXPECTED_ROUTE_TABLE) {
      const response = await request.get(route.href, { maxRedirects: 0 });
      expect(response.status(), `${route.href} should redirect without a session`).toBeGreaterThanOrEqual(300);
      expect(response.status(), `${route.href} should be a 3xx redirect`).toBeLessThan(400);

      const headers = response.headers();
      const location = headers["location"];
      expect(location, `${route.href} should include Location header`).toBeTruthy();

      const redirectUrl = new URL(location, "http://127.0.0.1:3000");
      expect(redirectUrl.pathname).toBe("/sign-in");

      const errorParam = redirectUrl.searchParams.get("error");
      if (!errorParam) {
        expect(redirectUrl.searchParams.get("redirectTo")).toBe(route.href);
      } else {
        expect(["supabase-not-configured", "session-security-not-configured"]).toContain(errorParam);
      }

      expect(headers["cache-control"]).toContain("no-store");
      expect(headers["content-security-policy"]).toBeTruthy();
    }

    const nestedResponse = await request.get("/dashboard/settings?tab=security", { maxRedirects: 0 });
    expect(nestedResponse.status()).toBeGreaterThanOrEqual(300);
    expect(nestedResponse.status()).toBeLessThan(400);
    const nestedLocation = new URL(nestedResponse.headers()["location"], "http://127.0.0.1:3000");
    expect(nestedLocation.pathname).toBe("/sign-in");
    if (!nestedLocation.searchParams.get("error")) {
      expect(nestedLocation.searchParams.get("redirectTo")).toBe("/dashboard/settings?tab=security");
    }
  });

  test("browser navigation to protected dashboard routes lands cleanly on /sign-in without runtime errors", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const sampledRoutes = [
      "/dashboard/home",
      "/dashboard/expenses",
      "/dashboard/financial-advisor",
      "/dashboard/goals",
      "/dashboard/admin",
      "/dashboard/settings",
    ];

    for (const href of sampledRoutes) {
      const response = await page.goto(href, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(/\/sign-in/);
    }

    expect(pageErrors).toEqual([]);
  });
});

test.describe("Desktop Sidebar Collapse/Expand Motion (Priority 1)", () => {
  let viteServer: ViteDevServer | null = null;
  let viteCacheDir = "";
  let harnessBaseUrl = "";

  test.beforeAll(async () => {
    const { createServer, transformWithOxc } = await import("vite");
    viteCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "buck-vite-sidebar-e2e-"));
    const normalizedSrcRoot = path.join(BUCK_ROOT, "src").replaceAll("\\", "/");
    viteServer = await createServer({
      root: BUCK_ROOT,
      publicDir: path.join(BUCK_ROOT, "public"),
      cacheDir: viteCacheDir,
      configFile: false,
      logLevel: "silent",
      server: { host: "127.0.0.1", port: 0, strictPort: false },
      oxc: false,
      resolve: {
        alias: [
          {
            find: /^@\/(.*)/,
            replacement: `${normalizedSrcRoot}/$1`,
          },
        ],
      },
      define: {
        "process.env": JSON.stringify({
          NODE_ENV: "test",
          NEXT_PUBLIC_SUPABASE_URL: "",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
          NEXT_PUBLIC_DESIGN_PREVIEW_MODE: "false",
          NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES: "30",
        }),
      },
      plugins: [createSidebarHarnessPlugin(transformWithOxc)],
    });

    await viteServer.listen();
    const address = viteServer.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to resolve Vite harness port");
    }
    harnessBaseUrl = `http://127.0.0.1:${address.port}`;
  });

  test.afterAll(async () => {
    if (viteServer) {
      await viteServer.close();
      viteServer = null;
    }
    if (viteCacheDir) {
      fs.rmSync(viteCacheDir, { recursive: true, force: true });
      viteCacheDir = "";
    }
  });

  test("navigates across DASHBOARD_ROUTES and respects adminOnly visibility", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${harnessBaseUrl}/harness.html?path=/dashboard/home`, { waitUntil: "networkidle" });

    // Non-admin user sees 9 routes (Admin hidden).
    await expect(page.locator(".dashboard-nav .nav-button")).toHaveCount(9);
    await expect(page.locator(".dashboard-nav .nav-button", { hasText: "Admin" })).toHaveCount(0);
    await expect(page.locator(".dashboard-nav .nav-button.active")).toContainText("Home");

    // Admin user sees all 10 routes.
    await page.goto(`${harnessBaseUrl}/harness.html?path=/dashboard/home&admin=1`, { waitUntil: "networkidle" });
    await expect(page.locator(".dashboard-nav .nav-button")).toHaveCount(10);
    await expect(page.locator(".dashboard-nav .nav-button", { hasText: "Admin" })).toHaveCount(1);

    for (const route of EXPECTED_ROUTE_TABLE) {
      const button = page.locator(".dashboard-nav .nav-button", { hasText: route.label });
      await button.click();
      await expect(button).toHaveClass(/\bactive\b/);
    }

    const navigations = await page.evaluate(
      () => (window as unknown as { __buckNavigations?: string[] }).__buckNavigations ?? []
    );
    // Home is already active initially so clicking Home does not re-push; the other 9 push their hrefs.
    for (const route of EXPECTED_ROUTE_TABLE.filter((item) => item.id !== "home")) {
      expect(navigations).toContain(route.href);
    }

    // Clicking brand button navigates back to /dashboard/home.
    await page.locator(".dashboard-brand").click();
    await expect(page.locator(".dashboard-nav .nav-button", { hasText: "Home" })).toHaveClass(/\bactive\b/);
  });

  test("smoothly animates width (250px <-> 80px), --buck-collapse (0 <-> 1), tray height (62px <-> 100px), and locks nav-button at 40px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${harnessBaseUrl}/harness.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(100);

    const initial = await readSidebarMetrics(page);
    expect(initial.railWidth).toBeCloseTo(250, 0);
    expect(initial.collapseVar).toBeCloseTo(0, 2);
    expect(initial.trayHeight).toBeCloseTo(62, 0);
    expect(initial.traySignOutCount).toBe(0);
    expect(initial.trayCollapseCount).toBe(1);
    expect(initial.collapsedClass).toBe(false);
    expect(initial.navLabelCount).toBe(9);
    expect(initial.brandCopyCount).toBe(1);
    expect(initial.accountCopyCount).toBe(1);
    expect(initial.wrappedLabels).toBe(0);
    for (const height of initial.navHeights) {
      expect(height).toBeCloseTo(40, 0);
    }

    const collapseBtn = page.locator(".dashboard-header-actions .dashboard-tray-btn--collapse");
    await expect(collapseBtn).toHaveAttribute("aria-expanded", "true");
    await expect(collapseBtn).toHaveAttribute("aria-label", "Collapse sidebar");

    // Sample rAF frames during collapse (250px -> 80px).
    const collapseFrames = await sampleToggleMotion(page, 1);
    const intermediateCollapseFrames = collapseFrames.filter(
      (frame) => frame.railWidth < 248 && frame.railWidth > 82
    );
    expect(intermediateCollapseFrames.length).toBeGreaterThan(0);

    for (const frame of collapseFrames) {
      for (const navHeight of frame.navHeights) {
        expect(navHeight).toBeCloseTo(40, 0);
      }
      const expectedTrayHeight = 62 + frame.collapseVar * 38;
      expect(Math.abs(frame.trayHeight - expectedTrayHeight)).toBeLessThan(1.5);
    }

    await expect
      .poll(async () => (await readSidebarMetrics(page)).animatingClass, { timeout: 2000 })
      .toBe(false);

    const collapsed = await readSidebarMetrics(page);
    expect(collapsed.railWidth).toBeCloseTo(80, 0);
    expect(collapsed.collapseVar).toBeCloseTo(1, 2);
    expect(collapsed.trayHeight).toBeCloseTo(100, 0);
    expect(collapsed.traySignOutCount).toBe(0);
    expect(collapsed.trayCollapseCount).toBe(1);
    expect(collapsed.collapsedClass).toBe(true);
    expect(collapsed.navLabelCount).toBe(0);
    expect(collapsed.brandCopyCount).toBe(0);
    expect(collapsed.accountCopyCount).toBe(0);
    expect(collapsed.clippedIcons).toBe(0);
    for (const offset of collapsed.iconCenterOffsets) {
      expect(offset).toBeLessThan(2.5);
    }
    for (const height of collapsed.navHeights) {
      expect(height).toBeCloseTo(40, 0);
    }
    await expect(collapseBtn).toHaveAttribute("aria-expanded", "false");
    await expect(collapseBtn).toHaveAttribute("aria-label", "Expand sidebar");

    // Sample rAF frames during expand (80px -> 250px).
    const expandFrames = await sampleToggleMotion(page, 0);
    const intermediateExpandFrames = expandFrames.filter(
      (frame) => frame.railWidth > 82 && frame.railWidth < 248
    );
    expect(intermediateExpandFrames.length).toBeGreaterThan(0);

    for (const frame of expandFrames) {
      for (const navHeight of frame.navHeights) {
        expect(navHeight).toBeCloseTo(40, 0);
      }
      const expectedTrayHeight = 62 + frame.collapseVar * 38;
      expect(Math.abs(frame.trayHeight - expectedTrayHeight)).toBeLessThan(1.5);
    }

    await expect
      .poll(async () => (await readSidebarMetrics(page)).animatingClass, { timeout: 2000 })
      .toBe(false);

    const expanded = await readSidebarMetrics(page);
    expect(expanded.railWidth).toBeCloseTo(250, 0);
    expect(expanded.collapseVar).toBeCloseTo(0, 2);
    expect(expanded.trayHeight).toBeCloseTo(62, 0);
    expect(expanded.collapsedClass).toBe(false);
    expect(expanded.navLabelCount).toBe(9);
    expect(expanded.brandCopyCount).toBe(1);
    expect(expanded.accountCopyCount).toBe(1);
    expect(expanded.wrappedLabels).toBe(0);
  });

  test("snaps immediately (INSTANT) when prefers-reduced-motion is reduce", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${harnessBaseUrl}/harness.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(100);

    const reducedMotionMatches = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    expect(reducedMotionMatches).toBe(true);

    // Click collapse and measure rAF frames: width and --buck-collapse must snap with zero spring interpolation.
    const collapseFrames = await sampleToggleMotion(page, 1, 250);
    const intermediateFrames = collapseFrames.filter(
      (frame) =>
        (frame.railWidth < 248 && frame.railWidth > 82) ||
        (frame.collapseVar > 0.05 && frame.collapseVar < 0.95)
    );
    expect(intermediateFrames).toHaveLength(0);
    expect(collapseFrames.length).toBeLessThanOrEqual(5);
    const settledCollapse = collapseFrames[collapseFrames.length - 1];
    expect(settledCollapse?.t).toBeLessThan(120);
    expect(settledCollapse?.railWidth).toBeCloseTo(80, 0);
    expect(settledCollapse?.collapseVar).toBeCloseTo(1, 2);
    expect(settledCollapse?.trayHeight).toBeCloseTo(100, 0);
    expect(settledCollapse?.animating).toBe(false);

    // Click expand; width and --buck-collapse must snap immediately back to 250px / 0.
    const expandFrames = await sampleToggleMotion(page, 0, 250);
    const intermediateExpandFrames = expandFrames.filter(
      (frame) =>
        (frame.railWidth > 82 && frame.railWidth < 248) ||
        (frame.collapseVar > 0.05 && frame.collapseVar < 0.95)
    );
    expect(intermediateExpandFrames).toHaveLength(0);
    expect(expandFrames.length).toBeLessThanOrEqual(5);
    const settledExpand = expandFrames[expandFrames.length - 1];
    expect(settledExpand?.t).toBeLessThan(120);
    expect(settledExpand?.railWidth).toBeCloseTo(250, 0);
    expect(settledExpand?.collapseVar).toBeCloseTo(0, 2);
    expect(settledExpand?.trayHeight).toBeCloseTo(62, 0);
    expect(settledExpand?.animating).toBe(false);
  });

  test("persists collapsed state in localStorage across reload and keeps mobile drawer sign-out", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${harnessBaseUrl}/harness.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(100);

    await page.locator(".dashboard-header-actions .dashboard-tray-btn--collapse").click();
    await expect
      .poll(async () => page.evaluate(() => window.localStorage.getItem("buck:sidebar-collapsed")))
      .toBe("true");

    await page.reload({ waitUntil: "networkidle" });
    const afterReload = await readSidebarMetrics(page);
    expect(afterReload.htmlSidebarAttr).toBe("collapsed");
    expect(afterReload.railWidth).toBeCloseTo(80, 0);
    expect(afterReload.collapseVar).toBeCloseTo(1, 2);
    expect(afterReload.trayHeight).toBeCloseTo(100, 0);

    // Mobile viewport switches to top bar + burger menu with sign-out inside the mobile drawer.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".dashboard-nav")).toBeHidden();
    await expect(page.locator(".dashboard-header-actions")).toBeHidden();
    const burger = page.locator(".burger-menu");
    await expect(burger).toBeVisible();
    await burger.click();

    const mobileDrawer = page.locator("#dashboard-mobile-menu");
    await expect(mobileDrawer).toBeVisible();
    await expect(mobileDrawer.locator(".nav-button")).toHaveCount(9);
    await expect(mobileDrawer.locator(".dashboard-account-tray--mobile")).toBeVisible();
    await expect(mobileDrawer.locator(".dashboard-tray-btn--signout")).toHaveCount(1);
  });
});
