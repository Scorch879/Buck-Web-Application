export interface AIForecastInsights {
  id?: string | null;
  summary: string;
  projectedSpending?: number;
  projectedSavings: number;
  aiRecommendedBudget?: number | null;
  warnings: string[];
  dailyForecast?: Record<string, number>;
  actualSpendingSnapshot?: number;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: string;
  cached?: boolean;
}

export async function fetchAIForecastInsights(context: {
  userId?: string;
  forceRefresh?: boolean;
  periodType?: "weekly" | "monthly" | "quarterly" | "custom";
}): Promise<AIForecastInsights> {
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
