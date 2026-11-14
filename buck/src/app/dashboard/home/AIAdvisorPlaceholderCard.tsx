"use client";

import React, { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { FaLightbulb, FaReceipt, FaArrowRight, FaChevronDown } from "react-icons/fa";
import { SPRING } from "@/utils/motion";
import { fetchAIAdvisorInsights, type AIAdvisorInsights } from "@/utils/advisorApi";
import { mergeDashboardDataCache, useFinancial } from "@/context/FinancialContext";

const COLLAPSED_KEY = "buck:home-advisor-collapsed";

/** Whether this browser last left the Home Advisor card minimized. */
export function readAdvisorCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

interface AIAdvisorPlaceholderCardProps {
  userId?: string;
  activeWalletBudget?: number | null;
  totalExpensesCount?: number;
}

export default function AIAdvisorPlaceholderCard({
  userId,
}: AIAdvisorPlaceholderCardProps) {
  const { dashboardCache, setDashboardCache } = useFinancial();
  const userCache = userId && dashboardCache.userId === userId ? dashboardCache : {};
  const [aiInsights, setAiInsights] = useState<AIAdvisorInsights | null>(
    () => userCache.aiInsights ?? null
  );
  const [loadingAi, setLoadingAi] = useState(
    () => !userCache.aiInsights && Boolean(userId)
  );
  const [collapsed, setCollapsed] = useState(false);

  // Read before paint so a minimized card never flashes open.
  useLayoutEffect(() => {
    setCollapsed(readAdvisorCollapsed());
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Blocked storage: the choice lasts for this visit only.
      }
      return next;
    });
  };

  useEffect(() => {
    if (!userId) {
      setLoadingAi(false);
      return;
    }

    if (userCache.aiInsights) {
      setAiInsights(userCache.aiInsights);
      setLoadingAi(false);
      return;
    }

    let active = true;
    setLoadingAi(true);

    fetchAIAdvisorInsights({ userId, forceRefresh: false })
      .then((insights) => {
        if (!active) return;
        setAiInsights(insights);
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, userId, {
            aiInsights: insights,
          })
        );
      })
      .catch((err) => {
        console.error("Home AI Advisor: could not load cached insights", err);
      })
      .finally(() => {
        if (active) {
          setLoadingAi(false);
        }
      });

    return () => {
      active = false;
    };
  }, [userId, userCache.aiInsights, setDashboardCache]);

  return (
    <article
      className={`interpretation-card ai-advisor-card${collapsed ? " is-collapsed" : ""}`}
      aria-label="AI Financial Advisor overview and recommendations"
    >
      <div className="home-ai-header">
        <div className="home-ai-header-info">
          <div className="home-ai-eyebrow-row">
            <p className="card-eyebrow">Financial Advisor</p>
            {aiInsights?.createdAt && (
              <span className="home-ai-timestamp">
                Updated{" "}
                {new Date(aiInsights.createdAt).toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          <h2 className="home-ai-title">Advice that sounds like a next step.</h2>
          <p className="home-ai-desc">
            Buck turns your current wallet, expense rhythm, and active goal into
            plain recommendations you can act on today.
          </p>
        </div>

        <div className="home-ai-header-actions">
          <Link
            href="/dashboard/financial-advisor"
            className="home-ai-link-btn"
            title="Open full Financial Advisor"
          >
            View Full Advisor <FaArrowRight aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="home-ai-toggle-btn"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls="home-ai-body"
            aria-label={collapsed ? "Expand the Advisor card" : "Minimize the Advisor card"}
            title={collapsed ? "Expand" : "Minimize"}
          >
            <motion.span
              className="home-ai-toggle-icon"
              animate={{ rotate: collapsed ? 0 : 180 }}
              transition={SPRING}
              aria-hidden="true"
            >
              <FaChevronDown />
            </motion.span>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            id="home-ai-body"
            key="home-ai-body"
            className="home-ai-body"
            initial={{ height: 0, opacity: 0, overflow: "hidden" }}
            animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={SPRING}
          >
      <div className="home-ai-grid">
        <section className="home-ai-card">
          <div className="home-ai-card-icon-wrap">
            <span className="advisor-icon" aria-hidden="true">
              <FaLightbulb />
            </span>
          </div>
          <div className="home-ai-card-content">
            <p className="advisor-eyebrow">AI Suggestion</p>
            <h3 className="home-ai-card-title">What to do next</h3>
            <p className="home-ai-card-text">
              {loadingAi
                ? "Analyzing your financial data..."
                : (aiInsights?.suggestion || "")}
            </p>
          </div>
        </section>

        <section className="home-ai-card">
          <div className="home-ai-card-icon-wrap">
            <span
              className="advisor-icon advisor-icon--gold"
              aria-hidden="true"
            >
              <FaReceipt />
            </span>
          </div>
          <div className="home-ai-card-content">
            <p className="advisor-eyebrow" style={{ color: "var(--buck-gold)" }}>
              AI Advice
            </p>
            <h3 className="home-ai-card-title">Detailed Analysis</h3>
            <p className="home-ai-card-text">
              {loadingAi
                ? "Generating deep-dive analysis..."
                : (aiInsights?.advice || "")}
            </p>
          </div>
        </section>
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
