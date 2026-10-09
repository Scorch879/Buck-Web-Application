"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
  useEffect,
  useMemo,
} from "react";
import Toaster from "./Toaster";
import type { ToastItemData, ToastType, ToastAction } from "./ToastItem";

export type { ToastType, ToastAction };

export interface ToastOptions {
  title?: string;
  duration?: number;
  action?: ToastAction;
}

export type Toast = ToastItemData;

export interface ToastFunction {
  (
    message: string,
    typeOrOptions?: ToastType | ToastOptions,
    maybeOptions?: ToastOptions
  ): string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  loading: (message: string, options?: ToastOptions) => string;
  dismiss: (id?: string) => void;
}

interface ToastContextValue {
  toast: ToastFunction;
  dismiss: (id?: string) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Standalone global emitter bus for calling toast outside React tree
type ToastListener = (toast: ToastItemData) => void;
type DismissListener = (id?: string) => void;

const toastListeners = new Set<ToastListener>();
const dismissListeners = new Set<DismissListener>();

export function emitGlobalToast(toast: ToastItemData) {
  toastListeners.forEach((fn) => fn(toast));
}

export function emitGlobalDismiss(id?: string) {
  dismissListeners.forEach((fn) => fn(id));
}

function createToastCallable(
  dispatchToast: (toast: ToastItemData) => void,
  dispatchDismiss: (id?: string) => void
): ToastFunction {
  const toastFn = (
    message: string,
    typeOrOptions?: ToastType | ToastOptions,
    maybeOptions?: ToastOptions
  ): string => {
    const id = `buck-toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let type: ToastType = "info";
    let options: ToastOptions | undefined = undefined;

    if (typeof typeOrOptions === "string") {
      type = typeOrOptions;
      options = maybeOptions;
    } else if (typeof typeOrOptions === "object" && typeOrOptions !== null) {
      options = typeOrOptions;
    }

    const toastData: ToastItemData = {
      id,
      message,
      title: options?.title,
      type,
      duration: options?.duration,
      action: options?.action,
    };

    dispatchToast(toastData);
    return id;
  };

  toastFn.success = (message: string, options?: ToastOptions) => {
    return toastFn(message, "success", options);
  };

  toastFn.error = (message: string, options?: ToastOptions) => {
    return toastFn(message, "error", options);
  };

  toastFn.warning = (message: string, options?: ToastOptions) => {
    return toastFn(message, "warning", options);
  };

  toastFn.info = (message: string, options?: ToastOptions) => {
    return toastFn(message, "info", options);
  };

  toastFn.loading = (message: string, options?: ToastOptions) => {
    return toastFn(message, "loading", options);
  };

  toastFn.dismiss = (id?: string) => {
    dispatchDismiss(id);
  };

  return toastFn;
}

// Global standalone toast instance
export const toast: ToastFunction = createToastCallable(
  emitGlobalToast,
  emitGlobalDismiss
);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((newToast: ToastItemData) => {
    setToasts((prev) => {
      // Limit to 4 active toasts max on screen to avoid vertical viewport crowding
      const next = [...prev, newToast];
      return next.length > 4 ? next.slice(next.length - 4) : next;
    });
  }, []);

  const dismissToast = useCallback((id?: string) => {
    if (id) {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    } else {
      setToasts([]);
    }
  }, []);

  // Listen to external/global toast emissions
  useEffect(() => {
    const handleToast: ToastListener = (incomingToast) => {
      if (isMounted.current) {
        addToast(incomingToast);
      }
    };

    const handleDismiss: DismissListener = (dismissId) => {
      if (isMounted.current) {
        dismissToast(dismissId);
      }
    };

    toastListeners.add(handleToast);
    dismissListeners.add(handleDismiss);

    return () => {
      toastListeners.delete(handleToast);
      dismissListeners.delete(handleDismiss);
    };
  }, [addToast, dismissToast]);

  const boundToast = useMemo(
    () => createToastCallable(addToast, dismissToast),
    [addToast, dismissToast]
  );

  return (
    <ToastContext.Provider
      value={{
        toast: boundToast,
        dismiss: dismissToast,
        toasts,
      }}
    >
      {children}
      <Toaster toasts={toasts} onRemove={removeToast} />
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
