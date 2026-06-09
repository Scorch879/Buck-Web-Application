import Image from "next/image";
import Link from "next/link";

const privacySections = [
  {
    title: "Information you provide",
    body:
      "Buck uses your account email, optional username, wallet details, expenses, goals, and related budget records so the app can show your personal dashboard and keep your data synced.",
  },
  {
    title: "How Buck uses data",
    body:
      "Your information is used to sign you in, protect your session, display budget activity, calculate summaries, and provide relevant budgeting guidance inside the app.",
  },
  {
    title: "Authentication and hosting",
    body:
      "Supabase handles authentication and database storage for Buck. Vercel may host the web application. These providers process data only as needed to run the service.",
  },
  {
    title: "Budget privacy",
    body:
      "Buck does not sell your email or personal budget records. Budget data should only be available to your account when database row-level security policies are enabled correctly.",
  },
  {
    title: "Emails",
    body:
      "Buck may send account emails such as confirmation, password reset, magic link, email change, and security notifications. These emails help protect access to your account.",
  },
  {
    title: "Control and deletion",
    body:
      "You can request help with account access, corrections, or deletion through support. Some records may need to be retained for security, abuse prevention, or legal reasons.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <header className="legal-header">
          <Link className="legal-brand" href="/">
            <span className="legal-brand-mark" aria-hidden="true">
              <Image src="/BuckMascot.svg" alt="" width={50} height={60} />
            </span>
            <span className="legal-brand-copy">
              <strong>Buck</strong>
              <span>Budget Tracker</span>
            </span>
          </Link>
          <Link className="legal-home-link" href="/">
            Back to Buck
          </Link>
        </header>

        <article className="legal-card">
          <div className="legal-hero">
            <p className="legal-eyebrow">Privacy</p>
            <h1>
              Your budget data should stay <span>yours.</span>
            </h1>
            <p className="legal-lede">
              This privacy page explains the main data Buck needs to run user
              accounts and budget features. It is meant to be easy to scan
              before creating an account.
            </p>
            <p className="legal-updated">Last updated: June 2026</p>
          </div>

          <div className="legal-section-grid">
            {privacySections.map((section) => (
              <section className="legal-section" key={section.title}>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </section>
            ))}
          </div>
        </article>

        <footer className="legal-footer">
          <div>
            <strong>Buck Budget Tracker</strong>
            <p>Private planning for wallets, expenses, and goals.</p>
          </div>
          <Link href="/terms">Read Terms</Link>
        </footer>
      </div>
    </main>
  );
}
