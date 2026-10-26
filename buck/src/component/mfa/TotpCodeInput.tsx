"use client";

import { forwardRef } from "react";
import { sanitizeTotpInput } from "@/utils/mfa/client";

/**
 * The 6-digit authenticator code box (ADR-048). Digits only, paste-friendly
 * (spaces and dashes are dropped) and calls `onComplete` once 6 digits are in.
 */

interface TotpCodeInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  className?: string;
  /** Id of the error or help text tied to the box. */
  describedBy?: string;
  invalid?: boolean;
  autoFocus?: boolean;
}

const TotpCodeInput = forwardRef<HTMLInputElement, TotpCodeInputProps>(function TotpCodeInput(
  { id, value, onChange, onComplete, disabled = false, className, describedBy, invalid = false, autoFocus = false },
  ref
) {
  return (
    <input
      ref={ref}
      id={id}
      className={className}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      placeholder="123456"
      spellCheck={false}
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      onChange={(event) => {
        const next = sanitizeTotpInput(event.target.value);
        onChange(next);

        if (next.length === 6 && next !== value) {
          onComplete?.(next);
        }
      }}
    />
  );
});

export default TotpCodeInput;
