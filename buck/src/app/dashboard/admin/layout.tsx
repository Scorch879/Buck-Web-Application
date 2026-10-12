import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/utils/adminAccess";
import { isDesignPreviewMode } from "@/utils/designPreview";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

// Server-side admin gate. The middleware already redirects non-admins; this
// re-checks on the server so the page is protected even if the matcher changes.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!isDesignPreviewMode) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!isAdminUser(user)) {
      redirect("/dashboard/home");
    }
  }

  return children;
}
