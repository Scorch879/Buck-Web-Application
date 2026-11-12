import type { ChatRequest, ChatStreamEvent } from "@/utils/aiChat";
import { buckAiError, buckAiFetch } from "@/utils/buckAi";
import { createSseParser } from "@/utils/sse";
import { isSavingAttitude, type GoalAttitude } from "@/utils/goalAttitude";

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
 * created. Every ₱ figure in it is from the goal plan. When no AI model gives a
 * valid tip, Buck_AI sends the rule-written tip (`source: "rules"`) and does not
 * store it. Empty string when Buck_AI can't be reached (tips are optional).
 */
type GoalTipRequest =
  | { goalId: string }
  | { goalName: string; targetAmount: number | string; attitude: string; targetDate?: string };

/** Who wrote a goal tip: an AI model, or Buck's rules from the goal plan. */
export type GoalTipSource = "ai" | "groq" | "rules";

/** The tip with its source, so the UI can label a rule-written tip honestly. */
export async function getGoalTipWithSource(
  goal: GoalTipRequest
): Promise<{ tip: string; source: GoalTipSource | null }> {
  try {
    const body =
      "goalId" in goal
        ? goal
        : { ...goal, targetAmount: Number(goal.targetAmount), targetDate: goal.targetDate || undefined };
    const response = await buckAiFetch("/advisor/goal-tip", { method: "POST", body: JSON.stringify(body) });
    if (!response.ok) return { tip: "", source: null };
    const data: { tip?: unknown; source?: unknown } = await response.json();
    const source =
      data.source === "ai" || data.source === "groq" || data.source === "rules" ? data.source : null;
    return { tip: typeof data.tip === "string" ? data.tip : "", source };
  } catch {
    return { tip: "", source: null };
  }
}

export async function getGoalTip(goal: GoalTipRequest): Promise<string> {
  return (await getGoalTipWithSource(goal)).tip;
}

/**
 * The saving attitude a goal needs, detected by the Advisor from the user's
 * spending and income, with the daily / weekly / monthly plan it implies.
 * `{ goalId }` detects and saves it on a saved goal; the other form previews
 * a goal being created (save `attitude` with the new goal). No Gemini call,
 * so it answers even when the AI is busy. Null when Buck_AI is unreachable.
 */
export async function detectGoalAttitude(
  goal: { goalId: string } | { targetAmount: number | string; savedAmount?: number; targetDate: string }
): Promise<GoalAttitude | null> {
  try {
    const body =
      "goalId" in goal
        ? goal
        : { targetAmount: Number(goal.targetAmount), savedAmount: goal.savedAmount ?? 0, targetDate: goal.targetDate };
    const response = await buckAiFetch("/advisor/attitude", { method: "POST", body: JSON.stringify(body) });
    if (!response.ok) return null;
    const data = (await response.json()) as GoalAttitude;
    return isSavingAttitude(data?.attitude) ? data : null;
  } catch {
    return null;
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
