"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { FaCommentDots, FaFlag, FaMinus, FaPaperPlane, FaRedo, FaStop } from "react-icons/fa";
import { useToast } from "@/component/toast";
import { useDashboardUser } from "@/context/DashboardUserContext";
import { CHAT_HISTORY_MAX, CHAT_QUESTION_MAX, type ChatTurn } from "@/utils/aiChat";
import { streamAdvisorChat } from "@/utils/aiApi";
import { parseChatMarkdown, type InlineSpan } from "@/utils/chatMarkdown";
import { submitFeedback } from "@/utils/supabaseData";

type MessageStatus = "streaming" | "done" | "stopped" | "error";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  source?: "ai" | "fallback";
  error?: string;
  retryable?: boolean;
  /** The question this answer responds to (for retry and reports). */
  question?: string;
  reported?: boolean;
}

/** Copy shared with AIChatSkeleton so the skeleton matches 1:1. */
export const ADVISOR_CHAT_COPY = {
  eyebrow: "Ask the AI Advisor",
  title: "Questions about your money",
  intro: "Ask about your spending, budget or goals. The Advisor answers from your real Buck data and the advice it saved for you.",
  placeholder: "e.g. Can I afford a ₱3,000 purchase this week?",
  suggestions: [
    "Where is most of my money going this month?",
    "What should I cut back on first?",
    "How much should I set aside each week for my goal?",
  ],
};

let messageSeq = 0;
const nextId = () => `m${Date.now().toString(36)}${(messageSeq++).toString(36)}`;

function Inline({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((span, i) =>
        span.bold ? <strong key={i}>{span.text}</strong> : <Fragment key={i}>{span.text}</Fragment>
      )}
    </>
  );
}

function ChatMarkdown({ text }: { text: string }) {
  return (
    <>
      {parseChatMarkdown(text).map((block, i) => {
        if (block.kind === "paragraph") {
          return (
            <p key={i}>
              <Inline spans={block.spans} />
            </p>
          );
        }
        const List = block.ordered ? "ol" : "ul";
        return (
          <List key={i}>
            {block.items.map((item, j) => (
              <li key={j}>
                <Inline spans={item} />
              </li>
            ))}
          </List>
        );
      })}
    </>
  );
}

export interface AIChatProps {
  /** "card" sits in a page grid; "panel" fills the floating AIChatBubble panel. */
  variant?: "card" | "panel";
  /** Panel only: shows a minimize button in the header. */
  onClose?: () => void;
  /** Called after a reply finishes streaming (used for the bubble's unread dot). */
  onReplyDone?: () => void;
}

/** Element ids, shared with AIChatBubble (focus on open) and AIChatSkeleton. */
export const ADVISOR_CHAT_IDS = { title: "ai-chat-advisor-title", input: "ai-chat-advisor-input" };

/**
 * Streaming chat with Buck_AI's AI Financial Advisor (Gemini). The chat
 * itself is not stored; the last few turns are sent with each question, and
 * the Advisor grounds answers on live data plus the advice saved in the
 * database. The same endpoint serves the mobile app.
 */
