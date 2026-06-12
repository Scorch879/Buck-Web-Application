export interface AIAdvisorInsights {
  suggestion: string;
  advice: string;
}

export async function fetchAIAdvisorInsights(context: any): Promise<AIAdvisorInsights> {
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
