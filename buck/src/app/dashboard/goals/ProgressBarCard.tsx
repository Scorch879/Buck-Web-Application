import React from 'react';
import './progress-bar.css';

interface Goal {
  id: string;
  goalName: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string;
  createdAt: string;
  attitude?: string;
  isActive?: boolean;
}

interface ProgressBarCardProps {
  goal: Goal;
  onAddProgress: (goal: Goal) => void;
}

const ProgressBarCard: React.FC<ProgressBarCardProps> = ({ goal }) => {

  const currentAmount = goal.currentAmount || 0;
  const progressPercentage = Math.min((currentAmount / goal.targetAmount) * 100, 100);
  const remainingAmount = Math.max(goal.targetAmount - currentAmount, 0);

  return (
    <div className="progress-card">
      <div className="progress-header">
        <h3 className="progress-title">Goal Progress</h3>
        <span className="progress-percentage">
          {Math.round(progressPercentage)}%
        </span>
      </div>
      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
      <div className="progress-stats">
        <span className="progress-amount">
          Saved: ${currentAmount.toLocaleString()}
        </span>
        <button
          className="addProgress-btns"
          style={{ margin: "0 1rem" }}
          onClick={() => onAddProgress(goal)}
        >
          Add Progress
        </button>
        <span className="progress-remaining">
          Remaining: ${remainingAmount.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default ProgressBarCard;