"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";

/**
 * One place for app-wide motion settings (ADR-054). reducedMotion="user"
 * turns off transform and layout animations for people who ask their OS for
 * less motion; opacity fades stay so state changes are still visible.
 */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
