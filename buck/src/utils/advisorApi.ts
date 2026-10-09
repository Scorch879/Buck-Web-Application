export interface AIAdvisorInsights {
  id?: string | null;
  title?: string;
  suggestion: string;
  advice: string;
  financialHealthScore?: number | null;
  priority?: string;
  createdAt?: string;
  cached?: boolean;
}

export async function fetchAIAdvisorInsights(context: {
  userId?: string;
  forceRefresh?: boolean;
}): Promise<AIAdvisorInsights> {
  const response = await fetch("/api/advisor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(context),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch AI advisor insights");
  }

  return response.json();
}