export default function AIChat({ variant = "card", onClose, onReplyDone }: AIChatProps = {}) {
  const copy = ADVISOR_CHAT_COPY;
  const ids = ADVISOR_CHAT_IDS;
  const isPanel = variant === "panel";
  const { user } = useDashboardUser();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Stop any in-flight answer when leaving the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Panel: grow the question box with its text (up to 120px). While empty it
  // is sized to the placeholder, which wraps to two lines in a narrow panel.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el || !isPanel) return;
    const value = el.value;
    if (!value) el.value = el.placeholder;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, 120)}px`; // +2: borders
    if (!value) el.value = value;
  }, [draft, isPanel]);

  // Keep the newest text in view while streaming.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  const patch = (id: string, update: (m: ChatMessage) => ChatMessage) =>
    setMessages((current) => current.map((m) => (m.id === id ? update(m) : m)));

  const ask = async (question: string) => {
    const text = question.trim().slice(0, CHAT_QUESTION_MAX);
    if (!text || busy) return;

    // Only completed AI turns are useful context; fallback summaries and errors are not.
    const history: ChatTurn[] = messages
      .filter((m) => m.status === "done" && m.source !== "fallback" && m.content)
      .slice(-CHAT_HISTORY_MAX)
      .map((m) => ({ role: m.role, content: m.content }));

    const answerId = nextId();
    setMessages((current) => [
      ...current,
      { id: nextId(), role: "user", content: text, status: "done" },
      { id: answerId, role: "assistant", content: "", status: "streaming", question: text },
    ]);
    setDraft("");
    setBusy(true);
    setStatus("Buck is replying.");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamAdvisorChat(
        { question: text, history },
        (event) => {
          switch (event.type) {
            case "meta":
              patch(answerId, (m) => ({ ...m, source: event.source, content: "" }));
              break;
            case "delta":
              patch(answerId, (m) => ({ ...m, content: m.content + event.text }));
              break;
            case "error":
              patch(answerId, (m) => ({
                ...m,
                status: "error",
                error: event.message,
                retryable: event.retryable,
              }));
              break;
            case "done":
              patch(answerId, (m) => (m.status === "streaming" ? { ...m, status: "done" } : m));
              break;
          }
        },
        controller.signal
      );
      patch(answerId, (m) => (m.status === "streaming" ? { ...m, status: "done" } : m));
      setStatus("Reply finished.");
      onReplyDone?.();
    } catch {
      if (controller.signal.aborted) {
        patch(answerId, (m) => ({ ...m, status: "stopped" }));
        setStatus("Reply stopped.");
      } else {
        patch(answerId, (m) => ({
          ...m,
          status: "error",
          error: "Connection lost. Check your internet and try again.",
          retryable: true,
        }));
        setStatus("Reply failed.");
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(draft);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void ask(draft);
    }
  };

  const report = async (message: ChatMessage) => {
    if (message.reported) return;
    try {
      await submitFeedback(
        user.email ?? "unknown",
        "ai_response",
        "AI Advisor: inaccurate or unhelpful answer",
        `Question: ${message.question ?? ""}\n\nAnswer (${message.source ?? "ai"}):\n${message.content}`.slice(0, 4000)
      );
      patch(message.id, (m) => ({ ...m, reported: true }));
      toast("Thanks. The Buck team will review this answer.", "success");
    } catch {
      toast("Could not send the report. Try again later.", "error");
    }
  };

  return (
    <section
      className={isPanel ? "advisor-chat advisor-chat--panel" : "advisor-card advisor-chat"}
      aria-labelledby={ids.title}
    >
      <header className="advisor-chat__head">
        <span className="advisor-chat__icon">
          <FaCommentDots aria-hidden="true" />
        </span>
        <div className="advisor-chat__heading">
          <p className="advisor-chat__eyebrow">{copy.eyebrow}</p>
          <h3 id={ids.title}>{copy.title}</h3>
        </div>
        {isPanel && onClose ? (
          <button
            type="button"
            className="advisor-chat__minimize"
            onClick={onClose}
            aria-label="Minimize chat"
            title="Minimize (Esc)"
          >
            <FaMinus aria-hidden="true" />
          </button>
        ) : null}
      </header>

      <div
        ref={logRef}
        className="advisor-chat__log"
        role="log"
        aria-label="Conversation with the AI Advisor"
      >
        {messages.length === 0 ? (
          <div className="advisor-chat__empty">
            <p>{copy.intro}</p>
            <div className="advisor-chat__chips">
              {copy.suggestions.map((s) => (
                <button key={s} type="button" className="advisor-chat__chip" onClick={() => void ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="advisor-chat__msg advisor-chat__msg--user">
                {m.content}
              </div>
            ) : (
              <div
                key={m.id}
                className="advisor-chat__msg advisor-chat__msg--bot"
                aria-busy={m.status === "streaming"}
              >
                {m.source === "fallback" ? (
                  <span className="advisor-chat__badge">Offline summary</span>
                ) : null}
                {m.content ? (
                  <div className="advisor-chat__md">
                    <ChatMarkdown text={m.content} />
                    {m.status === "streaming" ? <span className="advisor-chat__caret" aria-hidden="true" /> : null}
                  </div>
                ) : m.status === "streaming" ? (
                  <span className="advisor-chat__typing" aria-label="Buck is thinking">
                    <i /> <i /> <i />
                  </span>
                ) : null}
                {m.status === "stopped" ? <p className="advisor-chat__note">Stopped.</p> : null}
                {m.status === "error" ? (
                  <div className="advisor-chat__error" role="alert">
                    <span>{m.error}</span>
                    {m.retryable && m.question ? (
                      <button type="button" onClick={() => void ask(m.question!)} disabled={busy}>
                        <FaRedo aria-hidden="true" /> Retry
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {(m.status === "done" || m.status === "stopped") && m.content ? (
                  <div className="advisor-chat__actions">
                    <button
                      type="button"
                      onClick={() => void report(m)}
                      disabled={m.reported}
                      title="Sends this question and answer to the Buck team for review"
                    >
                      <FaFlag aria-hidden="true" /> {m.reported ? "Reported" : "Report answer"}
                    </button>
                  </div>
                ) : null}
              </div>
            )
          )
        )}
      </div>

      <p className="advisor-chat__sr" aria-live="polite">
        {status}
      </p>

      <form className="advisor-chat__form" onSubmit={onSubmit}>
        <label htmlFor={ids.input} className="advisor-chat__sr">
          Your question
        </label>
        <textarea
          id={ids.input}
          ref={inputRef}
          rows={1}
          value={draft}
          maxLength={CHAT_QUESTION_MAX}
          placeholder={copy.placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {busy ? (
          <button
            type="button"
            className="advisor-chat__send advisor-chat__send--stop"
            onClick={() => abortRef.current?.abort()}
            aria-label="Stop answer"
          >
            <FaStop aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            className="advisor-chat__send"
            disabled={!draft.trim()}
            aria-label="Send question"
          >
            <FaPaperPlane aria-hidden="true" />
          </button>
        )}
      </form>

      <p className="advisor-chat__disclaimer">
        AI-generated by Google Gemini from your Buck data and can be wrong. Check amounts before acting. Not licensed financial advice.
      </p>
    </section>
  );
}
