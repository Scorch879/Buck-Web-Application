"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { toBuckUser, type BuckUser } from "@/utils/authUser";
import {
  designPreviewUserId,
  isDesignPreviewMode,
} from "@/utils/designPreview";
import { isSupabaseConfigured, supabase } from "@/utils/supabase";

export type { BuckUser };

function getSignInPath(pathname: string | null) {
  if (!pathname || pathname === "/dashboard/home") {
    return "/sign-in";
  }

  return `/sign-in?redirectTo=${encodeURIComponent(pathname)}`;
}

function isInvalidRefreshTokenError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.toLowerCase().includes("refresh token");
}

async function clearBrokenLocalSession() {
  if (!supabase) {
    return;
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (error) {
    if (!isInvalidRefreshTokenError(error)) {
      console.warn("Failed to clear local auth session:", error);
    }
  }
}

function getDesignPreviewUser(): BuckUser {
  const now = new Date().toISOString();

  return {
    id: designPreviewUserId,
    uid: designPreviewUserId,
    app_metadata: {},
    aud: "authenticated",
    confirmed_at: now,
    created_at: now,
    displayName: "Design Preview",
    email: "preview@buck.local",
    authProviders: ["email"],
    identities: [],
    isGoogleOnlyUser: false,
    isPasswordUser: true,
    role: "authenticated",
    updated_at: now,
    user_metadata: {
      full_name: "Design Preview",
      username: "Design Preview",
    },
  } as BuckUser;
}

export function useAuthGuard(initialUser: BuckUser | null = null) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<BuckUser | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);

  useEffect(() => {
    if (isDesignPreviewMode) {
      setUser(getDesignPreviewUser());
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setUser(null);
      setLoading(false);
      router.replace(getSignInPath(pathname));
      return;
    }

    let mounted = true;

    const setSessionUser = (sessionUser: SupabaseUser | null) => {
      if (!mounted) {
        return;
      }

      const nextUser = toBuckUser(sessionUser);
      setUser(nextUser);
      setLoading(false);

      if (!nextUser) {
        router.replace(getSignInPath(pathname));
      }
    };

    if (initialUser) {
      setSessionUser(initialUser);

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          setSessionUser(null);
          return;
        }

        setSessionUser(session?.user ?? initialUser);
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    supabase.auth
      .getUser()
      .then(async ({ data, error }) => {
        if (error) {
          await clearBrokenLocalSession();
          setSessionUser(null);
          return;
        }

        setSessionUser(data.user);
      })
      .catch(async (error) => {
        if (isInvalidRefreshTokenError(error)) {
          await clearBrokenLocalSession();
        } else {
          console.warn("Failed to read auth session:", error);
        }

        setSessionUser(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [initialUser, pathname, router]);

  return { user, loading };
}

export function useRedirectIfAuthenticated(redirectTo = "/dashboard/home") {
  const router = useRouter();

  useEffect(() => {
    if (isDesignPreviewMode) {
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    let mounted = true;

    supabase.auth
      .getUser()
      .then(async ({ data, error }) => {
        if (error) {
          await clearBrokenLocalSession();
          return;
        }

        if (mounted && data.user) {
          router.replace(redirectTo);
        }
      })
      .catch(async (error) => {
        if (isInvalidRefreshTokenError(error)) {
          await clearBrokenLocalSession();
          return;
        }

        console.warn("Failed to read auth session:", error);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        router.replace(redirectTo);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, redirectTo]);
}
