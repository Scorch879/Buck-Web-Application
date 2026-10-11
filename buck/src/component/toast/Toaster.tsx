"use client";

import React from "react";
import { AnimatePresence } from "framer-motion";
import ToastItem, { type ToastItemData } from "./ToastItem";
import styles from "./toast.module.css";

interface ToasterProps {
  toasts: ToastItemData[];
  onRemove: (id: string) => void;
}

export default function Toaster({ toasts, onRemove }: ToasterProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className={styles.toastContainer}
      aria-label="Notifications"
      role="region"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
}
