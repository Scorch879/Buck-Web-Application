"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  FaCheckCircle,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaTimes,
  FaSpinner,
} from "react-icons/fa";
import styles from "./toast.module.css";

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItemData {
  id: string;
  message: string;
  title?: string;
  type: ToastType;
  duration?: number;
  action?: ToastAction;
}

interface ToastItemProps {
  toast: ToastItemData;
  onRemove: (id: string) => void;
}

export default function ToastItem({ toast, onRemove }: ToastItemProps) {
  const duration = toast.duration ?? (toast.type === "loading" ? 0 : 4500);
  const [progress, setProgress] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(duration);

  useEffect(() => {
    if (duration <= 0) return;

    let timer: NodeJS.Timeout;
    let progressInterval: NodeJS.Timeout;

    if (!isPaused) {
      startTimeRef.current = Date.now();

      timer = setTimeout(() => {
        onRemove(toast.id);
      }, remainingTimeRef.current);

      const updateStep = 50;
      progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const currentRemaining = Math.max(0, remainingTimeRef.current - elapsed);
        setProgress(currentRemaining / duration);
      }, updateStep);
    }

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [isPaused, duration, toast.id, onRemove]);

  const handleMouseEnter = () => {
    if (duration <= 0) return;
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    if (duration <= 0) return;
    setIsPaused(false);
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return <FaCheckCircle aria-hidden="true" />;
      case "error":
        return <FaExclamationCircle aria-hidden="true" />;
      case "warning":
        return <FaExclamationTriangle aria-hidden="true" />;
      case "loading":
        return <FaSpinner className={styles.spinAnimation} aria-hidden="true" />;
      case "info":
      default:
        return <FaInfoCircle aria-hidden="true" />;
    }
  };

  const getTypeClass = (type: ToastType) => {
    switch (type) {
      case "success":
        return styles.toastSuccess;
      case "error":
        return styles.toastError;
      case "warning":
        return styles.toastWarning;
      case "loading":
        return styles.toastLoading;
      case "info":
      default:
        return styles.toastInfo;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.92, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className={`${styles.toastNotification} ${getTypeClass(toast.type)}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="alert"
      aria-live="assertive"
    >
      <div className={styles.toastIconBox}>{getIcon(toast.type)}</div>

      <div className={styles.toastContent}>
        {toast.title && <strong className={styles.toastTitle}>{toast.title}</strong>}
        <div
          className={`${styles.toastMessage} ${
            !toast.title ? styles["toastMessage--solo"] : ""
          }`}
        >
          {toast.message}
        </div>
        {toast.action && (
          <button
            type="button"
            className={styles.toastActionBtn}
            onClick={() => {
              toast.action?.onClick();
              onRemove(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        className={styles.toastClose}
        onClick={() => onRemove(toast.id)}
        aria-label="Close notification"
      >
        <FaTimes />
      </button>

      {duration > 0 && (
        <div className={styles.toastProgressTrack} aria-hidden="true">
          <div
            className={styles.toastProgressBar}
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      )}
    </motion.div>
  );
}
