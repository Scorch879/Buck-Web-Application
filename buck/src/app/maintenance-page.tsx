"use client";

import { useState } from "react";
import Image from "next/image";
import { FaEnvelope, FaShieldAlt, FaTools } from "react-icons/fa";

const supportEmail = "BuckTheBudgetTracker@gmail.com";

export default function MaintenancePage() {
  const [contactStatus, setContactStatus] = useState(supportEmail);

  const handleContactSupport = async () => {
    let copiedEmail = false;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(supportEmail);
        copiedEmail = true;
      }
    } catch {
      copiedEmail = false;
    }

    setContactStatus(
      copiedEmail
        ? "Support email copied. Opening your email app..."
        : `Email us at ${supportEmail}`
    );

    window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent(
      "Buck Budget Tracker support"
    )}`;
  };

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
              <button
                className="maintenance-contact-button"
                type="button"
                onClick={handleContactSupport}
              >
                <FaEnvelope aria-hidden="true" />
                Contact support
              </button>
            </div>
            <p className="maintenance-contact-note" role="status">
              {contactStatus}
            </p>
          </div>

          <aside className="maintenance-status" aria-label="Maintenance status">
            <div className="maintenance-badge">
              <FaTools aria-hidden="true" />
              <span>Maintenance Mode</span>
            </div>

            <div className="maintenance-loader" aria-label="Maintenance loading">
              <div className="maintenance-loader-track" aria-hidden="true">
                <span />
              </div>
              <p>Preparing Buck to come back online...</p>
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
