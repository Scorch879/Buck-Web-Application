/**
 * Client contract for the AI Financial Advisor chat (Buck_AI `/advisor/chat`).
 * Limits mirror the service's validation (Buck_AI/BuckAI_Advisor/router.py).
 */

export const CHAT_QUESTION_MAX = 500;
export const CHAT_TURN_MAX = 1500;
export const CHAT_HISTORY_MAX = 8;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  question: string;
  history: ChatTurn[];
}

/** Events streamed by the Advisor, one per SSE `data:` line. */
export type ChatStreamEvent =
  | { type: "meta"; source: "ai" | "fallback" }
  | { type: "delta"; text: string }
  | { type: "error"; message: string; retryable: boolean }
  | { type: "done" };
