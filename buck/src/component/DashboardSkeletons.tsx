"use client";

type DashboardSkeletonVariant = "home" | "goals" | "statistics";

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
    <div className="dashboard-container dashboard-skeleton" aria-label="Loading statistics">
      <section className="graph-panel dashboard-skeleton-card">
        <SkeletonBlock className="dashboard-skeleton-heading" rows={2} />
        <div className="dashboard-skeleton-bars dashboard-skeleton-bars--wide" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => (
            <span key={index} style={{ height: `${28 + ((index * 13) % 54)}%` }} />
          ))}
        </div>
      </section>

      <section className="statistics-panels-container">
        <article className="graph-panel dashboard-skeleton-card">
          <SkeletonBlock rows={5} />
        </article>
        <article className="graph-panel dashboard-skeleton-card">
          <span className="dashboard-skeleton-circle" />
          <SkeletonBlock rows={2} />
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
  if (variant === "goals") {
    return <GoalsSkeleton />;
  }

  if (variant === "statistics") {
    return <StatisticsSkeleton />;
  }

  return <HomeSkeleton />;
}
