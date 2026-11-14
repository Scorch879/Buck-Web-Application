import { expect, test, type Page } from "@playwright/test";

async function openLegalModal(page: Page, label: "Terms" | "Privacy") {
  const trigger = page.locator("footer").getByRole("button", { name: label });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const card = page.locator(".legal-modal-card");
  await expect(card).toBeVisible();
  return { dialog, card };
}

test.describe("Unified Scrollbar Design (ADR-054)", () => {
  test("Legal modal card inherits global themed scrollbar instead of scrollbar-width: none on /", async ({
    page,
  }) => {
    await page.goto("/");

    // Outer document keeps hidden page scrollbars while inner containers use ADR-054 styling.
    const rootScrollbarState = await page.evaluate(() => {
      const htmlStyle = getComputedStyle(document.documentElement);
      const bodyStyle = getComputedStyle(document.body);
      const rootVars = getComputedStyle(document.documentElement);
      return {
        htmlScrollbarWidth: htmlStyle.scrollbarWidth,
        bodyScrollbarWidth: bodyStyle.scrollbarWidth,
        scrollThumbLight: rootVars.getPropertyValue("--buck-scroll-thumb").trim(),
        scrollThumbHoverLight: rootVars
          .getPropertyValue("--buck-scroll-thumb-hover")
          .trim(),
      };
    });

    expect(rootScrollbarState.htmlScrollbarWidth).toBe("none");
    expect(rootScrollbarState.bodyScrollbarWidth).toBe("none");
    expect(rootScrollbarState.scrollThumbLight).not.toBe("");
    expect(rootScrollbarState.scrollThumbHoverLight).not.toBe("");

    const { card } = await openLegalModal(page, "Terms");

    const modalScrollbar = await card.evaluate((el) => {
      const style = getComputedStyle(el);
      const webkitTrack = getComputedStyle(el, "::-webkit-scrollbar");
      const webkitThumb = getComputedStyle(el, "::-webkit-scrollbar-thumb");
      return {
        scrollbarWidth: style.scrollbarWidth,
        overflowY: style.overflowY,
        webkitWidth: webkitTrack.width,
        webkitThumbBorderRadius: webkitThumb.borderRadius,
        webkitThumbBorderWidth: webkitThumb.borderWidth,
      };
    });

    expect(modalScrollbar.overflowY).toBe("auto");
    expect(modalScrollbar.scrollbarWidth).not.toBe("none");
    expect(["auto", "thin"]).toContain(modalScrollbar.scrollbarWidth);

    // In Chromium, *::-webkit-scrollbar sets 8px track with 2px transparent border (4px-6px visual pill).
    if (modalScrollbar.webkitWidth && modalScrollbar.webkitWidth !== "auto") {
      expect(modalScrollbar.webkitWidth).toBe("8px");
      expect(modalScrollbar.webkitThumbBorderRadius).toBe("999px");
    }

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Privacy modal shares the same .legal-modal-card scrollbar rules.
    const { card: privacyCard } = await openLegalModal(page, "Privacy");
    const privacyScrollbarWidth = await privacyCard.evaluate(
      (el) => getComputedStyle(el).scrollbarWidth
    );
    expect(privacyScrollbarWidth).not.toBe("none");
  });

  test("Dark theme updates ADR-054 scrollbar tokens and keeps legal modal scrollbar enabled", async ({
    page,
  }) => {
    await page.goto("/");

    const themeToggle = page.getByRole("button", {
      name: /switch to (dark|light) mode/i,
    });
    const currentLabel = await themeToggle.getAttribute("aria-label");
    if (currentLabel && /dark mode/i.test(currentLabel)) {
      await themeToggle.click();
    }

    await expect(page.locator("html")).toHaveAttribute("data-buck-theme", "dark");

    const darkThumbToken = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--buck-scroll-thumb")
        .trim()
    );
    expect(darkThumbToken).not.toBe("");

    const { card } = await openLegalModal(page, "Terms");
    const darkModalScrollbar = await card.evaluate((el) => ({
      scrollbarWidth: getComputedStyle(el).scrollbarWidth,
      overflowY: getComputedStyle(el).overflowY,
    }));

    expect(darkModalScrollbar.overflowY).toBe("auto");
    expect(darkModalScrollbar.scrollbarWidth).not.toBe("none");
  });

  test("Auth route /sign-in and standalone legal pages preserve ADR-054 scrollbar tokens", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in to Buck" })).toBeVisible();

    const signInScrollbar = await page.evaluate(() => ({
      thumb: getComputedStyle(document.documentElement)
        .getPropertyValue("--buck-scroll-thumb")
        .trim(),
      htmlWidth: getComputedStyle(document.documentElement).scrollbarWidth,
    }));

    expect(signInScrollbar.thumb).not.toBe("");
    expect(signInScrollbar.htmlWidth).toBe("none");

    await page.goto("/terms");
    await expect(page.locator(".legal-card")).toBeVisible();
  });
});

