"use client";

import { useEffect } from "react";
import { MFA_VERIFY_PATH } from "@/utils/mfa/assurance";
import { currentPageMfaVerifyPath, isMfaRequiredResponse } from "@/utils/mfa/client";

/**
 * ADR-048: when a Buck route (401 `mfa_required`) or Buck_AI
 * (`X-Buck-Error: mfa_required`) says the session still needs its two-factor
 * code, send the user to /verify-2fa and bring them back here afterwards.
 * Wraps window.fetch once; mounted in the dashboard layout.
 */

let installed = false;
let redirecting = false;

export default function MfaRequiredWatcher() {
  useEffect(() => {
    if (installed) {
      return;
    }

    installed = true;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);

      if (
        !redirecting &&
        (response.status === 401 || response.status === 403) &&
        window.location.pathname !== MFA_VERIFY_PATH &&
        (await isMfaRequiredResponse(response))
      ) {
        redirecting = true;
        window.location.assign(currentPageMfaVerifyPath());
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
      installed = false;
    };
  }, []);

  return null;
}
