import { NextResponse } from "next/server";

export async function GET() {
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
