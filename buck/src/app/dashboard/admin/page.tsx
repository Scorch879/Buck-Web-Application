"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FaDatabase, FaEnvelopeOpenText, FaServer } from "react-icons/fa";
import { useOptionalDashboardUser } from "@/context/DashboardUserContext";
import { getAdminFeedback, type BuckFeedback } from "@/utils/supabaseData";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import "../settings/style.css";
import "./style.css";

function formatAdminDate(isoString: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoString));
}

export default function AdminPage() {
  const router = useRouter();
  const user = useOptionalDashboardUser();
  const [feedback, setFeedback] = useState<BuckFeedback[] | null>(null);
  const [vercelDeployments, setVercelDeployments] = useState<any[] | null>(null);
  const [supabaseLogs, setSupabaseLogs] = useState<any[] | null>(null);
  const [vercelError, setVercelError] = useState("");
  const [supabaseError, setSupabaseError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAdminData() {
      if (!user) {
        return;
      }

      if (user.email !== "buckthebudgettracker@gmail.com") {
        router.replace("/dashboard/home");
        return;
      }

      try {
        const [feedbackData, vercelResponse, supabaseResponse] = await Promise.all([
          getAdminFeedback().catch(() => {
            if (active) setError("Failed to load feedback. Make sure the 'feedback' table exists in Supabase.");
            return null;
          }),
          fetch("/api/admin/vercel").catch(() => null),
          fetch("/api/admin/supabase").catch(() => null),
        ]);

        if (active && feedbackData) {
          setFeedback(feedbackData);
        }

        if (active && vercelResponse) {
          const vData = await vercelResponse.json();
          if (vercelResponse.ok) {
            setVercelDeployments(vData.deployments || []);
          } else {
            setVercelError(vData.error || "Failed to fetch Vercel data.");
          }
        }

        if (active && supabaseResponse) {
          const sData = await supabaseResponse.json();
          if (supabaseResponse.ok) {
            setSupabaseLogs(sData.logs || []);
          } else {
            setSupabaseError(sData.error || "Failed to fetch Supabase logs.");
          }
        }
      } catch (err) {
        // Handled individually above
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAdminData();

    return () => {
      active = false;
    };
  }, [user, router]);

  const adminTabs = [
    { id: "feedback", label: "User Feedback", icon: FaEnvelopeOpenText, description: "Monitor feedback from your users." },
    { id: "supabase", label: "Supabase Logs", icon: FaDatabase, description: "Live auth logs from your Postgres database." },
    { id: "vercel", label: "Vercel Deployments", icon: FaServer, description: "Track your recent project builds." },
  ];

  const [activeTab, setActiveTab] = useState("feedback");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [filterCategory, setFilterCategory] = useState("all");

  useEffect(() => {
    setSearchQuery("");
    setFilterCategory("all");
  }, [activeTab]);

  if (loading) {
    return <DashboardPageSkeleton variant="settings" />;
  }

  const ActiveIcon = adminTabs.find((t) => t.id === activeTab)?.icon || FaEnvelopeOpenText;
  const activeDescription = adminTabs.find((t) => t.id === activeTab)?.description;

  const filteredFeedback = feedback?.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.details.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.user_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    return sortOrder === "newest" 
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const filteredSupabaseLogs = supabaseLogs?.filter((log: any) => {
    return log.event_message?.toLowerCase().includes(searchQuery.toLowerCase());
  }).sort((a: any, b: any) => {
    return sortOrder === "newest" 
      ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const filteredVercelDeployments = vercelDeployments?.filter((dep: any) => {
    const matchesSearch = dep.url?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          dep.meta?.githubCommitRef?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || dep.state === filterCategory;
    return matchesSearch && matchesCategory;
  }).sort((a: any, b: any) => {
    return sortOrder === "newest" 
      ? new Date(b.created).getTime() - new Date(a.created).getTime()
      : new Date(a.created).getTime() - new Date(b.created).getTime();
  });

  return (
    <main className="admin-page">
      {error && (
        <div style={{ color: "#a81919", background: "rgba(255, 56, 56, 0.14)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255, 56, 56, 0.34)", marginBottom: "1rem", flexShrink: 0 }}>
          {error}
        </div>
      )}

      <section className="settings-shell" style={{ flex: 1, minHeight: 0 }}>
        <nav className="settings-tabs" aria-label="Admin sections" style={{ position: "sticky", top: "clamp(0.78rem, 1.35vw, 0.95rem)" }}>
          {adminTabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                className={`settings-tab${isActive ? " settings-tab--active" : ""}`}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.7rem, 1.4vw, 0.95rem)', flex: 1, minHeight: 0, alignSelf: 'stretch' }}>
          <article className="settings-card settings-card--panel admin-stretch-card">
            <div className="settings-card-heading settings-card-heading--wide">
              <span aria-hidden="true"><ActiveIcon /></span>
              <div>
                <h2>{adminTabs.find((t) => t.id === activeTab)?.label}</h2>
                <p>{activeDescription}</p>
              </div>
            </div>

            <div className="admin-toolbar">
              <input 
                type="search" 
                className="admin-search-input" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              
              {activeTab === "feedback" && (
                <select 
                  className="admin-filter-select"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  <option value="Bug">Bug</option>
                  <option value="Feature">Feature</option>
                  <option value="Question">Question</option>
                  <option value="Other">Other</option>
                </select>
              )}

              {activeTab === "vercel" && (
                <select 
                  className="admin-filter-select"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="all">All States</option>
                  <option value="READY">Ready</option>
                  <option value="ERROR">Error</option>
                  <option value="BUILDING">Building</option>
                  <option value="QUEUED">Queued</option>
                </select>
              )}

              <select 
                className="admin-filter-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            {activeTab === "feedback" && (
              filteredFeedback && filteredFeedback.length > 0 ? (
                <div className="admin-feedback-list">
                  {filteredFeedback.map((item) => (
                    <div key={item.id} className="admin-feedback-item">
                      <div className="admin-feedback-meta">
                        <span className="admin-feedback-category">{item.category}</span>
                        <span>{formatAdminDate(item.created_at)}</span>
                      </div>
                      <h3 className="admin-feedback-title">{item.title}</h3>
                      <p className="admin-feedback-details">{item.details}</p>
                      <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--buck-muted)' }}>
                        From: {item.user_email}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-placeholder-box">
                  <p>No feedback received yet.</p>
                </div>
              )
            )}

            {activeTab === "supabase" && (
              supabaseError ? (
                <div className="admin-placeholder-box">
                  <FaDatabase aria-hidden="true" />
                  <h3>Integration Required</h3>
                  <p>{supabaseError}</p>
                </div>
              ) : filteredSupabaseLogs && filteredSupabaseLogs.length > 0 ? (
                <div className="admin-feedback-list" style={{ fontFamily: "monospace" }}>
                  {filteredSupabaseLogs.map((log: any, index: number) => (
                    <div key={index} className="admin-feedback-item" style={{ background: "rgba(0,0,0,0.05)" }}>
                      <div className="admin-feedback-meta" style={{ color: "var(--buck-ink)" }}>
                        {formatAdminDate(log.timestamp)}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--buck-muted)", wordBreak: "break-all" }}>
                        {log.event_message}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-placeholder-box">
                  <p>No logs found or loading...</p>
                </div>
              )
            )}

            {activeTab === "vercel" && (
              vercelError ? (
                <div className="admin-placeholder-box">
                  <FaServer aria-hidden="true" />
                  <h3>Integration Required</h3>
                  <p>{vercelError}</p>
                </div>
              ) : filteredVercelDeployments && filteredVercelDeployments.length > 0 ? (
                <div className="admin-feedback-list">
                  {filteredVercelDeployments.map((dep: any) => (
                    <div key={dep.uid} className="admin-feedback-item">
                      <div className="admin-feedback-meta">
                        <span className="admin-feedback-category" style={{ color: dep.state === "READY" ? "#52b86a" : "var(--buck-orange)" }}>
                          {dep.state}
                        </span>
                        <span>{formatAdminDate(dep.created)}</span>
                      </div>
                      <h3 className="admin-feedback-title" style={{ fontSize: "0.9rem" }}>
                        <a href={`https://${dep.url}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                          {dep.url}
                        </a>
                      </h3>
                      <p className="admin-feedback-details">Branch: {dep.meta?.githubCommitRef || "Unknown"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-placeholder-box">
                  <p>No deployments found or loading...</p>
                </div>
              )
            )}
          </article>
        </div>
      </section>
    </main>
  );
}
