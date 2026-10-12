'use client';

import React, { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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

// 2-period seamless repeating wave paths across 280px width (140px wavelength)
const FRONT_WAVE_PATH =
  "M 0 0 C 20 -6, 50 -6, 70 0 C 90 6, 120 6, 140 0 C 160 -6, 190 -6, 210 0 C 230 6, 260 6, 280 0 L 280 180 L 0 180 Z";

const BACK_WAVE_PATH =
  "M 0 -2 C 25 3, 45 3, 70 -2 C 95 -7, 115 -7, 140 -2 C 165 3, 185 3, 210 -2 C 235 -7, 255 -7, 280 -2 L 280 180 L 0 180 Z";

const CREST_LINE_PATH =
  "M 0 0 C 20 -6, 50 -6, 70 0 C 90 6, 120 6, 140 0 C 160 -6, 190 -6, 210 0 C 230 6, 260 6, 280 0";

const ProgressBarCard: React.FC<ProgressBarCardProps> = ({ goal, onAddProgress }) => {
  const reactId = useId();
  const safeId = goal.id ? `${goal.id}-${reactId.replace(/:/g, '')}` : reactId.replace(/:/g, '');
  const shouldReduceMotion = useReducedMotion();

  const currentAmount = Math.max(0, goal.currentAmount || 0);
  const targetAmount = Math.max(1, goal.targetAmount || 1);
  const progressPercentage = Math.min(Math.max(0, (currentAmount / targetAmount) * 100), 100);
  const remainingAmount = Math.max(goal.targetAmount - currentAmount, 0);

  // Vertical position calculation:
  // At 0%: Y = 148 (below bottom)
  // At 100%: Y = -8 (fully covering top)
  const targetY = 148 - (progressPercentage / 100) * 156;

  const clipId = `liquid-clip-${safeId}`;
  const gradFrontId = `liquid-grad-front-${safeId}`;
  const gradBackId = `liquid-grad-back-${safeId}`;
  const ringGradId = `liquid-ring-${safeId}`;

  const isLowProgress = progressPercentage < 40;

  return (
    <div className="progress-card">
      <div className="progress-ring-layout">
        {/* Liquid Wavy Gauge */}
        <div
          className="progress-liquid-container"
          role="img"
          aria-label={`Goal progress: ${Math.round(progressPercentage)}% saved`}
        >
          <svg className="progress-liquid-svg" viewBox="0 0 140 140" aria-hidden="true">
            <defs>
              <clipPath id={clipId}>
                <circle cx="70" cy="70" r="66" />
              </clipPath>

              <linearGradient id={gradFrontId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffb03a" />
                <stop offset="35%" stopColor="#f47536" />
                <stop offset="100%" stopColor="#d9381e" />
              </linearGradient>

              <linearGradient id={gradBackId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f47536" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#df541c" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#a8280f" stopOpacity="0.7" />
              </linearGradient>

              <linearGradient id={ringGradId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(244, 117, 54, 0.4)" />
                <stop offset="50%" stopColor="rgba(255, 197, 71, 0.22)" />
                <stop offset="100%" stopColor="rgba(244, 117, 54, 0.4)" />
              </linearGradient>
            </defs>

            {/* Liquid wave body clipped to circular interior */}
            <g clipPath={`url(#${clipId})`}>
              <motion.g
                initial={{ y: 148 }}
                animate={{ y: targetY }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 65, damping: 16, mass: 0.9 }
                }
              >
                {/* Back Wave (slower, opposite slosh) */}
                <path
                  className="progress-wave-back"
                  d={BACK_WAVE_PATH}
                  fill={`url(#${gradBackId})`}
                />

                {/* Front Wave (primary amber-to-coral liquid) */}
                <path
                  className="progress-wave-front"
                  d={FRONT_WAVE_PATH}
                  fill={`url(#${gradFrontId})`}
                />

                {/* Surface Crest Highlight (liquid surface tension sheen) */}
                <path
                  className="progress-wave-crest"
                  d={CREST_LINE_PATH}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.45)"
                  strokeWidth="1.5"
                />
              </motion.g>
            </g>

            {/* Glass porthole outer rim */}
            <circle
              cx="70"
              cy="70"
              r="66"
              fill="none"
              stroke={`url(#${ringGradId})`}
              strokeWidth="4"
            />
          </svg>

          {/* Centered Liquid Progress Text */}
          <div
            className={`progress-liquid-text ${isLowProgress ? 'progress-liquid-text--low-progress' : ''}`}
          >
            <span className="progress-liquid-title">Saved</span>
            <span className="progress-liquid-pct">
              {Math.round(progressPercentage)}%
            </span>
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
