import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseCookieOptions, supabaseUrl } from "@/utils/supabaseConfig";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {}
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== "buckthebudgettracker@gmail.com") {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
  }

  const token = process.env.VERCEL_ACCESS_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    return NextResponse.json(
      { error: "Vercel API keys are not configured." },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Vercel API error:", errorData);
      return NextResponse.json(
        { error: "Failed to fetch from Vercel API." },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ deployments: data.deployments });
  } catch (error) {
    console.error("Vercel API request failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
