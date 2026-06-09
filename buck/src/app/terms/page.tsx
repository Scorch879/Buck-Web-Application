import Image from "next/image";
import Link from "next/link";

const termsSections = [
  {
    title: "Use Buck for personal budgeting",
    body:
      "Buck is built to help you track wallets, expenses, savings goals, and budget patterns. The app is not a bank, lender, broker, or financial adviser, and its suggestions should be treated as helpful planning information.",
  },
  {
    title: "Keep your account secure",
    body:
      "You are responsible for the email address, password, and sign-in methods connected to your account. Tell us if you believe your account has been accessed without permission.",
  },
  {
    title: "Enter accurate budget data",
    body:
      "Your dashboard depends on the wallet, expense, and goal details you provide. Buck can organize and summarize that information, but you should review the numbers before making money decisions.",
  },
  {
    title: "Use the service respectfully",
    body:
      "Do not misuse Buck, attempt to access another person's data, disrupt the service, or upload content that breaks the law. We may limit access when needed to protect users and the app.",
  },
  {
    title: "Service changes",
    body:
      "Buck may change features, improve workflows, or pause parts of the app for maintenance. When possible, we keep core account and budget access stable while improvements are made.",
  },
  {
    title: "Questions",
    body:
      "If you have questions about these terms, contact the Buck team from the support link provided in the app.",
  },
];

export default function TermsPage() {
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
            <p className="legal-eyebrow">Terms of use</p>
            <h1>
              Clear rules for using <span>Buck.</span>
            </h1>
            <p className="legal-lede">
              These terms describe the practical rules for using Buck Budget
              Tracker. They are written plainly so users know what the app does,
              what it does not do, and how accounts should be handled.
            </p>
            <p className="legal-updated">Last updated: June 2026</p>
          </div>

          <div className="legal-section-grid">
            {termsSections.map((section) => (
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
            <p>Personal budgeting support. Not financial advice.</p>
          </div>
          <Link href="/privacy">Read Privacy</Link>
        </footer>
      </div>
    </main>
  );
}
