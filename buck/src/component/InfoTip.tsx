"use client";

import { useId, useState } from "react";
import { FaInfoCircle } from "react-icons/fa";

/**
 * Small accessible tooltip: an info button that shows its text on hover,
 * focus or tap. The text is linked with aria-describedby, so screen readers
 * read it with the button.
 */
export default function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className="info-tip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="info-tip__button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <FaInfoCircle aria-hidden="true" />
      </button>
      <span id={id} role="tooltip" className="info-tip__bubble" data-open={open}>
        {children}
      </span>
    </span>
  );
}
