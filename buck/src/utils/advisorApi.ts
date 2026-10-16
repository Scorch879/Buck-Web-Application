import { buckAiError, buckAiFetch } from "@/utils/buckAi";

/** A saved advisory from Buck_AI's AI Financial Advisor (`ai_advisories`). */
export interface AIAdvisorInsights {
  id?: string | null;
  title?: string;
  suggestion: string;
  advice: string;
  financialHealthScore?: number | null;
  priority?: string;
  /** What the advice is about: spending, category, goal, income or buffer. */
  focus?: string | null;
  /** Material facts that changed since the previous saved advice. */
  changed?: string[];
  generatedWith?: "gemini" | "rules";
  createdAt?: string;
  /** Served from the database because the data has not materially changed. */
  cached?: boolean;
  /** The data changed but regeneration is cooling down; a fresh one comes shortly. */
  stale?: boolean;
}

/**
 * Reads the user's advice. Buck_AI returns the saved advisory while the data
 * is unchanged, and regenerates and saves a new one when it moved (or when
 * `forceRefresh` is set, subject to a short cooldown). `userId` is accepted
 * for call-site compatibility; the token identifies the user.
 */
export async function fetchAIAdvisorInsights(context: {
  userId?: string;
  forceRefresh?: boolean;
}): Promise<AIAdvisorInsights> {
  const response = await buckAiFetch(`/advisor/insight?refresh=${context.forceRefresh ? "true" : "false"}`);
  if (!response.ok) {
    throw new Error(await buckAiError(response, "Failed to fetch AI advisor insights"));
  }
  return response.json();
}
