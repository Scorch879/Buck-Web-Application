import React, { useState } from "react";
import { createGoal } from "@/component/goals";
import "./style.css";

type CreateGoalModalProps = {
  onClose: () => void;
  onGoalCreated: (goal: any) => void;
};

const CreateGoalModal: React.FC<CreateGoalModalProps> = ({ onClose, onGoalCreated }) => {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    goalName: "",
    targetAmount: "",
    Attitude: "",
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
      form.Attitude,
      form.targetDate
    );
    setSubmitting(false);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onGoalCreated(result.goal); // Pass the new goal object up!
      }, 1000);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>×</button>
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
          <select
            id="Attitude"
            value={form.Attitude}
            onChange={handleChange}
            required
            className="create-goal-input"
          >
            <option value="" disabled>Select Attitude</option>
            <option value="Frugal">Normal</option>
            <option value="Moderate">Moderate</option>
            <option value="Generous">Aggressive</option>
          </select>
          <input
            id="targetDate"
            type="date"
            placeholder="Target Date (YYYY-MM-DD)"
            value={form.targetDate}
            onChange={handleChange}
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
      </div>
    </div>
  );
};

export default CreateGoalModal;