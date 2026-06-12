export interface AIForecastInsights {
  summary: string;
  projectedSavings: number;
  warnings: string[];
}

export async function fetchAIForecastInsights(context: any): Promise<AIForecastInsights> {
  const response = await fetch("/api/forecast", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(context),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch AI forecast insights");
  }

  return response.json();
}
