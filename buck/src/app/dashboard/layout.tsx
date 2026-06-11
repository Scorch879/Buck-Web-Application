import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import DashboardClientLayout from "@/component/DashboardClientLayout";
import { toBuckUser } from "@/utils/authUser";
import { isDesignPreviewMode } from "@/utils/designPreview";
import {
  createSupabaseServerClient,
  isSupabaseServerConfigured,
} from "@/utils/supabase/server";

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

    initialUser = toBuckUser(user);
  }

  return (
    <DashboardClientLayout initialUser={initialUser}>
      {children}
    </DashboardClientLayout>
  );
}
