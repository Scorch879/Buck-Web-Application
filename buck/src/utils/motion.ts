import type { MotionProps, Transition } from "framer-motion";

/**
 * Shared motion presets (ADR-054). Every modal, popover and sidebar uses
 * these so the whole app moves with one rhythm:
 *   - things that open ease out (fast start, soft landing) or use one spring;
 *   - things that close are quicker and ease in, so they never linger;
 *   - nothing travels more than ~12px or scales below 0.97, so nothing "pops".
 * Reduced motion is handled once by <MotionProvider> (MotionConfig
 * reducedMotion="user"), which drops transform animations for those users.
 */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;

export const DURATION = {
  fast: 0.16,
  base: 0.22,
  slow: 0.32,
} as const;

/** One spring for panels and the sidebar: settles in ~300 ms, no bounce. */
export const SPRING: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 34,
  mass: 0.8,
};

export const INSTANT: Transition = { duration: 0 };

type Preset = Pick<MotionProps, "initial" | "animate" | "exit" | "transition">;

/** Dimmed page behind a modal. */
export const backdropMotion: Preset = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: DURATION.fast, ease: EASE_IN } },
  transition: { duration: DURATION.base, ease: EASE_OUT },
};

/** Modal card: rises 12px and settles from 97% scale. */
export const panelMotion: Preset = {
  initial: { opacity: 0, y: 12, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.98,
    transition: { duration: DURATION.fast, ease: EASE_IN },
  },
  transition: SPRING,
};

/** Dropdowns, date pickers and small menus that drop below their trigger. */
export const popoverMotion: Preset = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    transition: { duration: 0.12, ease: EASE_IN },
  },
  transition: { duration: DURATION.fast, ease: EASE_OUT },
};

/** Labels that appear and disappear as the sidebar opens and closes. */
export const LABEL_TRANSITION: Transition = {
  duration: DURATION.base,
  ease: EASE_OUT,
};
