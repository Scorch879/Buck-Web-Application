import React from 'react';
import './progress-bar.css';
import { formatCurrency } from "@/utils/formatters";

interface Goal {
  id: string;
  goalName: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string;
  createdAt: string;
  attitude?: string;
  isActive?: boolean;
  completed?: boolean;
}

interface ProgressBarCardProps {
  goal: Goal;
  onAddProgress: (goal: Goal) => void;
}

const ProgressBarCard: React.FC<ProgressBarCardProps> = ({ goal, onAddProgress }) => {
  const currentAmount = goal.currentAmount || 0;
  const progressPercentage = Math.min((currentAmount / goal.targetAmount) * 100, 100);
  const remainingAmount = Math.max(goal.targetAmount - currentAmount, 0);

  // SVG ring parameters
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progressPercentage / 100) * circumference;

  // Color transitions: red → orange → gold based on progress
  const ringColor =
    progressPercentage >= 100
      ? '#ffc547'
      : progressPercentage >= 60
      ? '#ff7a33'
      : progressPercentage >= 30
      ? '#f47536'
      : '#ff3838';

  return (
    <div className="progress-card">
      <div className="progress-ring-layout">
        {/* Liquid Circle */}
        <div className="progress-liquid-container">
          <div 
            className="progress-liquid-fill" 
            style={{ height: `${progressPercentage}%` }}
          ></div>
          <div className="progress-liquid-text" style={{ color: progressPercentage > 50 ? '#fff' : 'var(--buck-ink)' }}>
            <span className="progress-liquid-title">Goal Progress</span>
            <span className="progress-liquid-pct">{Math.round(progressPercentage)}%</span>
          </div>
        </div>

        {/* Text info panel */}
        <div className="progress-info">
          <h3 className="progress-title">Goal Progress</h3>
          <div className="progress-stats">
            <span className="progress-amount">
              Saved: <strong>{formatCurrency(currentAmount)}</strong>
            </span>
            <span className="progress-remaining">
              Remaining: <strong>{formatCurrency(remainingAmount)}</strong>
            </span>
            <span className="progress-target">
              Target: <strong>{formatCurrency(goal.targetAmount)}</strong>
            </span>
          </div>
          <button
            type="button"
            className="progress-add-btn"
            onClick={() => onAddProgress(goal)}
          >
            + Add Progress
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProgressBarCard;