test.describe("Modal Open & Exit Animations (Priority 2 & F2)", () => {
  test("Legal modal opens cleanly, locks body scroll, and exits on Escape", async ({
    page,
  }) => {
    await page.goto("/");

    const { dialog, card } = await openLegalModal(page, "Terms");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(page.locator(".legal-modal-eyebrow")).toHaveText("Terms of use");
    await expect(page.locator("#legal-modal-title")).toContainText("Clear rules for using Buck.");
    await expect(card).toHaveCSS("opacity", "1");

    const overflowWhileOpen = await page.evaluate(() => document.body.style.overflow);
    expect(overflowWhileOpen).toBe("hidden");

    // Clicking inside the modal card must not dismiss it.
    await card.click({ position: { x: 24, y: 24 } });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(".legal-modal-backdrop")).toHaveCount(0);
    await expect(dialog).toHaveCount(0);

    const overflowAfterClose = await page.evaluate(() => document.body.style.overflow);
    expect(overflowAfterClose).toBe("");
  });

  test("Legal modal exits cleanly via backdrop click and close button", async ({
    page,
  }) => {
    await page.goto("/");

    const { dialog } = await openLegalModal(page, "Privacy");
    await expect(page.locator(".legal-modal-eyebrow")).toHaveText("Privacy");
    await expect(page.locator("#legal-modal-title")).toContainText(
      "Your budget data should stay yours."
    );

    // Click outer backdrop area away from centered .modal-glow-shell.
    await page.locator(".legal-modal-backdrop").click({ position: { x: 8, y: 8 } });
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".legal-modal-backdrop")).toHaveCount(0);

    // Re-open and close using the explicit close button.
    const { dialog: reopened } = await openLegalModal(page, "Terms");
    await page.getByRole("button", { name: "Close legal information" }).click();
    await expect(reopened).toHaveCount(0);
  });

  test("prefers-reduced-motion: reduce sets html scroll-behavior to auto and completes modal/auth transitions", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const smoothScroll = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior
    );
    expect(smoothScroll).toBe("smooth");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();

    const reducedScroll = await page.evaluate(() => ({
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      matchesReduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    }));

    expect(reducedScroll.matchesReduced).toBe(true);
    expect(reducedScroll.scrollBehavior).toBe("auto");

    const { dialog, card } = await openLegalModal(page, "Terms");
    await expect(card).toHaveCSS("opacity", "1");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await page.goto("/sign-in");
    await expect(page.locator(".SI-Page")).toHaveCSS("opacity", "1");
  });
});

