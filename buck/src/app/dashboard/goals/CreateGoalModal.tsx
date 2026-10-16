import React, { useState } from "react";
import { createGoal } from "@/component/goals";
import "./style.css";
import CustomSelect from "@/component/CustomSelect";
import CustomDatePicker from "@/component/CustomDatePicker";
import { motion } from "framer-motion";
import type { BuckGoal } from "@/utils/supabaseData";

type CreateGoalModalProps = {
  onClose: () => void;
  onGoalCreated: (goal: BuckGoal) => void;
};

const CreateGoalModal: React.FC<CreateGoalModalProps> = ({ onClose, onGoalCreated }) => {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    goalName: "",
    targetAmount: "",
    attitude: "",
    targetDate: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.id]: e.target.value });
  };

  const handleGoalCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await createGoal(
      form.goalName,
      form.targetAmount,
      form.attitude,
      form.targetDate
    );
    setSubmitting(false);
    const createdGoal = result.success ? result.goal : undefined;
    if (createdGoal) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onGoalCreated(createdGoal); // Pass the new goal object up!
      }, 1000);
    }
  };

  return (
    <motion.div 
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div 
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label="Create a new goal"
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
          <span aria-hidden="true">×</span>
        </button>
        <h2 className="create-goal-title">Create a New Goal</h2>
        {success && (
          <div className="create-goal-success">
            Goal created successfully!
          </div>
        )}
        <form onSubmit={handleGoalCreate} className="create-goal-form">
          <input
            id="goalName"
            type="text"
            placeholder="Goal Name"
            value={form.goalName}
            onChange={handleChange}
            required
            className="create-goal-input"
          />
          <input
            id="targetAmount"
            type="number"
            placeholder="Budget"
            value={form.targetAmount}
            onChange={handleChange}
            required
            min={1}
            className="create-goal-input"
          />
          <CustomSelect
            value={form.attitude}
            onChange={(val) => setForm(prev => ({ ...prev, attitude: val }))}
            options={[
              { value: "", label: "Select Attitude" },
              { value: "Normal", label: "Normal" },
              { value: "Moderate", label: "Moderate" },
              { value: "Aggressive", label: "Aggressive" }
            ]}
            className="create-goal-input"
          />
          <CustomDatePicker
            id="targetDate"
            placeholder="Target Date (YYYY-MM-DD)"
            value={form.targetDate}
            onChange={(val) => setForm(prev => ({ ...prev, targetDate: val }))}
            required
            className="create-goal-input"
          />
          <button
            type="submit"
            className={`nav-button create-goal-button${submitting ? ' create-goal-button-disabled' : ''}`}
            disabled={submitting}
          >
            {submitting ? "Creating..." : "Create Goal"}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default CreateGoalModal;