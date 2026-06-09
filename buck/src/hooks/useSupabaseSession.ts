"use client";

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from "@/utils/supabase";

type SupabaseSessionState = {
  configured: boolean;
  error: string;
  loading: boolean;
  session: Session | null;
  user: User | null;
};

function isInvalidRefreshTokenError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("refresh token")
  );
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

export function useSupabaseSession(): SupabaseSessionState {
  const [state, setState] = useState<SupabaseSessionState>({
    configured: isSupabaseConfigured,
    error: isSupabaseConfigured ? "" : supabaseConfigError,
    loading: isSupabaseConfigured,
    session: null,
    user: null,
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setState({
        configured: false,
        error: supabaseConfigError,
        loading: false,
        session: null,
        user: null,
      });
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!mounted) {
          return;
        }

        if (error) {
          await clearBrokenLocalSession();
          setState({
            configured: true,
            error: error.message,
            loading: false,
            session: null,
            user: null,
          });
          return;
        }

        setState({
          configured: true,
          error: "",
          loading: false,
          session: data.session,
          user: data.session?.user ?? null,
        });
      })
      .catch(async (error) => {
        if (isInvalidRefreshTokenError(error)) {
          await clearBrokenLocalSession();
        } else {
          console.warn("Failed to read auth session:", error);
        }

        if (mounted) {
          setState({
            configured: true,
            error: error instanceof Error ? error.message : "Auth failed.",
            loading: false,
            session: null,
            user: null,
          });
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) {
        return;
      }

      setState({
        configured: true,
        error: "",
        loading: false,
        session,
        user: session?.user ?? null,
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}

