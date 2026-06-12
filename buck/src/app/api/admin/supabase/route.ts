import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.SUPABASE_MANAGEMENT_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;

  if (!token || !projectRef) {
    return NextResponse.json(
      { error: "Supabase Management API keys are not configured." },
      { status: 500 }
    );
  }

  try {
    const sql = encodeURIComponent("select timestamp, event_message from auth_logs order by timestamp desc limit 100");
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/analytics/endpoints/logs.all?sql=${sql}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Supabase API error:", errorData);
      return NextResponse.json(
        { error: "Failed to fetch from Supabase API." },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ logs: data.result });
  } catch (error) {
    console.error("Supabase API request failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
