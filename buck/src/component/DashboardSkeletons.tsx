"use client";

type DashboardSkeletonVariant = "home" | "goals" | "statistics" | "settings" | "expenses" | "wallet";

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

      <section className="settings-shell">
        <nav className="settings-tabs dashboard-skeleton-card" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonBlock key={index} className="dashboard-skeleton-short" />
          ))}
        </nav>

        <article className="settings-card settings-card--panel dashboard-skeleton-card">
          <SkeletonBlock className="dashboard-skeleton-heading" rows={2} />
          <div className="settings-tab-panel">
            {Array.from({ length: 3 }, (_, index) => (
              <section
                key={index}
                className={`settings-section dashboard-skeleton-card ${
                  index === 0 ? "settings-section--avatar" : "settings-section--status"
                }`}
              >
                {index === 0 ? <span className="dashboard-skeleton-avatar" /> : null}
                <SkeletonBlock rows={3} />
              </section>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function ExpensesSkeleton() {
  return (
    <div className="expenses-page dashboard-skeleton" aria-label="Loading expenses">
      <section className="expenses-stats">
        {Array.from({ length: 3 }, (_, i) => (
          <article key={i} className="dashboard-skeleton-card">
            <SkeletonBlock rows={2} />
          </article>
        ))}
      </section>
      
      <section className="expenses-layout">
        <div className="expenses-card expenses-form dashboard-skeleton-card">
           <SkeletonBlock className="dashboard-skeleton-heading" rows={2} />
           <SkeletonBlock rows={4} />
           <SkeletonBlock className="dashboard-skeleton-button" />
        </div>
        <div className="expenses-card expenses-list dashboard-skeleton-card">
           <SkeletonBlock className="dashboard-skeleton-heading" rows={2} />
           <div className="expenses-list-items" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
             {Array.from({ length: 4 }, (_, i) => (
               <article key={i} className="expenses-list-item" style={{ padding: '0.75rem', background: 'var(--buck-surface)', borderRadius: '8px', border: '1px solid var(--buck-line)' }}>
                 <SkeletonBlock rows={2} />
               </article>
             ))}
           </div>
        </div>
      </section>
    </div>
  );
}

function WalletSkeleton() {
  return (
    <div className="settings-page dashboard-skeleton" aria-label="Loading wallets">
      <div className="wallet-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.2rem', marginTop: '1.2rem' }}>
         <article className="settings-card dashboard-skeleton-card">
            <div className="settings-card-heading">
               <SkeletonBlock className="dashboard-skeleton-heading" rows={2} />
            </div>
            <div className="settings-wallet-list" style={{ display: 'grid', gap: '0.65rem', marginTop: '1rem' }}>
              {Array.from({ length: 3 }, (_, i) => (
                 <div key={i} className="settings-wallet-item" style={{ padding: '0.75rem', border: '1px solid var(--buck-line)', borderRadius: '8px' }}>
                    <SkeletonBlock rows={2} />
                 </div>
              ))}
            </div>
         </article>
         <article className="settings-card dashboard-skeleton-card">
            <div className="settings-card-heading">
               <SkeletonBlock className="dashboard-skeleton-heading" rows={2} />
            </div>
            <div className="settings-wallet-list" style={{ display: 'grid', gap: '0.65rem', marginTop: '1rem' }}>
              {Array.from({ length: 2 }, (_, i) => (
                 <div key={i} className="settings-wallet-item" style={{ padding: '0.75rem', border: '1px solid var(--buck-line)', borderRadius: '8px' }}>
                    <SkeletonBlock rows={2} />
                 </div>
              ))}
            </div>
         </article>
      </div>
    </div>
  );
}

export function DashboardPageSkeleton({
  variant = "home",
}: {
  variant?: DashboardSkeletonVariant;
}) {
  if (variant === "settings") return <SettingsSkeleton />;
  if (variant === "goals") return <GoalsSkeleton />;
  if (variant === "statistics") return <StatisticsSkeleton />;
  if (variant === "expenses") return <ExpensesSkeleton />;
  if (variant === "wallet") return <WalletSkeleton />;
  
  return <HomeSkeleton />;
}