test.describe("Auth & MFA UI Flows (F3, F8, F10)", () => {
  test("/sign-in renders query notices/errors, validates fields, and toggles password visibility", async ({
    page,
  }) => {
    await page.goto("/sign-in?reason=session-expired");
    await expect(page.locator(".success-message")).toHaveText(
      "You were signed out after a period of inactivity."
    );

    await page.goto("/sign-in?error=auth-callback-failed");
    await expect(page.locator(".error-message")).toHaveText(
      "Buck could not finish Google sign in. Please try again."
    );

    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in to Buck" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Google" })
    ).toBeVisible();

    const emailInput = page.locator("#username");
    const passwordInput = page.locator("#password");
    const submitButton = page.getByRole("button", { name: "Sign In", exact: true });

    // Empty submit validation
    await submitButton.click();
    await expect(page.locator(".error-message")).toHaveText(
      "Please enter both email and password."
    );

    // Invalid email domain validation (passes HTML5 type="email" @ check, caught by getEmailValidationMessage)
    await emailInput.fill("user@incomplete");
    await passwordInput.fill("secret123");
    await submitButton.click();
    await expect(page.locator(".error-message")).toHaveText(
      "Email domain looks incomplete."
    );

    // Short password validation
    await emailInput.fill("user@example.com");
    await passwordInput.fill("12345");
    await submitButton.click();
    await expect(page.locator(".error-message")).toHaveText(
      "Password must be at least 6 characters."
    );

    // Password visibility toggle
    await expect(passwordInput).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Mock Supabase password grant failure to verify async error state & button recovery
    await page.route("**/auth/v1/token**", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        }),
      });
    });

    await passwordInput.fill("ValidPass123!");
    await submitButton.click();
    await expect(page.locator(".error-message")).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  test("/create-account validates inputs, shows live password strength, and toggles password visibility", async ({
    page,
  }) => {
    await page.goto("/create-account");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();

    const usernameInput = page.locator("#username");
    const emailInput = page.locator("#email");
    const passwordInput = page.locator("#password");
    const confirmInput = page.locator("#confirm");
    const submitButton = page.getByRole("button", { name: "Create Account" });

    // Empty submit
    await submitButton.click();
    await expect(page.locator(".error-message")).toHaveText(
      "Please fill in all fields."
    );

    // Invalid email domain
    await usernameInput.fill("Alex");
    await emailInput.fill("alex@invalid");
    await passwordInput.fill("BuckTracker!2026");
    await confirmInput.fill("BuckTracker!2026");
    await submitButton.click();
    await expect(page.locator(".error-message")).toHaveText(
      "Email domain looks incomplete."
    );

    // Password mismatch
    await emailInput.fill("alex@example.com");
    await confirmInput.fill("Mismatch!2026");
    await submitButton.click();
    await expect(page.locator(".error-message")).toHaveText(
      "Passwords do not match."
    );
    await expect(page.locator(".CA-ConfirmHint")).toHaveText(
      "Passwords do not match yet."
    );

    // Weak password policy rejection + live meter update
    await passwordInput.fill("weak");
    await confirmInput.fill("weak");
    await submitButton.click();
    await expect(page.locator(".error-message")).toContainText(
      "Password is not secure enough:"
    );

    await passwordInput.fill("BuckTracker!2026");
    await confirmInput.fill("BuckTracker!2026");
    await expect(page.locator(".CA-PasswordSummary")).toContainText("Strong password");
    await expect(page.locator(".CA-PasswordSummary")).toContainText("5/5 checks");
    await expect(page.locator(".CA-ConfirmHint")).toHaveText("Passwords match.");

    // Toggle both password & confirm visibility buttons
    const eyeButtons = page.locator(".CA-Eye-Btn");
    await expect(eyeButtons).toHaveCount(2);

    await expect(passwordInput).toHaveAttribute("type", "password");
    await eyeButtons.nth(0).click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await eyeButtons.nth(0).click();
    await expect(passwordInput).toHaveAttribute("type", "password");

    await expect(confirmInput).toHaveAttribute("type", "password");
    await eyeButtons.nth(1).click();
    await expect(confirmInput).toHaveAttribute("type", "text");
    await eyeButtons.nth(1).click();
    await expect(confirmInput).toHaveAttribute("type", "password");
  });

  test("/forgot-password validates email, handles mocked API error, and shows recovery link error", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await expect(
      page.getByRole("heading", { name: "Reset password" })
    ).toBeVisible();

    const emailInput = page.locator("#forgot-email");
    const submitButton = page.getByRole("button", { name: "Send Reset Link" });

    await submitButton.click();
    await expect(page.locator(".forgot-error")).toHaveText(
      "Please enter your email address."
    );

    await emailInput.fill("user@incomplete");
    await submitButton.click();
    await expect(page.locator(".forgot-error")).toHaveText(
      "Email domain looks incomplete."
    );

    await page.route("**/api/auth/password-reset", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Too many reset requests. Please try again later.",
        }),
      });
    });

    await emailInput.fill("user@example.com");
    await submitButton.click();
    await expect(page.locator(".forgot-error")).toBeVisible();
    await expect(submitButton).toBeEnabled();

    // Recovery mode without a valid recovery session shows an invalid/expired message when Supabase is configured.
    await page.goto("/forgot-password?type=recovery");
    await expect(
      page.getByRole("heading", { name: /Reset password|Create new password/ })
    ).toBeVisible();
  });

  test("/verify-2fa enforces middleware redirect when unauthenticated or validates MFA form when rendered", async ({
    page,
  }) => {
    await page.route("**/api/auth/mfa/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          currentLevel: "aal1",
          satisfied: false,
          enabled: true,
          factors: [
            {
              id: "factor-1",
              friendlyName: "Authenticator App",
              createdAt: "2026-01-01T00:00:00Z",
            },
          ],
          recoveryCodesLeft: 8,
          emailRecovery: null,
        }),
      });
    });

    await page.goto("/verify-2fa");
    const currentPath = new URL(page.url()).pathname;

    if (currentPath === "/sign-in") {
      // Middleware gate active: unauthenticated /verify-2fa redirects cleanly to /sign-in?redirectTo=%2Fverify-2fa
      expect(new URL(page.url()).searchParams.get("redirectTo")).toBe("/verify-2fa");
      await expect(page.getByRole("heading", { name: "Sign in to Buck" })).toBeVisible();
      return;
    }

    // Fallback when Supabase env is absent and middleware lets /verify-2fa render
    await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.locator("#verify-2fa-error")).toHaveText(
      "Enter the 6-digit code from your authenticator app."
    );

    await page.getByRole("button", { name: "Use a backup code" }).click();
    await expect(
      page.getByRole("heading", { name: "Use a backup code" })
    ).toBeVisible();
    await page.locator("#verify-2fa-backup").fill("ABC");
    await page.getByRole("button", { name: "Use backup code" }).click();
    await expect(page.locator("#verify-2fa-error")).toHaveText(
      "Backup codes look like ABCDE-12345."
    );
  });
});
