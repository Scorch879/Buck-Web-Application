"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaChartBar,
  FaCheckCircle,
  FaDatabase,
  FaEnvelopeOpenText,
  FaExclamationTriangle,
  FaHeartbeat,
  FaLock,
  FaRobot,
  FaServer,
  FaShieldAlt,
  FaSpinner,
  FaSyncAlt,
  FaUsers,
  FaWallet,
} from "react-icons/fa";
import { useOptionalDashboardUser } from "@/context/DashboardUserContext";
import { useFinancial } from "@/context/FinancialContext";
import { getAdminFeedback } from "@/utils/supabaseData";
import "@/app/dashboard/settings/style.css";
import "./style.css";
import CustomSelect from "@/component/CustomSelect";

type AdminTabId = "feedback" | "buck-ai" | "health" | "supabase" | "vercel";

type UnifiedAiLogEntry = {
  id: string;
  kind: "advisory" | "usage" | "forecast";
  timestamp: string;
  modelOrBucket: string;
  engine: "gemini" | "rules" | "rate-limit" | "forecast";
  title: string;
  detail: string;
  badgeText: string;
  userHash: string;
};

function formatAdminDate(value: string | number) {
  const date =
    typeof value === "number" && value > 1e14
      ? new Date(value / 1000)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCategoryLabel(category: string) {
  const normalized = category.trim().toLowerCase();
  if (normalized === "ai_response") return "AI Report";
  if (normalized === "feature") return "Feature";
  if (normalized === "bug") return "Bug";
  if (normalized === "question") return "Question";
  if (normalized === "general") return "General";
  return category || "Other";
}

function normalizeFeedbackCategory(category: string) {
  const lower = category.trim().toLowerCase();
  if (lower === "bug") return "bug";
  if (lower === "feature") return "feature";
  if (lower === "question") return "question";
  if (lower === "ai_response") return "ai_response";
  if (lower === "general" || lower === "other") return "general";
  return lower;
}

export default function AdminPage() {
  const user = useOptionalDashboardUser();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const {
    adminFeedback: feedback,
    adminVercelDeployments: vercelDeployments,
    adminSupabaseLogs: supabaseLogs,
    adminTelemetry: telemetry,
    adminVercelError: vercelError,
    adminSupabaseError: supabaseError,
    adminTelemetryError: telemetryError,
  } = dashboardCache;

  const [activeTab, setActiveTab] = useState<AdminTabId>("feedback");
  const [isFetchingFeedback, setIsFetchingFeedback] = useState(!feedback);
  const [isFetchingTelemetry, setIsFetchingTelemetry] = useState(!telemetry);
  const [isFetchingVercel, setIsFetchingVercel] = useState(!vercelDeployments);
  const [isFetchingSupabase, setIsFetchingSupabase] = useState(!supabaseLogs);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [filterCategory, setFilterCategory] = useState("all");
  const [aiEngineFilter, setAiEngineFilter] = useState("all");

  const fetchFeedbackData = useCallback(
    async (showSpinner = false) => {
      if (showSpinner || !feedback) setIsFetchingFeedback(true);
      setError("");
      try {
        const data = await getAdminFeedback();
        setDashboardCache((c) => ({ ...c, adminFeedback: data }));
      } catch {
        setError(
          "Failed to load feedback. Make sure the 'feedback' table exists in Supabase."
        );
      } finally {
        setIsFetchingFeedback(false);
      }
    },
    [feedback, setDashboardCache]
  );

  const fetchTelemetryData = useCallback(
    async (showSpinner = false) => {
      if (showSpinner || !telemetry) setIsFetchingTelemetry(true);
      try {
        const res = await fetch("/api/admin/overview", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) {
          setDashboardCache((c) => ({
            ...c,
            adminTelemetry: data,
            adminTelemetryError: undefined,
          }));
        } else {
          setDashboardCache((c) => ({
            ...c,
            adminTelemetryError:
              data.error || "Failed to fetch platform telemetry.",
          }));
        }
      } catch {
        setDashboardCache((c) => ({
          ...c,
          adminTelemetryError: "Could not reach /api/admin/overview.",
        }));
      } finally {
        setIsFetchingTelemetry(false);
      }
    },
    [telemetry, setDashboardCache]
  );

  const fetchSupabaseLogs = useCallback(
    async (showSpinner = false) => {
      if (showSpinner || !supabaseLogs) setIsFetchingSupabase(true);
      try {
        const res = await fetch("/api/admin/supabase", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) {
          setDashboardCache((c) => ({
            ...c,
            adminSupabaseLogs: data.logs || [],
            adminSupabaseError: undefined,
          }));
        } else {
          setDashboardCache((c) => ({
            ...c,
            adminSupabaseError: data.error || "Failed to fetch Supabase logs.",
          }));
        }
      } catch {
        setDashboardCache((c) => ({
          ...c,
          adminSupabaseError: "Fetch error",
        }));
      } finally {
        setIsFetchingSupabase(false);
      }
    },
    [supabaseLogs, setDashboardCache]
  );

  const fetchVercelDeployments = useCallback(
    async (showSpinner = false) => {
      if (showSpinner || !vercelDeployments) setIsFetchingVercel(true);
      try {
        const res = await fetch("/api/admin/vercel", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) {
          setDashboardCache((c) => ({
            ...c,
            adminVercelDeployments: data.deployments || [],
            adminVercelError: undefined,
          }));
        } else {
          setDashboardCache((c) => ({
            ...c,
            adminVercelError: data.error || "Failed to fetch Vercel data.",
          }));
        }
      } catch {
        setDashboardCache((c) => ({
          ...c,
          adminVercelError: "Fetch error",
        }));
      } finally {
        setIsFetchingVercel(false);
      }
    },
    [vercelDeployments, setDashboardCache]
  );

  useEffect(() => {
    if (!user) return;

    if (activeTab === "feedback" && !feedback) {
      void fetchFeedbackData();
    } else if (
      (activeTab === "buck-ai" || activeTab === "health") &&
      !telemetry
    ) {
      void fetchTelemetryData();
    } else if (activeTab === "supabase" && !supabaseLogs) {
      void fetchSupabaseLogs();
    } else if (activeTab === "vercel" && !vercelDeployments) {
      void fetchVercelDeployments();
    }
    // Only trigger when switching tabs or signing in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeTab]);

  useEffect(() => {
    setSearchQuery("");
    setFilterCategory("all");
    setAiEngineFilter("all");
  }, [activeTab]);

  const adminTabs = [
    {
      id: "feedback" as const,
      label: "User Feedback",
      icon: FaEnvelopeOpenText,
      description:
        "Anonymous user feedback with SHA-256 hashed identity verification.",
    },
    {
      id: "buck-ai" as const,
      label: "Buck_AI Status & Logs",
      icon: FaRobot,
      description:
        "Live Buck_AI deployment status, Gemini model telemetry, and anonymized AI data logs.",
    },
    {
      id: "health" as const,
      label: "Website Health & Analytics",
      icon: FaHeartbeat,
      description:
        "Real-time service latency probes, platform volume analytics, and security audit monitoring.",
    },
    {
      id: "supabase" as const,
      label: "Supabase Logs",
      icon: FaDatabase,
      description: "Live auth logs from your Postgres database.",
    },
    {
      id: "vercel" as const,
      label: "Vercel Deployments",
      icon: FaServer,
      description: "Track your recent project builds and deployment states.",
    },
  ];

  const activeTabMeta =
    adminTabs.find((t) => t.id === activeTab) || adminTabs[0];
  const ActiveIcon = activeTabMeta.icon;

  // 1. Filtered anonymous feedback (never matches or displays user_email)
  const filteredFeedback = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (feedback ?? [])
      .filter((item) => {
        const matchesSearch =
          !q ||
          item.title.toLowerCase().includes(q) ||
          item.details.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q);
        const normalizedCat = normalizeFeedbackCategory(item.category);
        const matchesCategory =
          filterCategory === "all" || normalizedCat === filterCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) =>
        sortOrder === "newest"
          ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
  }, [feedback, searchQuery, filterCategory, sortOrder]);

  const feedbackCounts = useMemo(() => {
    const list = feedback ?? [];
    let bug = 0;
    let feature = 0;
    let aiReport = 0;
    let other = 0;
    for (const item of list) {
      const cat = normalizeFeedbackCategory(item.category);
      if (cat === "bug") bug += 1;
      else if (cat === "feature") feature += 1;
      else if (cat === "ai_response") aiReport += 1;
      else other += 1;
    }
    return { total: list.length, bug, feature, aiReport, other };
  }, [feedback]);

  // 2. Unified Buck_AI Data Logs stream
  const unifiedAiLogs = useMemo<UnifiedAiLogEntry[]>(() => {
    if (!telemetry) return [];
    const entries: UnifiedAiLogEntry[] = [];

    for (const adv of telemetry.buckAi.recent_advisories) {
      const engine = adv.generated_with === "rules" ? "rules" : "gemini";
      entries.push({
        id: `adv-${adv.id}`,
        kind: "advisory",
        timestamp: adv.created_at,
        modelOrBucket: adv.model_name,
        engine,
        title: `Advisory (${adv.advisory_type.replace(/_/g, " ")}) · Focus: ${adv.focus}`,
        detail: `Priority: ${adv.priority.toUpperCase()} · Health Score: ${
          adv.financial_health_score ?? "—"
        }/100 · Trigger: ${adv.generated_by}`,
        badgeText: engine === "gemini" ? "GEMINI LLM" : "RULES FALLBACK",
        userHash: adv.user_hash,
      });
    }

    for (const u of telemetry.buckAi.recent_usage_events) {
      entries.push({
        id: `use-${u.id}`,
        kind: "usage",
        timestamp: u.created_at,
        modelOrBucket: `bucket:${u.bucket}`,
        engine: "rate-limit",
        title: `AI Rate-Limit Event · Bucket: ${u.bucket.toUpperCase()}`,
        detail: `Sliding-window token consumed via ai_rate_limit_take('${u.bucket}')`,
        badgeText: `RATE LIMIT · ${u.bucket.toUpperCase()}`,
        userHash: u.user_hash,
      });
    }

    for (const fc of telemetry.buckAi.recent_forecasts) {
      entries.push({
        id: `fc-${fc.id}`,
        kind: "forecast",
        timestamp: fc.created_at,
        modelOrBucket: fc.model_name,
        engine: "forecast",
        title: `Forecast Run (${fc.period_type})`,
        detail: `Confidence: ${
          fc.confidence_score !== null
            ? `${Math.round(Number(fc.confidence_score) * 100)}%`
            : "Standard"
        } · Trigger: ${fc.generated_by}`,
        badgeText: "FORECAST",
        userHash: fc.user_hash,
      });
    }

    const q = searchQuery.trim().toLowerCase();
    return entries
      .filter((entry) => {
        if (filterCategory !== "all" && entry.kind !== filterCategory) {
          return false;
        }
        if (aiEngineFilter !== "all" && entry.engine !== aiEngineFilter) {
          return false;
        }
        if (!q) return true;
        return (
          entry.title.toLowerCase().includes(q) ||
          entry.detail.toLowerCase().includes(q) ||
          entry.modelOrBucket.toLowerCase().includes(q) ||
          entry.userHash.toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        sortOrder === "newest"
          ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  }, [telemetry, searchQuery, filterCategory, aiEngineFilter, sortOrder]);

  // 3. Filtered Security Audit Events (Website Health tab)
  const filteredSecurityEvents = useMemo(() => {
    const events = telemetry?.security.recent_events ?? [];
    const q = searchQuery.trim().toLowerCase();
    return events
      .filter((ev) => {
        if (filterCategory !== "all" && ev.outcome !== filterCategory) {
          return false;
        }
        if (!q) return true;
        return (
          ev.event_type.toLowerCase().includes(q) ||
          ev.outcome.toLowerCase().includes(q) ||
          ev.actor_hash.toLowerCase().includes(q) ||
          ev.ip_hash.toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        sortOrder === "newest"
          ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
  }, [telemetry, searchQuery, filterCategory, sortOrder]);

  // 4. Filtered Supabase Logs
  const filteredSupabaseLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (supabaseLogs ?? [])
      .filter((log) => !q || log.event_message?.toLowerCase().includes(q))
      .sort((a, b) =>
        sortOrder === "newest"
          ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  }, [supabaseLogs, searchQuery, sortOrder]);

  // 5. Filtered Vercel Deployments
  const filteredVercelDeployments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (vercelDeployments ?? [])
      .filter((dep) => {
        const matchesSearch =
          !q ||
          dep.url?.toLowerCase().includes(q) ||
          dep.meta?.githubCommitRef?.toLowerCase().includes(q);
        const matchesCategory =
          filterCategory === "all" || dep.state === filterCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) =>
        sortOrder === "newest"
          ? new Date(b.created).getTime() - new Date(a.created).getTime()
          : new Date(a.created).getTime() - new Date(b.created).getTime()
      );
  }, [vercelDeployments, searchQuery, filterCategory, sortOrder]);

  const handleRefreshActiveTab = () => {
    if (activeTab === "feedback") void fetchFeedbackData(true);
    else if (activeTab === "buck-ai" || activeTab === "health")
      void fetchTelemetryData(true);
    else if (activeTab === "supabase") void fetchSupabaseLogs(true);
    else if (activeTab === "vercel") void fetchVercelDeployments(true);
  };

  const isRefreshingActive =
    (activeTab === "feedback" && isFetchingFeedback) ||
    ((activeTab === "buck-ai" || activeTab === "health") &&
      isFetchingTelemetry) ||
    (activeTab === "supabase" && isFetchingSupabase) ||
    (activeTab === "vercel" && isFetchingVercel);

  if (!user) {
    return null;
  }

  const totalAdvisories = telemetry?.buckAi.advisories_total ?? 0;
  const geminiAdvisories = telemetry?.buckAi.advisories_gemini ?? 0;
  const rulesAdvisories = telemetry?.buckAi.advisories_rules ?? 0;
  const geminiSharePct =
    totalAdvisories > 0
      ? Math.round((geminiAdvisories / totalAdvisories) * 100)
      : 0;
  const activeModelSet = new Set(
    (telemetry?.buckAi.model_breakdown ?? []).map((m) => m.model_name)
  );

  return (
    <div className="admin-page">
      {error && (
        <div
          style={{
            color: "#a81919",
            background: "rgba(255, 56, 56, 0.14)",
            padding: "1rem",
            borderRadius: "8px",
            border: "1px solid rgba(255, 56, 56, 0.34)",
            marginBottom: "0.25rem",
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      <section className="settings-shell" style={{ flex: 1, minHeight: 0 }}>
        <nav
          className="settings-tabs"
          aria-label="Admin sections"
          style={{
            position: "sticky",
            top: "clamp(0.78rem, 1.35vw, 0.95rem)",
          }}
        >
          {adminTabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                className={`settings-tab${
                  isActive ? " settings-tab--active" : ""
                }`}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={isActive}
              >
                <TabIcon aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "clamp(0.7rem, 1.4vw, 0.95rem)",
            flex: 1,
            minHeight: 0,
            alignSelf: "stretch",
          }}
        >
          <article className="settings-card settings-card--panel admin-stretch-card">
            <div className="admin-card-header-row">
              <div className="settings-card-heading settings-card-heading--wide">
                <span aria-hidden="true">
                  <ActiveIcon />
                </span>
                <div>
                  <h2>{activeTabMeta.label}</h2>
                  <p>{activeTabMeta.description}</p>
                </div>
              </div>

              <button
                type="button"
                className="admin-refresh-btn"
                onClick={handleRefreshActiveTab}
                disabled={isRefreshingActive}
                aria-label="Refresh current view"
              >
                <FaSyncAlt
                  aria-hidden="true"
                  style={
                    isRefreshingActive
                      ? { animation: "spin 1s linear infinite" }
                      : undefined
                  }
                />
                <span>{isRefreshingActive ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>

            {/* ---------------------------------------------------------------
                TAB 1: ANONYMOUS USER FEEDBACK
               --------------------------------------------------------------- */}
            {activeTab === "feedback" && (
              <>
                <div className="admin-kpi-grid admin-kpi-grid--compact">
                  <div className="admin-kpi-card">
                    <div className="admin-kpi-top">
                      <span className="admin-kpi-label">Total Feedback</span>
                      <span className="admin-kpi-icon">
                        <FaEnvelopeOpenText aria-hidden="true" />
                      </span>
                    </div>
                    <div className="admin-kpi-value">{feedbackCounts.total}</div>
                    <div className="admin-kpi-sub">
                      100% SHA-256 hashed in DB
                    </div>
                  </div>

                  <div className="admin-kpi-card">
                    <div className="admin-kpi-top">
                      <span className="admin-kpi-label">Bug Reports</span>
                      <span className="admin-kpi-icon">
                        <FaExclamationTriangle aria-hidden="true" />
                      </span>
                    </div>
                    <div className="admin-kpi-value">{feedbackCounts.bug}</div>
                    <div className="admin-kpi-sub">
                      Issues &amp; defect reports
                    </div>
                  </div>

                  <div className="admin-kpi-card">
                    <div className="admin-kpi-top">
                      <span className="admin-kpi-label">Feature Ideas</span>
                      <span className="admin-kpi-icon">
                        <FaChartBar aria-hidden="true" />
                      </span>
                    </div>
                    <div className="admin-kpi-value">
                      {feedbackCounts.feature}
                    </div>
                    <div className="admin-kpi-sub">
                      User enhancement requests
                    </div>
                  </div>

                  <div className="admin-kpi-card">
                    <div className="admin-kpi-top">
                      <span className="admin-kpi-label">
                        AI &amp; General Notes
                      </span>
                      <span className="admin-kpi-icon">
                        <FaShieldAlt aria-hidden="true" />
                      </span>
                    </div>
                    <div className="admin-kpi-value">
                      {feedbackCounts.aiReport + feedbackCounts.other}
                    </div>
                    <div className="admin-kpi-sub">
                      {feedbackCounts.aiReport} AI advisor reports
                    </div>
                  </div>
                </div>

                <div className="admin-toolbar">
                  <input
                    type="search"
                    className="admin-search-input"
                    placeholder="Search feedback title, details, or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  <CustomSelect
                    fit
                    value={filterCategory}
                    onChange={(val) => setFilterCategory(val)}
                    options={[
                      { value: "all", label: "All Categories" },
                      { value: "bug", label: "Bug Reports" },
                      { value: "feature", label: "Feature Ideas" },
                      { value: "ai_response", label: "AI Advisor Reports" },
                      { value: "question", label: "Questions" },
                      { value: "general", label: "General / Other" },
                    ]}
                    className="admin-filter-select"
                  />

                  <CustomSelect
                    fit
                    value={sortOrder}
                    onChange={(val) =>
                      setSortOrder(val as "newest" | "oldest")
                    }
                    options={[
                      { value: "newest", label: "Newest First" },
                      { value: "oldest", label: "Oldest First" },
                    ]}
                    className="admin-filter-select"
                  />
                </div>

                {isFetchingFeedback ? (
                  <div className="admin-placeholder-box">
                    <FaSpinner
                      aria-hidden="true"
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    <p>Loading anonymous feedback...</p>
                  </div>
                ) : filteredFeedback.length > 0 ? (
                  <div className="admin-feedback-list">
                    {filteredFeedback.map((item) => (
                      <div key={item.id} className="admin-feedback-item">
                        <div className="admin-feedback-meta">
                          <div className="admin-feedback-badges">
                            <span className="admin-feedback-category">
                              {formatCategoryLabel(item.category)}
                            </span>
                            <span
                              className="admin-anon-badge"
                              title="Sender identity is SHA-256 hashed in Postgres; plaintext email is never stored or displayed."
                            >
                              <FaLock aria-hidden="true" />
                              Anonymous · SHA-256 Verified
                            </span>
                          </div>
                          <span>{formatAdminDate(item.created_at)}</span>
                        </div>
                        <h3 className="admin-feedback-title">{item.title}</h3>
                        <p className="admin-feedback-details">{item.details}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="admin-placeholder-box">
                    <p>No feedback matching your filters.</p>
                  </div>
                )}
              </>
            )}

            {/* ---------------------------------------------------------------
                TAB 2: BUCK_AI DEPLOYMENT STATUS, TELEMETRY & DATA LOGS
               --------------------------------------------------------------- */}
            {activeTab === "buck-ai" && (
              <div className="admin-panel-scroll">
                {isFetchingTelemetry && !telemetry ? (
                  <div className="admin-placeholder-box">
                    <FaSpinner
                      aria-hidden="true"
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    <p>Probing Buck_AI deployment &amp; loading AI telemetry...</p>
                  </div>
                ) : telemetryError && !telemetry ? (
                  <div className="admin-placeholder-box">
                    <FaRobot aria-hidden="true" />
                    <h3>Telemetry Unavailable</h3>
                    <p>{telemetryError}</p>
                  </div>
                ) : telemetry ? (
                  <>
                    {/* Live Buck_AI Deployment Banner */}
                    <div className="admin-ai-banner">
                      <div className="admin-ai-banner-main">
                        <div className="admin-ai-banner-title">
                          <span>Buck_AI FastAPI Service</span>
                          <span
                            className={`admin-status-pill admin-status-pill--${telemetry.services.buckAi.status}`}
                          >
                            {telemetry.services.buckAi.status}
                          </span>
                        </div>
                        <span className="admin-ai-banner-sub">
                          {telemetry.services.buckAi.message}
                        </span>
                      </div>

                      <div className="admin-ai-banner-metrics">
                        <span className="admin-metric-chip">
                          Endpoint: {telemetry.services.buckAi.endpoint || "—"}
                        </span>
                        <span className="admin-metric-chip">
                          Probe Latency:{" "}
                          {telemetry.services.buckAi.latencyMs !== null
                            ? `${telemetry.services.buckAi.latencyMs} ms`
                            : "—"}
                        </span>
                        <span className="admin-metric-chip">
                          Fallback: {telemetry.services.buckAi.fallbackEngine}
                        </span>
                      </div>
                    </div>

                    {/* Buck_AI KPI Grid */}
                    <div className="admin-kpi-grid">
                      <div className="admin-kpi-card">
                        <div className="admin-kpi-top">
                          <span className="admin-kpi-label">
                            AI Advisories Saved
                          </span>
                          <span className="admin-kpi-icon">
                            <FaRobot aria-hidden="true" />
                          </span>
                        </div>
                        <div className="admin-kpi-value">{totalAdvisories}</div>
                        <div className="admin-kpi-sub">
                          +{telemetry.buckAi.advisories_24h} in 24h · +
                          {telemetry.buckAi.advisories_7d} in 7d
                        </div>
                      </div>

                      <div className="admin-kpi-card">
                        <div className="admin-kpi-top">
                          <span className="admin-kpi-label">
                            Gemini vs. Rules
                          </span>
                          <span className="admin-kpi-icon">
                            <FaCheckCircle aria-hidden="true" />
                          </span>
                        </div>
                        <div className="admin-kpi-value">{geminiSharePct}%</div>
                        <div className="admin-kpi-sub">
                          {geminiAdvisories} LLM · {rulesAdvisories} deterministic
                          rules
                        </div>
                      </div>

                      <div className="admin-kpi-card">
                        <div className="admin-kpi-top">
                          <span className="admin-kpi-label">
                            24h Rate-Limit Calls
                          </span>
                          <span className="admin-kpi-icon">
                            <FaChartBar aria-hidden="true" />
                          </span>
                        </div>
                        <div className="admin-kpi-value">
                          {telemetry.buckAi.usage_24h.total}
                        </div>
                        <div className="admin-kpi-sub">
                          Chat {telemetry.buckAi.usage_24h.chat} · Insight{" "}
                          {telemetry.buckAi.usage_24h.insight} · Tip{" "}
                          {telemetry.buckAi.usage_24h.tip} · Cat{" "}
                          {telemetry.buckAi.usage_24h.categorize}
                        </div>
                      </div>

                      <div className="admin-kpi-card">
                        <div className="admin-kpi-top">
                          <span className="admin-kpi-label">
                            Forecasts &amp; Avg Health
                          </span>
                          <span className="admin-kpi-icon">
                            <FaHeartbeat aria-hidden="true" />
                          </span>
                        </div>
                        <div className="admin-kpi-value">
                          {telemetry.buckAi.forecasts_active} /{" "}
                          {telemetry.buckAi.forecasts_total}
                        </div>
                        <div className="admin-kpi-sub">
                          Avg Financial Health Score:{" "}
                          {telemetry.buckAi.avg_health_score}/100
                        </div>
                      </div>
                    </div>

                    {/* Model Distribution & Rate-Limit Buckets */}
                    <div className="admin-split-grid">
                      <div className="admin-subpanel">
                        <div>
                          <h3 className="admin-subpanel-title">
                            <span>Model Serving Distribution</span>
                            <span className="admin-subpanel-subtitle">
                              {telemetry.buckAi.model_breakdown.length} models
                              recorded
                            </span>
                          </h3>
                        </div>

                        {telemetry.buckAi.model_breakdown.length > 0 ? (
                          <div className="admin-bar-list">
                            {telemetry.buckAi.model_breakdown.map((m) => {
                              const pct =
                                totalAdvisories > 0
                                  ? Math.round((m.count / totalAdvisories) * 100)
                                  : 0;
                              return (
                                <div key={m.model_name} className="admin-bar-row">
                                  <div className="admin-bar-meta">
                                    <span className="admin-bar-name">
                                      {m.model_name}
                                    </span>
                                    <span className="admin-bar-count">
                                      {m.count} ({pct}%)
                                    </span>
                                  </div>
                                  <div className="admin-bar-track">
                                    <div
                                      className="admin-bar-fill"
                                      style={{ width: `${Math.max(pct, 4)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="admin-log-muted">
                            No model executions recorded yet.
                          </p>
                        )}

                        <div>
                          <span className="admin-subpanel-subtitle">
                            Configured 11-Model Fallback Chain (Buck_AI):
                          </span>
                          <div
                            className="admin-chip-cloud"
                            style={{ marginTop: "0.4rem" }}
                          >
                            {telemetry.services.buckAi.configuredModels.map(
                              (modelName) => (
                                <span
                                  key={modelName}
                                  className={`admin-model-tag${
                                    activeModelSet.has(modelName)
                                      ? " admin-model-tag--active"
                                      : ""
                                  }`}
                                >
                                  {modelName}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="admin-subpanel">
                        <div>
                          <h3 className="admin-subpanel-title">
                            <span>24h Rate-Limit Buckets &amp; Priorities</span>
                            <span className="admin-subpanel-subtitle">
                              Sliding window (ai_usage_events)
                            </span>
                          </h3>
                        </div>

                        <div className="admin-bar-list">
                          {(
                            [
                              {
                                key: "insight",
                                label: "Advisor Insights (/advisor/insight)",
                                count: telemetry.buckAi.usage_24h.insight,
                              },
                              {
                                key: "chat",
                                label: "Advisor Streaming Chat (/advisor/chat)",
                                count: telemetry.buckAi.usage_24h.chat,
                              },
                              {
                                key: "tip",
                                label: "Goal Tips (/advisor/goal-tip)",
                                count: telemetry.buckAi.usage_24h.tip,
                              },
                              {
                                key: "categorize",
                                label: "Auto-Categorize (/advisor/categorize)",
                                count: telemetry.buckAi.usage_24h.categorize,
                              },
                            ] as const
                          ).map((bucket) => {
                            const total24 = Math.max(
                              telemetry.buckAi.usage_24h.total,
                              1
                            );
                            const pct = Math.round(
                              (bucket.count / total24) * 100
                            );
                            return (
                              <div key={bucket.key} className="admin-bar-row">
                                <div className="admin-bar-meta">
                                  <span>{bucket.label}</span>
                                  <span className="admin-bar-count">
                                    {bucket.count} calls
                                  </span>
                                </div>
                                <div className="admin-bar-track">
                                  <div
                                    className="admin-bar-fill admin-bar-fill--secondary"
                                    style={{
                                      width: `${
                                        bucket.count > 0 ? Math.max(pct, 6) : 0
                                      }%`,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div
                          style={{
                            borderTop: "1px dashed var(--buck-line)",
                            paddingTop: "0.65rem",
                          }}
                        >
                          <span className="admin-subpanel-subtitle">
                            Advisory Priority Breakdown:
                          </span>
                          <div
                            className="admin-chip-cloud"
                            style={{ marginTop: "0.4rem" }}
                          >
                            <span className="admin-metric-chip">
                              Urgent: {telemetry.buckAi.priority_breakdown.urgent}
                            </span>
                            <span className="admin-metric-chip">
                              High: {telemetry.buckAi.priority_breakdown.high}
                            </span>
                            <span className="admin-metric-chip">
                              Medium: {telemetry.buckAi.priority_breakdown.medium}
                            </span>
                            <span className="admin-metric-chip">
                              Low: {telemetry.buckAi.priority_breakdown.low}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Anonymized Buck_AI Data Logs */}
                    <div className="admin-subpanel">
                      <div className="admin-subpanel-title">
                        <span>Buck_AI Data &amp; Execution Logs (Anonymized)</span>
                        <span className="admin-subpanel-subtitle">
                          {unifiedAiLogs.length} events shown
                        </span>
                      </div>

                      <div className="admin-toolbar" style={{ marginBottom: "0.4rem" }}>
                        <input
                          type="search"
                          className="admin-search-input"
                          placeholder="Search model, bucket, focus, or user hash..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />

                        <CustomSelect
                          fit
                          value={filterCategory}
                          onChange={(val) => setFilterCategory(val)}
                          options={[
                            { value: "all", label: "All AI Log Streams" },
                            { value: "advisory", label: "Advisory Generations" },
                            { value: "usage", label: "Rate-Limit Events" },
                            { value: "forecast", label: "Forecast Runs" },
                          ]}
                          className="admin-filter-select"
                        />

                        <CustomSelect
                          fit
                          value={aiEngineFilter}
                          onChange={(val) => setAiEngineFilter(val)}
                          options={[
                            { value: "all", label: "All Engines" },
                            { value: "gemini", label: "Gemini LLM" },
                            { value: "rules", label: "Rules Fallback" },
                            { value: "rate-limit", label: "Rate Limiter" },
                            { value: "forecast", label: "Forecast Engine" },
                          ]}
                          className="admin-filter-select"
                        />

                        <CustomSelect
                          fit
                          value={sortOrder}
                          onChange={(val) =>
                            setSortOrder(val as "newest" | "oldest")
                          }
                          options={[
                            { value: "newest", label: "Newest First" },
                            { value: "oldest", label: "Oldest First" },
                          ]}
                          className="admin-filter-select"
                        />
                      </div>

                      {unifiedAiLogs.length > 0 ? (
                        <div
                          className="admin-feedback-list"
                          style={{ maxHeight: "380px" }}
                        >
                          {unifiedAiLogs.map((entry) => (
                            <div key={entry.id} className="admin-log-item">
                              <div className="admin-log-row">
                                <div className="admin-log-badges">
                                  <span
                                    className={`admin-log-badge ${
                                      entry.engine === "gemini"
                                        ? "admin-log-badge--gemini"
                                        : entry.engine === "rules"
                                        ? "admin-log-badge--rules"
                                        : "admin-log-badge--info"
                                    }`}
                                  >
                                    {entry.badgeText}
                                  </span>
                                  <span className="admin-log-mono">
                                    {entry.modelOrBucket}
                                  </span>
                                  <span className="admin-log-muted">
                                    usr_#{entry.userHash}
                                  </span>
                                </div>
                                <span className="admin-log-muted">
                                  {formatAdminDate(entry.timestamp)}
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: "0.86rem",
                                  fontWeight: 600,
                                  color: "var(--buck-ink)",
                                }}
                              >
                                {entry.title}
                              </div>
                              <div className="admin-log-muted">{entry.detail}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="admin-placeholder-box">
                          <p>No Buck_AI log entries match the current filter.</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {/* ---------------------------------------------------------------
                TAB 3: WEBSITE HEALTH, PLATFORM ANALYTICS & SECURITY MONITOR
               --------------------------------------------------------------- */}
            {activeTab === "health" && (
              <div className="admin-panel-scroll">
                {isFetchingTelemetry && !telemetry ? (
                  <div className="admin-placeholder-box">
                    <FaSpinner
                      aria-hidden="true"
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    <p>Running website health probes &amp; loading analytics...</p>
                  </div>
                ) : telemetryError && !telemetry ? (
                  <div className="admin-placeholder-box">
                    <FaHeartbeat aria-hidden="true" />
                    <h3>Health Check Failed</h3>
                    <p>{telemetryError}</p>
                  </div>
                ) : telemetry ? (
                  <>
                    {/* Live Service Health Probes */}
                    <div className="admin-health-grid">
                      {[
                        {
                          key: "web",
                          title: "Next.js Web App",
                          icon: FaServer,
                          health: telemetry.services.webApp,
                          extra: `Env: ${telemetry.services.webApp.environment} · Region: ${telemetry.services.webApp.region}`,
                        },
                        {
                          key: "db",
                          title: "Supabase Postgres 17",
                          icon: FaDatabase,
                          health: telemetry.services.supabaseDb,
                          extra: "RLS + private.mfa_satisfied() active",
                        },
                        {
                          key: "auth",
                          title: "Supabase Auth & MFA",
                          icon: FaShieldAlt,
                          health: telemetry.services.supabaseAuth,
                          extra: "JWT + AAL2 + OAuth 2.1 Server",
                        },
                        {
                          key: "ai",
                          title: "Buck_AI Microservice",
                          icon: FaRobot,
                          health: telemetry.services.buckAi,
                          extra: `${telemetry.services.buckAi.configuredModels.length} Gemini models + Rule fallback`,
                        },
                      ].map((svc) => {
                        const SvcIcon = svc.icon;
                        return (
                          <div
                            key={svc.key}
                            className={`admin-service-card admin-service-card--${svc.health.status}`}
                          >
                            <div className="admin-service-head">
                              <h3 className="admin-service-title">
                                <SvcIcon aria-hidden="true" />
                                <span>{svc.title}</span>
                              </h3>
                              <span
                                className={`admin-status-pill admin-status-pill--${svc.health.status}`}
                              >
                                {svc.health.status}
                              </span>
                            </div>
                            <span className="admin-service-endpoint">
                              {svc.health.endpoint}
                            </span>
                            <p className="admin-service-desc">
                              {svc.health.message}
                            </p>
                            <div className="admin-service-footer">
                              <span>
                                Latency:{" "}
                                {svc.health.latencyMs !== null
                                  ? `${svc.health.latencyMs} ms`
                                  : "N/A"}
                              </span>
                              <span>{svc.extra}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Platform Volume & Analytical KPIs */}
                    <div className="admin-subpanel">
                      <div className="admin-subpanel-title">
                        <span>
                          Platform Volume &amp; Analytical Data (Aggregate)
                        </span>
                        <span className="admin-subpanel-subtitle">
                          Zero-PII aggregate metrics across all accounts
                        </span>
                      </div>

                      <div className="admin-kpi-grid">
                        <div className="admin-kpi-card">
                          <div className="admin-kpi-top">
                            <span className="admin-kpi-label">
                              Registered Users
                            </span>
                            <span className="admin-kpi-icon">
                              <FaUsers aria-hidden="true" />
                            </span>
                          </div>
                          <div className="admin-kpi-value">
                            {telemetry.platform.total_users}
                          </div>
                          <div className="admin-kpi-sub">
                            Confirmed profiles in public.profiles
                          </div>
                        </div>

                        <div className="admin-kpi-card">
                          <div className="admin-kpi-top">
                            <span className="admin-kpi-label">
                              2FA &amp; OAuth Security
                            </span>
                            <span className="admin-kpi-icon">
                              <FaShieldAlt aria-hidden="true" />
                            </span>
                          </div>
                          <div className="admin-kpi-value">
                            {telemetry.platform.mfa_enabled_users} 2FA
                          </div>
                          <div className="admin-kpi-sub">
                            {telemetry.platform.connected_oauth_apps} active OAuth
                            2.1 app grants
                          </div>
                        </div>

                        <div className="admin-kpi-card">
                          <div className="admin-kpi-top">
                            <span className="admin-kpi-label">
                              Active Wallets
                            </span>
                            <span className="admin-kpi-icon">
                              <FaWallet aria-hidden="true" />
                            </span>
                          </div>
                          <div className="admin-kpi-value">
                            {telemetry.platform.total_wallets}
                          </div>
                          <div className="admin-kpi-sub">
                            {telemetry.platform.total_categories} custom
                            categories
                          </div>
                        </div>

                        <div className="admin-kpi-card">
                          <div className="admin-kpi-top">
                            <span className="admin-kpi-label">
                              Ledger Transactions
                            </span>
                            <span className="admin-kpi-icon">
                              <FaChartBar aria-hidden="true" />
                            </span>
                          </div>
                          <div className="admin-kpi-value">
                            {(
                              telemetry.platform.total_expenses +
                              telemetry.platform.total_incomes
                            ).toLocaleString()}
                          </div>
                          <div className="admin-kpi-sub">
                            {telemetry.platform.total_expenses.toLocaleString()}{" "}
                            expenses ·{" "}
                            {telemetry.platform.total_incomes.toLocaleString()}{" "}
                            incomes
                          </div>
                        </div>

                        <div className="admin-kpi-card">
                          <div className="admin-kpi-top">
                            <span className="admin-kpi-label">
                              Savings Goals
                            </span>
                            <span className="admin-kpi-icon">
                              <FaCheckCircle aria-hidden="true" />
                            </span>
                          </div>
                          <div className="admin-kpi-value">
                            {telemetry.platform.total_goals}
                          </div>
                          <div className="admin-kpi-sub">
                            {telemetry.platform.active_goals} active ·{" "}
                            {telemetry.platform.completed_goals} completed
                          </div>
                        </div>

                        <div className="admin-kpi-card">
                          <div className="admin-kpi-top">
                            <span className="admin-kpi-label">
                              Privacy &amp; Compliance
                            </span>
                            <span className="admin-kpi-icon">
                              <FaLock aria-hidden="true" />
                            </span>
                          </div>
                          <div className="admin-kpi-value">
                            {telemetry.platform.hashed_feedback}/
                            {telemetry.platform.total_feedback}
                          </div>
                          <div className="admin-kpi-sub">
                            Hashed feedback ·{" "}
                            {telemetry.platform.pending_deletions} pending
                            deletions
                          </div>
                        </div>
                      </div>

                      <div
                        className="admin-chip-cloud"
                        style={{ marginTop: "0.25rem" }}
                      >
                        <span className="admin-metric-chip">
                          Service Role Key:{" "}
                          {telemetry.services.integrations
                            .supabaseAdminConfigured
                            ? "Configured"
                            : "Not Set"}
                        </span>
                        <span className="admin-metric-chip">
                          Supabase Management API:{" "}
                          {telemetry.services.integrations
                            .supabaseManagementConfigured
                            ? "Configured"
                            : "Not Set"}
                        </span>
                        <span className="admin-metric-chip">
                          Vercel API:{" "}
                          {telemetry.services.integrations.vercelApiConfigured
                            ? "Configured"
                            : "Not Set"}
                        </span>
                        <span className="admin-metric-chip">
                          NEXT_PUBLIC_BUCK_AI_URL:{" "}
                          {telemetry.services.integrations.buckAiConfigured
                            ? "Configured"
                            : "Default (localhost)"}
                        </span>
                      </div>
                    </div>

                    {/* Security Audit Events Stream */}
                    <div className="admin-subpanel">
                      <div className="admin-subpanel-title">
                        <span>
                          Authentication &amp; Security Audit Log
                          (auth_security_events)
                        </span>
                        <span className="admin-subpanel-subtitle">
                          {telemetry.security.total_30d} events (30d) ·{" "}
                          {telemetry.security.rate_limited_30d} rate-limited
                        </span>
                      </div>

                      <div
                        className="admin-toolbar"
                        style={{ marginBottom: "0.4rem" }}
                      >
                        <input
                          type="search"
                          className="admin-search-input"
                          placeholder="Search event type, outcome, actor hash, or IP hash..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />

                        <CustomSelect
                          fit
                          value={filterCategory}
                          onChange={(val) => setFilterCategory(val)}
                          options={[
                            { value: "all", label: "All Outcomes" },
                            { value: "sent", label: "Sent" },
                            { value: "success", label: "Success" },
                            { value: "rate_limited", label: "Rate Limited" },
                            { value: "invalid", label: "Invalid" },
                            { value: "not_found", label: "Not Found" },
                          ]}
                          className="admin-filter-select"
                        />

                        <CustomSelect
                          fit
                          value={sortOrder}
                          onChange={(val) =>
                            setSortOrder(val as "newest" | "oldest")
                          }
                          options={[
                            { value: "newest", label: "Newest First" },
                            { value: "oldest", label: "Oldest First" },
                          ]}
                          className="admin-filter-select"
                        />
                      </div>

                      {filteredSecurityEvents.length > 0 ? (
                        <div
                          className="admin-feedback-list"
                          style={{ maxHeight: "340px" }}
                        >
                          {filteredSecurityEvents.map((ev) => (
                            <div key={ev.id} className="admin-log-item">
                              <div className="admin-log-row">
                                <div className="admin-log-badges">
                                  <span
                                    className={`admin-log-badge ${
                                      ev.outcome === "rate_limited" ||
                                      ev.outcome === "invalid"
                                        ? "admin-log-badge--danger"
                                        : ev.outcome === "success" ||
                                          ev.outcome === "sent"
                                        ? "admin-log-badge--gemini"
                                        : "admin-log-badge--info"
                                    }`}
                                  >
                                    {ev.outcome}
                                  </span>
                                  <span className="admin-log-mono">
                                    {ev.event_type}
                                  </span>
                                  <span className="admin-log-muted">
                                    actor_#{ev.actor_hash} · ip_#{ev.ip_hash}
                                  </span>
                                </div>
                                <span className="admin-log-muted">
                                  {formatAdminDate(ev.created_at)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="admin-placeholder-box">
                          <p>No security audit events recorded in this window.</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {/* ---------------------------------------------------------------
                TAB 4: SUPABASE AUTH LOGS
               --------------------------------------------------------------- */}
            {activeTab === "supabase" && (
              <>
                <div className="admin-toolbar">
                  <input
                    type="search"
                    className="admin-search-input"
                    placeholder="Search Supabase auth_logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  <CustomSelect
                    fit
                    value={sortOrder}
                    onChange={(val) =>
                      setSortOrder(val as "newest" | "oldest")
                    }
                    options={[
                      { value: "newest", label: "Newest First" },
                      { value: "oldest", label: "Oldest First" },
                    ]}
                    className="admin-filter-select"
                  />
                </div>

                {isFetchingSupabase ? (
                  <div className="admin-placeholder-box">
                    <FaSpinner
                      aria-hidden="true"
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    <p>Loading Supabase logs...</p>
                  </div>
                ) : supabaseError ? (
                  <div className="admin-placeholder-box">
                    <FaDatabase aria-hidden="true" />
                    <h3>Integration Required</h3>
                    <p>{supabaseError}</p>
                  </div>
                ) : filteredSupabaseLogs.length > 0 ? (
                  <div
                    className="admin-feedback-list"
                    style={{ fontFamily: "monospace" }}
                  >
                    {filteredSupabaseLogs.map((log, index) => (
                      <div
                        key={index}
                        className="admin-feedback-item"
                        style={{ background: "rgba(0,0,0,0.05)" }}
                      >
                        <div
                          className="admin-feedback-meta"
                          style={{ color: "var(--buck-ink)" }}
                        >
                          {formatAdminDate(log.timestamp)}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--buck-muted)",
                            wordBreak: "break-all",
                          }}
                        >
                          {log.event_message}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="admin-placeholder-box">
                    <p>No logs found.</p>
                  </div>
                )}
              </>
            )}

            {/* ---------------------------------------------------------------
                TAB 5: VERCEL DEPLOYMENTS
               --------------------------------------------------------------- */}
            {activeTab === "vercel" && (
              <>
                <div className="admin-toolbar">
                  <input
                    type="search"
                    className="admin-search-input"
                    placeholder="Search deployment URL or branch..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  <CustomSelect
                    fit
                    value={filterCategory}
                    onChange={(val) => setFilterCategory(val)}
                    options={[
                      { value: "all", label: "All States" },
                      { value: "READY", label: "Ready" },
                      { value: "ERROR", label: "Error" },
                      { value: "BUILDING", label: "Building" },
                      { value: "QUEUED", label: "Queued" },
                    ]}
                    className="admin-filter-select"
                  />

                  <CustomSelect
                    fit
                    value={sortOrder}
                    onChange={(val) =>
                      setSortOrder(val as "newest" | "oldest")
                    }
                    options={[
                      { value: "newest", label: "Newest First" },
                      { value: "oldest", label: "Oldest First" },
                    ]}
                    className="admin-filter-select"
                  />
                </div>

                {isFetchingVercel ? (
                  <div className="admin-placeholder-box">
                    <FaSpinner
                      aria-hidden="true"
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    <p>Loading deployments...</p>
                  </div>
                ) : vercelError ? (
                  <div className="admin-placeholder-box">
                    <FaServer aria-hidden="true" />
                    <h3>Integration Required</h3>
                    <p>{vercelError}</p>
                  </div>
                ) : filteredVercelDeployments.length > 0 ? (
                  <div className="admin-feedback-list">
                    {filteredVercelDeployments.map((dep) => (
                      <div key={dep.uid} className="admin-feedback-item">
                        <div className="admin-feedback-meta">
                          <span
                            className="admin-feedback-category"
                            style={{
                              color:
                                dep.state === "READY"
                                  ? "#2ea043"
                                  : "var(--buck-orange)",
                            }}
                          >
                            {dep.state}
                          </span>
                          <span>{formatAdminDate(dep.created)}</span>
                        </div>
                        <h3
                          className="admin-feedback-title"
                          style={{ fontSize: "0.9rem" }}
                        >
                          <a
                            href={`https://${dep.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "inherit",
                              textDecoration: "none",
                            }}
                          >
                            {dep.url}
                          </a>
                        </h3>
                        <p className="admin-feedback-details">
                          Branch: {dep.meta?.githubCommitRef || "Unknown"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="admin-placeholder-box">
                    <p>No deployments found.</p>
                  </div>
                )}
              </>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}
