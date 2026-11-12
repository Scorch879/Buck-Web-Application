import React, { useEffect, useRef, useState } from "react";
import { createGoal } from "@/component/goals";
import "./style.css";
import CustomDatePicker from "@/component/CustomDatePicker";
import { useToast } from "@/component/toast/ToastContext";
import { motion } from "framer-motion";
import { backdropMotion, panelMotion } from "@/utils/motion";
import { detectGoalAttitude } from "@/utils/aiApi";
import type { GoalAttitude } from "@/utils/goalAttitude";
import type { BuckGoal } from "@/utils/supabaseData";
import GoalPlanTable, { AttitudeChip } from "./GoalPlanTable";

type CreateGoalModalProps = {
  onClose: () => void;
  onGoalCreated: (goal: BuckGoal) => void;
};

/** How long to wait after the last keystroke before asking the AI Advisor. */
const DETECT_DELAY_MS = 400;

type Detection =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "unavailable" }
  | { state: "done"; result: GoalAttitude };

/**
 * New-goal dialog. The saving attitude is not picked by hand: once an amount
 * and a target date are filled in, the AI Advisor detects it and shows the
 * plan it implies (ADR-055).
 */
const CreateGoalModal: React.FC<CreateGoalModalProps> = ({ onClose, onGoalCreated }) => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [detection, setDetection] = useState<Detection>({ state: "idle" });
  // Only the newest request may write its answer.
  const requestRef = useRef(0);

  const [form, setForm] = useState({
    goalName: "",
    targetAmount: "",
    targetDate: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  };

  useEffect(() => {
    const amount = Number(form.targetAmount);
    const request = ++requestRef.current;
    if (!form.targetDate || !Number.isFinite(amount) || amount <= 0) {
      setDetection({ state: "idle" });
      return;
    }
    setDetection({ state: "loading" });
    const timer = window.setTimeout(() => {
      void detectGoalAttitude({ targetAmount: amount, targetDate: form.targetDate }).then((result) => {
        if (request !== requestRef.current) return;
        setDetection(result ? { state: "done", result } : { state: "unavailable" });
      });
    }, DETECT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [form.targetAmount, form.targetDate]);

  const handleGoalCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    // "" = no manual attitude; createGoal detects it and falls back to Normal.
    const result = await createGoal(form.goalName, form.targetAmount, "", form.targetDate);
    setSubmitting(false);
    const createdGoal = result.success ? result.goal : undefined;
    if (createdGoal) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onGoalCreated(createdGoal);
      }, 1000);
    } else {
      toast("Couldn't create the goal. Try again.", "error");
    }
  };

  const detected = detection.state === "done" ? detection.result : null;
  const outOfReach = detected?.feasible === false;

  return (
    <motion.div className="modal-backdrop" {...backdropMotion}>
      <motion.div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label="Create a new goal"
        {...panelMotion}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
          <span aria-hidden="true">×</span>
        </button>
        <h2 className="create-goal-title">Create a new goal</h2>
        {success && <div className="create-goal-success">Goal created</div>}
        <form onSubmit={handleGoalCreate} className="create-goal-form">
          <input
            id="goalName"
            type="text"
            placeholder="Goal name"
            aria-label="Goal name"
            value={form.goalName}
            onChange={handleChange}
            required
            className="create-goal-input"
          />
          <input
            id="targetAmount"
            type="number"
            placeholder="Target amount (₱)"
            aria-label="Target amount in pesos"
            value={form.targetAmount}
            onChange={handleChange}
            required
            min={1}
            className="create-goal-input"
          />
          <CustomDatePicker
            id="targetDate"
            placeholder="Target date"
            value={form.targetDate}
            onChange={(val) => setForm((prev) => ({ ...prev, targetDate: val }))}
            required
          />

          <div
            className={`create-goal-attitude${outOfReach ? " create-goal-attitude--warning" : ""}`}
            aria-live="polite"
          >
            <p className="create-goal-attitude-label">Saving attitude</p>
            {detection.state === "idle" && (
              <p className="create-goal-attitude-text">
                Enter an amount and a target date. Your AI Advisor then picks the saving attitude
                this goal needs.
              </p>
            )}
            {detection.state === "loading" && (
              <p className="create-goal-attitude-text">Working out your saving attitude…</p>
            )}
            {detection.state === "unavailable" && (
              <p className="create-goal-attitude-text">
                Your saving attitude will be set once Buck&apos;s AI is reachable. Until then it
                starts as Normal.
              </p>
            )}
            {detected && (
              <>
                <AttitudeChip attitude={detected.attitude} />
                <p className="create-goal-attitude-text">{detected.reason}</p>
                {outOfReach && detected.plan?.daysToGoal != null && (
                  <p className="create-goal-attitude-text create-goal-attitude-text--strong">
                    At this pace you&apos;d reach it in {detected.plan.daysToGoal} days. You can
                    still create the goal.
                  </p>
                )}
                {detected.plan && (
                  <GoalPlanTable plan={detected.plan} caption="Your plan for this goal" />
                )}
              </>
            )}
          </div>

          <button
            type="submit"
            className={`nav-button create-goal-button${submitting ? " create-goal-button-disabled" : ""}`}
            disabled={submitting}
          >
            {submitting ? "Creating..." : "Create goal"}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default CreateGoalModal;
