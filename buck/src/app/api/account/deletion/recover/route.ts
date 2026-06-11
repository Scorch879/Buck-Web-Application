import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { isSupabaseAdminConfigured } from "@/utils/supabaseConfig";

export async function POST() {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Account recovery needs SUPABASE_SERVICE_ROLE_KEY on the server.",
      },
      { status: 500 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { success: false, message: "You need to sign in again first." },
      { status: 401 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("account_deletion_requests")
    .select("id, recovery_until")
    .eq("user_id", user.id)
    .not("confirmed_at", "is", null)
    .is("canceled_at", null)
    .is("purge_started_at", null)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }

  if (!data?.recovery_until) {
    return NextResponse.json(
      { success: false, message: "No recoverable deletion request was found." },
      { status: 404 }
    );
  }

  if (Date.now() > new Date(data.recovery_until).getTime()) {
    return NextResponse.json(
      {
        success: false,
        message: "The 10-day recovery window has already ended.",
      },
      { status: 410 }
    );
  }

  const { error: updateError } = await admin
    .from("account_deletion_requests")
    .update({ canceled_at: new Date().toISOString() })
    .eq("id", data.id)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json(
      { success: false, message: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Account deletion canceled. Your Buck account is active again.",
  });
}
