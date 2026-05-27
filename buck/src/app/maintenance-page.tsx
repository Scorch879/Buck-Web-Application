import Image from "next/image";
import { FaEnvelope, FaShieldAlt, FaTools } from "react-icons/fa";

export default function MaintenancePage() {
  return (
    <main className="maintenance-page" aria-labelledby="maintenance-title">
      <section className="maintenance-shell">
        <div className="maintenance-brand">
          <span className="maintenance-mascot">
            <Image
              src="/BuckMascot.svg"
              alt=""
              width={82}
              height={102}
              priority
            />
          </span>
          <span>
            <strong>Buck</strong>
            <small>The Budget Tracker</small>
          </span>
        </div>

        <div className="maintenance-grid">
          <div className="maintenance-copy">
            <p className="maintenance-kicker">Site tune-up in progress</p>
            <h1 id="maintenance-title">Buck is under maintenance.</h1>
            <p>
              We are polishing the tracker, checking the numbers, and making
              sure the next visit feels smoother. Please check back soon.
            </p>

            <div className="maintenance-actions" aria-label="Maintenance contact">
              <a href="mailto:BuckTheBudgetTracker@gmail.com">
                <FaEnvelope aria-hidden="true" />
                Contact support
              </a>
            </div>
          </div>

          <aside className="maintenance-status" aria-label="Maintenance status">
            <div className="maintenance-badge">
              <FaTools aria-hidden="true" />
              <span>Maintenance Mode</span>
            </div>

            <div className="maintenance-meter" aria-hidden="true">
              <span />
            </div>

            <ul className="maintenance-list">
              <li>
                <FaShieldAlt aria-hidden="true" />
                <span>Budget data stays protected.</span>
              </li>
              <li>
                <FaTools aria-hidden="true" />
                <span>Core pages are being refreshed.</span>
              </li>
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
