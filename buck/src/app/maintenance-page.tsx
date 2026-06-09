"use client";

import { useState } from "react";
import Image from "next/image";
import { FaEnvelope, FaShieldAlt, FaTools } from "react-icons/fa";

const supportEmail = "BuckTheBudgetTracker@gmail.com";
const supportSubject = "Buck Budget Tracker support";
const supportBody = "Hello Buck support,";

const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(
  supportEmail
)}&su=${encodeURIComponent(supportSubject)}&body=${encodeURIComponent(
  supportBody
)}`;

const mailtoUrl = `mailto:${supportEmail}?subject=${encodeURIComponent(
  supportSubject
)}&body=${encodeURIComponent(supportBody)}`;

export default function MaintenancePage() {
  const [contactStatus, setContactStatus] = useState("");

  const handleContactSupport = async () => {
    const supportTab = window.open(gmailComposeUrl, "_blank");

    if (supportTab) {
      supportTab.opener = null;
    }

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
      supportTab
        ? copiedEmail
          ? "Support email copied. Opening Gmail..."
          : "Opening Gmail compose..."
        : `Opening your email app. You can also email us at ${supportEmail}.`
    );

    if (!supportTab) {
      window.location.href = mailtoUrl;
    }
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
            {contactStatus ? (
              <p className="maintenance-contact-note" role="status">
                {contactStatus}
              </p>
            ) : null}
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
