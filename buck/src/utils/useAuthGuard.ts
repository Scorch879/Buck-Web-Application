"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/utils/supabase";

export type BuckUser = SupabaseUser & {
  uid: string;
  displayName: string | null;
};

function toBuckUser(user: SupabaseUser | null): BuckUser | null {
  if (!user) {
    return null;
  }

  const displayName =
    typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : null;

  return {
    ...user,
    uid: user.id,
    displayName,
  };
}

function getSignInPath(pathname: string | null) {
  if (!pathname || pathname === "/dashboard/home") {
    return "/sign-in";
  }

  return `/sign-in?redirectTo=${encodeURIComponent(pathname)}`;
}

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<BuckUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        setSessionUser(null);
        return;
      }

      setSessionUser(data.user);
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
  }, [pathname, router]);

  return { user, loading };
}

export function useRedirectIfAuthenticated(redirectTo = "/dashboard/home") {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mounted && data.user) {
        router.replace(redirectTo);
      }
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
