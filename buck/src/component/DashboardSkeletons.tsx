"use client";

type DashboardSkeletonVariant = "home" | "goals" | "statistics" | "settings";

function SkeletonBlock({
  className = "",
  rows = 1,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={`dashboard-skeleton-block ${className}`}>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="dashboard-skeleton-line" />
      ))}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="dashboard-container dashboard-skeleton">
      <section className="dashboard-welcome-card dashboard-skeleton-card">
        <span className="dashboard-skeleton-avatar" />
        <SkeletonBlock className="dashboard-skeleton-copy" rows={2} />
      </section>

      <section className="dashboard-content" aria-label="Loading dashboard">
        <article className="spending-card dashboard-skeleton-card">
          <SkeletonBlock className="dashboard-skeleton-kicker" />
          <span className="dashboard-skeleton-circle" />
          <SkeletonBlock className="dashboard-skeleton-short" />
        </article>

        <article className="graph-card dashboard-skeleton-card">
          <SkeletonBlock className="dashboard-skeleton-heading" rows={2} />
          <div className="dashboard-skeleton-bars" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index} style={{ height: `${34 + index * 8}%` }} />
            ))}
          </div>
        </article>
      </section>

      <section className="summary-card dashboard-skeleton-card">
        <SkeletonBlock className="dashboard-skeleton-heading" rows={2} />
        <div className="summary-content">
          {Array.from({ length: 3 }, (_, index) => (
            <article key={index} className="summary-item">
              <SkeletonBlock rows={3} />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function GoalsSkeleton() {
  return (
    <div className="GoalsPage dashboard-skeleton" aria-label="Loading goals">
      <aside className="GoalsCard dashboard-skeleton-card">
        <SkeletonBlock className="dashboard-skeleton-heading" rows={2} />
        <SkeletonBlock className="dashboard-skeleton-button" />
        <div className="goals-list">
          {Array.from({ length: 4 }, (_, index) => (
            <article key={index} className="goals-card">
              <SkeletonBlock rows={3} />
            </article>
          ))}
        </div>
      </aside>

      <section className="GoalsContainer dashboard-skeleton-card">
        <div className="goal-details">
          <SkeletonBlock className="dashboard-skeleton-heading" rows={2} />
          <div className="goal-details-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <SkeletonBlock key={index} rows={2} />
            ))}
          </div>
          <SkeletonBlock className="dashboard-skeleton-wide" rows={4} />
        </div>
      </section>
    </div>
  );
}

function StatisticsSkeleton() {
  return (
    <div
      className="dashboard-container dashboard-skeleton statistics-skeleton"
      aria-label="Loading statistics"
    >
      <section className="statistics-mode-skeleton dashboard-skeleton-card">
        <SkeletonBlock className="dashboard-skeleton-short" />
      </section>

      <section className="empty-goals-popup statistics-empty-skeleton dashboard-skeleton-card">
        <SkeletonBlock className="dashboard-skeleton-heading" rows={3} />
        <SkeletonBlock className="dashboard-skeleton-button" />
      </section>

      <section className="graph-panel statistics-chart-skeleton dashboard-skeleton-card">
        <SkeletonBlock className="dashboard-skeleton-heading" rows={2} />
        <div
          className="dashboard-skeleton-bars dashboard-skeleton-bars--wide"
          aria-hidden="true"
        >
          {Array.from({ length: 7 }, (_, index) => (
            <span
              key={index}
              style={{ height: `${32 + ((index * 17) % 48)}%` }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="settings-page dashboard-skeleton" aria-label="Loading settings">
      <section className="settings-hero dashboard-skeleton-card">
        <SkeletonBlock className="dashboard-skeleton-heading" rows={3} />
        <SkeletonBlock className="dashboard-skeleton-short" rows={2} />
      </section>

      <section className="settings-grid settings-grid--single">
        <article className="settings-card settings-card--account dashboard-skeleton-card">
          <SkeletonBlock className="dashboard-skeleton-heading" rows={2} />
          <div className="settings-account-layout">
            {Array.from({ length: 6 }, (_, index) => (
              <section
                key={index}
                className={`settings-section dashboard-skeleton-card ${
                  index === 3 || index === 4
                    ? "settings-section--email"
                    : index === 5
                      ? "settings-section--danger"
                      : "settings-section--status"
                }`}
              >
                {index === 0 ? <span className="dashboard-skeleton-avatar" /> : null}
                <SkeletonBlock rows={index === 5 ? 2 : 3} />
              </section>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

export function DashboardPageSkeleton({
  variant = "home",
}: {
  variant?: DashboardSkeletonVariant;
}) {
  if (variant === "settings") {
    return <SettingsSkeleton />;
  }

  if (variant === "goals") {
    return <GoalsSkeleton />;
  }

  if (variant === "statistics") {
    return <StatisticsSkeleton />;
  }

  return <HomeSkeleton />;
}
