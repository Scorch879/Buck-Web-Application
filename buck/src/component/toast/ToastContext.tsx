"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes, FaExclamationTriangle } from "react-icons/fa";
import styles from "./toast.module.css";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success": return <FaCheckCircle />;
      case "error": return <FaExclamationCircle />;
      case "warning": return <FaExclamationTriangle />;
      case "info":
      default:
        return <FaInfoCircle />;
    }
  };

  const getTypeClass = (type: ToastType) => {
    switch (type) {
      case "success": return styles.toastSuccess;
      case "error": return styles.toastError;
      case "warning": return styles.toastWarning;
      case "info":
      default:
        return styles.toastInfo;
    }
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className={styles.toastContainer}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`${styles.toastNotification} ${getTypeClass(t.type)}`}
            >
              <div className={styles.toastIcon}>
                {getIcon(t.type)}
              </div>
              <div className={styles.toastMessage}>{t.message}</div>
              <button
                className={styles.toastClose}
                onClick={() => removeToast(t.id)}
                aria-label="Close notification"
              >
                <FaTimes />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
