import type { ChatRequest, ChatStreamEvent } from "@/utils/aiChat";
import { buckAiError, buckAiFetch } from "@/utils/buckAi";
import { createSseParser } from "@/utils/sse";

/**
 * AI Financial Advisor calls (Buck_AI `/advisor/*`). Insights live in
 * advisorApi.ts; this file holds auto-categorize, chat and goal tips.
 */

export type CategorizeKind = "expense" | "income";

/**
 * Advisor auto-categorize: files up to 25 descriptions under the user's own
 * categories in one request. Returns names in the same order; null means "no
 * confident match" (or AI unavailable), so the item stays in the fallback.
 */
export async function categorizeItems(kind: CategorizeKind, descriptions: string[]): Promise<(string | null)[]> {
  const none = descriptions.map(() => null);
  if (descriptions.length === 0) return [];
  try {
    const response = await buckAiFetch("/advisor/categorize", {
      method: "POST",
      body: JSON.stringify({ kind, descriptions: descriptions.map((d) => d.trim().slice(0, 300)) }),
    });
    if (!response.ok) return none;
    const data: { categories?: unknown } = await response.json();
    const answers = Array.isArray(data.categories) ? data.categories : [];
    return descriptions.map((_, i) => (typeof answers[i] === "string" && answers[i] ? (answers[i] as string) : null));
  } catch {
    return none;
  }
}

/** Single-description convenience for add-expense flows. */
export async function suggestCategory(kind: CategorizeKind, description: string) {
  if (!description.trim()) return null;
  return (await categorizeItems(kind, [description]))[0] ?? null;
}

/**
 * Two-sentence Advisor tip for a saved goal (`{ goalId }`) or a goal being
 * created. Empty string when no tip is available (tips are optional).
 */
export async function getGoalTip(
  goal: { goalId: string } | { goalName: string; targetAmount: number | string; attitude: string; targetDate?: string }
): Promise<string> {
  try {
    const body =
      "goalId" in goal
        ? goal
        : { ...goal, targetAmount: Number(goal.targetAmount), targetDate: goal.targetDate || undefined };
    const response = await buckAiFetch("/advisor/goal-tip", { method: "POST", body: JSON.stringify(body) });
    if (!response.ok) return "";
    const data: { tip?: unknown } = await response.json();
    return typeof data.tip === "string" ? data.tip : "";
  } catch {
    return "";
  }
}

/**
 * Streams an Advisor chat answer and reports each event. Throws only for
 * transport failures; API errors arrive as `error` events. Abort via `signal`.
 */
export async function streamAdvisorChat(
  request: ChatRequest,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal
) {
  const response = await buckAiFetch("/advisor/chat", {
    method: "POST",
    headers: { Accept: "text/event-stream" },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok || !response.body) {
    const message = await buckAiError(response, "Buck couldn't answer right now. Try again shortly.");
    onEvent({ type: "error", message, retryable: response.status !== 401 });
    onEvent({ type: "done" });
    return;
  }

  const parser = createSseParser((data) => {
    try {
      onEvent(JSON.parse(data) as ChatStreamEvent);
    } catch {
      // Ignore malformed frames.
    }
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }
  parser.flush();
}
