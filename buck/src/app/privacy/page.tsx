import Image from "next/image";
import Link from "next/link";
import { privacyContent } from "@/constants/legal";

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
            <p className="legal-eyebrow">{privacyContent.eyebrow}</p>
            <h1>
              {privacyContent.title} <span>{privacyContent.accent}</span>
            </h1>
            <p className="legal-lede">{privacyContent.lede}</p>
            <p className="legal-updated">{privacyContent.updated}</p>
          </div>

          <div className="legal-section-grid">
            {privacyContent.sections.map((section) => (
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
            <p>{privacyContent.footerNote}</p>
          </div>
          <Link href="/terms">Read Terms</Link>
        </footer>
      </div>
    </main>
  );
}
