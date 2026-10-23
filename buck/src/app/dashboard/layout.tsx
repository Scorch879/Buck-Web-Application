import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import DashboardClientLayout from "@/component/DashboardClientLayout";
import { isAdminUser } from "@/utils/adminAccess";
import { toBuckUser } from "@/utils/authUser";
import { isDesignPreviewMode } from "@/utils/designPreview";
import { createMfaVerifyPath, getMfaState } from "@/utils/mfa/assurance";
import {
  createSupabaseServerClient,
  isSupabaseServerConfigured,
} from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  let initialUser = null;

  if (!isDesignPreviewMode) {
    if (!isSupabaseServerConfigured) {
      redirect("/sign-in?error=supabase-not-configured");
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      redirect("/sign-in?redirectTo=/dashboard/home");
    }

    // Defense in depth behind middleware.ts: a session that still owes its
    // authenticator code never renders the dashboard.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!getMfaState(user, session?.access_token).satisfied) {
      redirect(createMfaVerifyPath("/dashboard/home"));
    }

    initialUser = toBuckUser(user, isAdminUser(user));
  }

  return (
    <DashboardClientLayout initialUser={initialUser}>
      {children}
    </DashboardClientLayout>
  );
}
