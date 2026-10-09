"use client";

import React from "react";
import {
  FaBrain,
  FaRobot,
  FaBolt,
  FaBullseye,
  FaLightbulb,
  FaShieldAlt,
  FaCircle,
} from "react-icons/fa";

interface AIAdvisorPlaceholderCardProps {
  activeWalletBudget?: number | null;
  totalExpensesCount?: number;
}

export default function AIAdvisorPlaceholderCard({
  activeWalletBudget,
  totalExpensesCount = 0,
}: AIAdvisorPlaceholderCardProps) {
  return (
    <article
      className="interpretation-card ai-advisor-card"
      aria-label="AI Financial Advisor overview and status"
    >
      <div className="card-heading">
        <p className="card-eyebrow">Buck AI Intel</p>
        <div className="interpretation-title-row">
          <div className="ai-advisor-title-wrap">
            <h2 className="interpretation-title">AI Financial Advisor</h2>
            <span className="ai-advisor-subtitle">
              Predictive Cash Flow & Autonomous Spending Strategy
            </span>
          </div>
          <span className="ai-status-badge" aria-label="AI Status">
            <span className="ai-status-pulse-dot" aria-hidden="true" />
            <FaBrain aria-hidden="true" />
            Model Inference In Development
          </span>
        </div>
      </div>

      {/* Model Architecture & Telemetry Chips */}
      <div className="ai-model-telemetry-grid">
        <div className="ai-telemetry-item">
          <span className="ai-telemetry-label">Reasoning Engine</span>
          <div className="ai-telemetry-val-row">
            <FaBolt className="ai-telemetry-icon" aria-hidden="true" />
            <strong className="ai-telemetry-val">LLaMA 3.3 70B Turbo</strong>
          </div>
          <span className="ai-telemetry-sub">Zero-shot categorization & NLP reasoning</span>
        </div>

        <div className="ai-telemetry-item">
          <span className="ai-telemetry-label">Predictive Forecaster</span>
          <div className="ai-telemetry-val-row">
            <FaBrain className="ai-telemetry-icon" aria-hidden="true" />
            <strong className="ai-telemetry-val">Prophet Time-Series</strong>
          </div>
          <span className="ai-telemetry-sub">Algorithmic cash-flow & budget trajectory</span>
        </div>

        <div className="ai-telemetry-item">
          <span className="ai-telemetry-label">Analysis Cadence</span>
          <div className="ai-telemetry-val-row">
            <FaShieldAlt className="ai-telemetry-icon" aria-hidden="true" />
            <strong className="ai-telemetry-val">Continuous & Weekly</strong>
          </div>
          <span className="ai-telemetry-sub">Velocity audits against active wallet</span>
        </div>

        <div className="ai-telemetry-item">
          <span className="ai-telemetry-label">Currency Benchmark</span>
          <div className="ai-telemetry-val-row">
            <FaCircle className="ai-telemetry-icon ai-telemetry-icon--dot" aria-hidden="true" />
            <strong className="ai-telemetry-val">Philippine Peso (PHP)</strong>
          </div>
          <span className="ai-telemetry-sub">Localized financial heuristics & envelopes</span>
        </div>
      </div>

      {/* 3 Core AI Intelligence Capability Previews */}
      <div className="ai-capabilities-grid">
        <div className="ai-capability-card">
          <div className="ai-capability-header">
            <span className="ai-capability-icon-wrap ai-capability-icon-wrap--amber">
              <FaBolt aria-hidden="true" />
            </span>
            <h3 className="ai-capability-title">Runaway Category Alerts</h3>
          </div>
          <p className="ai-capability-desc">
            Continuous outlier detection algorithms audit transactions in real-time,
            flagging unusual category velocity (e.g., Food or Bills) before monthly limits
            are breached.
          </p>
        </div>

        <div className="ai-capability-card">
          <div className="ai-capability-header">
            <span className="ai-capability-icon-wrap ai-capability-icon-wrap--gold">
              <FaBullseye aria-hidden="true" />
            </span>
            <h3 className="ai-capability-title">Autonomous Goal Pacing</h3>
          </div>
          <p className="ai-capability-desc">
            Evaluates discretionary headroom in your active wallet and calculates
            optimal weekly transfers toward savings goals without triggering liquidity
            stress.
          </p>
        </div>

        <div className="ai-capability-card">
          <div className="ai-capability-header">
            <span className="ai-capability-icon-wrap ai-capability-icon-wrap--orange">
              <FaLightbulb aria-hidden="true" />
            </span>
            <h3 className="ai-capability-title">Concise 2-Sentence Advice</h3>
          </div>
          <p className="ai-capability-desc">
            Replaces generic financial platitudes with highly actionable, context-rich
            coaching recommendations tailored specifically to your tracked expenses.
          </p>
        </div>
      </div>

      {/* Shimmering Generative AI Calibration Notice Banner */}
      <div className="ai-calibration-banner">
        <div className="ai-calibration-icon-box" aria-hidden="true">
          <FaRobot />
        </div>
        <div className="ai-calibration-content">
          <div className="ai-calibration-header-line">
            <strong className="ai-calibration-title">
              Buck AI Advisory Pipeline · Calibrating
            </strong>
            <span className="ai-calibration-badge">
              <span className="ai-pulse-dot" aria-hidden="true" />
              Telemetry Pipeline Active ({totalExpensesCount} events ingested)
            </span>
          </div>
          <p className="ai-calibration-desc">
            The machine learning backend microservice is currently in development and model calibration.
            Once live inference is fully coupled, real-time autonomous recommendations, predictive
            category forecasting, and dynamic savings optimizations will generate directly into this card.
          </p>
        </div>
      </div>
    </article>
  );
}
