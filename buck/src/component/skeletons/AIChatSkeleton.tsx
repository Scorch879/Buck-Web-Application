"use client";

import React from "react";
import { ADVISOR_CHAT_COPY } from "@/component/AIChat";

/**
 * 1:1 skeleton of AIChat's empty state: header (with the panel's minimize
 * slot), log with three suggestion chips, input row and disclaimer. Uses the
 * same classes and copy, so geometry matches by construction (ADR-012).
 * The chat now lives in the floating AIChatBubble panel; pass
 * `variant="panel"` to mirror that layout.
 */
export default function AIChatSkeleton({ variant = "card" }: { variant?: "card" | "panel" }) {
  const copy = ADVISOR_CHAT_COPY;
  const isPanel = variant === "panel";
  return (
    <section className={isPanel ? "advisor-chat advisor-chat--panel" : "advisor-card advisor-chat"}>
      <header className="advisor-chat__head">
        <span className="skeleton-avatar advisor-chat__icon" />
        <div className="advisor-chat__heading">
          <p className="advisor-chat__eyebrow"><span className="skeleton-text">{copy.eyebrow}</span></p>
          <h3><span className="skeleton-text">{copy.title}</span></h3>
        </div>
        {isPanel ? <span className="skeleton-button advisor-chat__minimize" /> : null}
      </header>
      <div className="advisor-chat__log">
        <div className="advisor-chat__empty">
          <p><span className="skeleton-text">{copy.intro}</span></p>
          <div className="advisor-chat__chips">
            {copy.suggestions.map((s) => (
              <span key={s} className="advisor-chat__chip skeleton-button">
                <span style={{ visibility: "hidden" }}>{s}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="advisor-chat__form">
        <span className="skeleton-line" style={{ flex: 1, height: 44, borderRadius: 10 }} />
        <span className="skeleton-button" style={{ width: 44, height: 44, borderRadius: 10 }} />
      </div>
      <p className="advisor-chat__disclaimer">
        <span className="skeleton-text">
          This comes from your Buck expenses, written by Google Gemini. AI might be inaccurate, so check the amounts before acting. It isn&apos;t licensed financial advice.
        </span>
      </p>
    </section>
  );
}
