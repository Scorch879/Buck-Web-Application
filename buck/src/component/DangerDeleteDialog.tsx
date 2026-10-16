"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronRight, FaExclamationTriangle, FaTrash } from "react-icons/fa";
import styles from "./DangerDeleteDialog.module.css";

/**
 * Three-step confirmation for every permanent delete (Design.md ADR-041):
 *   1. Warning + slide-to-delete.
 *   2. "I understand" (red) or Cancel.
 *   3. Type the item's name exactly (GitHub-style) to enable the final Delete.
 * Deletes in Buck have no undo, so none may skip this dialog.
 */
export interface DangerDeleteDialogProps {
  open: boolean;
  /** Noun for the thing being deleted, e.g. "wallet", "expense". */
  itemType: string;
  /** Display name; also the text the user must type in step 3. */
  itemName: string;
  /** What will be lost, shown in step 1 and step 2. */
  consequences?: React.ReactNode[];
  /** Performs the delete. The dialog stays open (busy) until it settles. */
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

const SLIDE_THRESHOLD = 0.92;

export default function DangerDeleteDialog({
  open,
  itemType,
  itemName,
  consequences = [],
  onConfirm,
  onCancel,
}: DangerDeleteDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Fresh start every time the dialog opens.
  useEffect(() => {
    if (open) {
      setStep(1);
      setTyped("");
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (step === 3) inputRef.current?.focus();
  }, [step]);

  const cancel = useCallback(() => {
    if (!busy) onCancel();
  }, [busy, onCancel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, cancel]);

  const matches = typed === itemName;

  const confirm = async () => {
    if (!matches || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cancel();
          }}
          // React events bubble through portals; keep clicks inside this dialog
          // from reaching a parent modal's backdrop handler (e.g. WalletModal).
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            className={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: 16, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
          >
            <div className={styles.header}>
              <span className={styles.headerIcon} aria-hidden="true">
                <FaExclamationTriangle />
              </span>
              <div className={styles.headerText}>
                <h3 id={titleId}>Delete {itemType}</h3>
                <p className={styles.itemName} title={itemName}>
                  {itemName}
                </p>
              </div>
            </div>

            <ol className={styles.steps} aria-label={`Step ${step} of 3`}>
              {[1, 2, 3].map((n) => (
                <li
                  key={n}
                  className={`${styles.stepDot} ${n <= step ? styles.stepDotDone : ""}`}
                  aria-current={n === step ? "step" : undefined}
                />
              ))}
            </ol>

            {step === 1 && (
              <div className={styles.body}>
                <p className={styles.warning}>
                  Deleting this {itemType} cannot be undone.
                </p>
                {consequences.length > 0 && (
                  <ul className={styles.consequences}>
                    {consequences.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
                <SlideToConfirm
                  label={`Slide to delete ${itemType}`}
                  onComplete={() => setStep(2)}
                />
                <div className={styles.actions}>
                  <button type="button" className={styles.cancelBtn} onClick={cancel}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className={styles.body}>
                <p className={styles.warning}>
                  Are you sure? Deleting <strong>{itemName}</strong> cannot be reversed.
                </p>
                <div className={styles.actions}>
                  <button type="button" className={styles.cancelBtn} onClick={cancel}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    onClick={() => setStep(3)}
                    autoFocus
                  >
                    I understand, continue
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <form
                className={styles.body}
                onSubmit={(e) => {
                  e.preventDefault();
                  void confirm();
                }}
              >
                <label className={styles.typeLabel} htmlFor={`${titleId}-confirm`}>
                  To confirm, type <code className={styles.code}>{itemName}</code> below.
                </label>
                <input
                  ref={inputRef}
                  id={`${titleId}-confirm`}
                  className={styles.typeInput}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  aria-invalid={typed.length > 0 && !matches}
                />
                <div className={styles.actions}>
                  <button type="button" className={styles.cancelBtn} onClick={cancel} disabled={busy}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.dangerBtn} disabled={!matches || busy}>
                    <FaTrash aria-hidden="true" />
                    {busy ? "Deleting…" : `Delete this ${itemType}`}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Drag the handle to the end of the track. Keyboard: Arrow Right / End / Enter. */
function SlideToConfirm({ label, onComplete }: { label: string; onComplete: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startProgress = useRef(0);

  const maxTravel = () => {
    const track = trackRef.current;
    if (!track) return 1;
    const knob = track.querySelector<HTMLElement>("[data-knob]");
    return Math.max(track.clientWidth - (knob?.offsetWidth ?? 44) - 8, 1);
  };

  const finish = (p: number) => {
    if (p >= SLIDE_THRESHOLD) {
      setProgress(1);
      setTimeout(onComplete, 120);
    } else {
      setProgress(0);
    }
  };

  return (
    <div
      ref={trackRef}
      className={`${styles.slideTrack} ${dragging ? styles.slideTrackActive : ""}`}
      style={{ ["--slide-progress" as string]: progress }}
    >
      <span className={styles.slideFill} aria-hidden="true" />
      <span className={styles.slideText} aria-hidden="true">
        {label}
      </span>
      <button
        type="button"
        data-knob
        className={styles.slideKnob}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        style={{ transform: `translateX(calc(${progress} * var(--slide-travel, 0px)))` }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          startX.current = e.clientX;
          startProgress.current = progress;
          setDragging(true);
          trackRef.current?.style.setProperty("--slide-travel", `${maxTravel()}px`);
        }}
        onPointerMove={(e) => {
          if (!dragging) return;
          const p = startProgress.current + (e.clientX - startX.current) / maxTravel();
          setProgress(Math.min(Math.max(p, 0), 1));
        }}
        onPointerUp={() => {
          setDragging(false);
          finish(progress);
        }}
        onPointerCancel={() => {
          setDragging(false);
          setProgress(0);
        }}
        onKeyDown={(e) => {
          trackRef.current?.style.setProperty("--slide-travel", `${maxTravel()}px`);
          if (e.key === "ArrowRight") {
            e.preventDefault();
            const p = Math.min(progress + 0.25, 1);
            setProgress(p);
            if (p >= 1) finish(1);
          } else if (e.key === "End" || e.key === "Enter") {
            e.preventDefault();
            finish(1);
          } else if (e.key === "ArrowLeft" || e.key === "Home") {
            e.preventDefault();
            setProgress(0);
          }
        }}
      >
        <FaChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}
