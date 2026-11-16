import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isDesignPreviewMode } from "@/utils/designPreview";
import { getAdminServerSession } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

// Server-side admin gate. The middleware already redirects non-admins; this
// re-checks on the server so the page is protected even if the matcher changes.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!isDesignPreviewMode) {
    const { isAdmin } = await getAdminServerSession();

    if (!isAdmin) {
      redirect("/dashboard/home");
    }
  }

  return children;
}
