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
        const feedbackData = await getAdminFeedback();
        if (active) {
          setFeedback(feedbackData);
        }
      } catch (err) {
        if (active) {
          setError("Failed to load feedback. Make sure the 'feedback' table exists in Supabase.");
        }
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

  if (loading || !user || user.email !== "buckthebudgettracker@gmail.com") {
    return <DashboardPageSkeleton variant="settings" />;
  }

  return (
    <main className="admin-page">
      {error && (
        <div style={{ color: "#a81919", background: "rgba(255, 56, 56, 0.14)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255, 56, 56, 0.34)", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div className="admin-grid">
        <article className="settings-card">
          <div className="settings-card-heading">
            <span aria-hidden="true"><FaEnvelopeOpenText /></span>
            <h2>User Feedback</h2>
          </div>
          
          {feedback && feedback.length > 0 ? (
            <div className="admin-feedback-list">
              {feedback.map((item) => (
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
            <div className="admin-placeholder-box" style={{ minHeight: '100px', padding: '2rem 1rem' }}>
              <p>No feedback received yet.</p>
            </div>
          )}
        </article>

        <article className="settings-card">
          <div className="settings-card-heading">
            <span aria-hidden="true"><FaDatabase /></span>
            <h2>Supabase Logs</h2>
          </div>
          
          <div className="admin-placeholder-box">
            <FaDatabase aria-hidden="true" />
            <h3>Database Monitoring</h3>
            <p>Connect your Supabase Management API key to view real-time Postgres logs and database health directly from this dashboard.</p>
            <button className="admin-setup-button" type="button" onClick={() => alert("Supabase API Key integration coming soon!")}>
              Setup Integration
            </button>
          </div>
        </article>

        <article className="settings-card">
          <div className="settings-card-heading">
            <span aria-hidden="true"><FaServer /></span>
            <h2>Vercel Deployments</h2>
          </div>
          
          <div className="admin-placeholder-box">
            <FaServer aria-hidden="true" />
            <h3>Recent Deployments</h3>
            <p>Connect your Vercel Project API key to track recent deployments, build logs, and project status.</p>
            <button className="admin-setup-button" type="button" onClick={() => alert("Vercel API Key integration coming soon!")}>
              Setup Integration
            </button>
          </div>
        </article>
      </div>
    </main>
  );
}
