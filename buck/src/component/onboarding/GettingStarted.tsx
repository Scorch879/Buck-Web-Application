"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SPRING } from "@/utils/motion";
import {
  getOnboardingStatus,
  subscribeUserTable,
  type OnboardingStatus,
} from "@/utils/supabaseData";
import GettingStartedCard, { type GettingStartedTask } from "./GettingStartedCard";

const STORAGE_KEY = "buck:getting-started";

type TaskId = "wallet" | "expense" | "income" | "goal" | "advisor";

/**
 * What this browser remembers about the checklist. It only decides what to
 * show before the data arrives and whether the card was dismissed; whether a
 * step is done always comes from the user's own data.
 */
type Saved = {
  userId: string;
  /** "open" = still showing; "finished" = done or dismissed, never ask again. */
  state: "open" | "finished";
  /** Steps on the list, in order (income is left out where it isn't tracked). */
  ids: TaskId[];
  done: TaskId[];
  metAdvisor: boolean;
};

const TASK_COPY: Record<TaskId, Omit<GettingStartedTask, "id" | "done">> = {
  wallet: {
    title: "Add your first wallet",
    description: "Tell Buck how much money you have in cash, a bank or an e-wallet.",
    href: "/dashboard/wallet",
    cta: "Add a wallet",
  },
  expense: {
    title: "Log an expense",
    description: "Add something you spent today. It comes out of your wallet and shows up in your charts.",
    href: "/dashboard/expenses",
    cta: "Add an expense",
  },
  income: {
    title: "Record your income",
    description: "Add your salary or allowance so Buck can show what is left after spending.",
    href: "/dashboard/wallet?view=income",
    cta: "Add income",
  },
  goal: {
    title: "Set a savings goal",
    description: "Pick an amount and a date. Buck works out how much to save each day.",
    href: "/dashboard/goals",
    cta: "Create a goal",
  },
  advisor: {
    title: "Meet your AI Advisor",
    description: "See advice and a forecast based on what you have logged.",
    href: "/dashboard/financial-advisor",
    cta: "Open the Advisor",
  },
};

function readSaved(userId: string): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Saved>;
    if (saved.userId !== userId || !Array.isArray(saved.ids) || !Array.isArray(saved.done)) return null;
    return {
      userId,
      state: saved.state === "finished" ? "finished" : "open",
      ids: saved.ids.filter((id): id is TaskId => id in TASK_COPY),
      done: saved.done.filter((id): id is TaskId => id in TASK_COPY),
      metAdvisor: Boolean(saved.metAdvisor),
    };
  } catch {
    return null;
  }
}

function writeSaved(saved: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Private mode or blocked storage: the card still works for this visit.
  }
}

function fromStatus(userId: string, status: OnboardingStatus, metAdvisor: boolean): Saved {
  const steps: [TaskId, boolean | null][] = [
    ["wallet", status.hasWallet],
    ["expense", status.hasExpense],
    ["income", status.hasIncome],
    ["goal", status.hasGoal],
    ["advisor", metAdvisor],
  ];
  // null = not tracked on this database, so the step isn't offered.
  const offered = steps.filter(([, done]) => done !== null);
  const done = offered.filter(([, isDone]) => isDone).map(([id]) => id);
  return {
    userId,
    state: "open",
    ids: offered.map(([id]) => id),
    done,
    metAdvisor,
  };
}

function toTasks(saved: Saved): GettingStartedTask[] {
  return saved.ids.map((id) => ({ id, ...TASK_COPY[id], done: saved.done.includes(id) }));
}

/**
 * The "Getting started" checklist at the top of Home for a new account
 * (ADR-057). Steps tick themselves off from the user's own wallets, expenses,
 * income and goals, and the card leaves once everything is done or the user
 * dismisses it.
 *
 * `preview` renders the remembered card without loading anything. The Home
 * skeleton uses it so the page doesn't jump when the real card takes over
 * (ADR-012).
 */
export default function GettingStarted({
  userId,
  preview = false,
}: {
  userId: string;
  preview?: boolean;
}) {
  const [saved, setSaved] = useState<Saved | null>(null);
  // True once this browser's memory has been read (after the first render).
  const [restored, setRestored] = useState(false);
  // The card slides open only when it appears for the first time; a remembered
  // card is simply there.
  const [slideIn, setSlideIn] = useState(false);
  const savedRef = useRef<Saved | null>(null);

  const apply = useCallback((next: Saved) => {
    savedRef.current = next;
    setSaved(next);
    writeSaved(next);
  }, []);

  useLayoutEffect(() => {
    const remembered = readSaved(userId);
    savedRef.current = remembered;
    setSaved(remembered);
    setRestored(true);
  }, [userId]);

  useEffect(() => {
    if (preview || !restored) return;
    if (savedRef.current?.state === "finished") return;
    let active = true;

    const refresh = async () => {
      try {
        const status = await getOnboardingStatus(userId);
        if (!active) return;
        const previous = savedRef.current;
        if (previous?.state === "finished") return;
        const next = fromStatus(userId, status, previous?.metAdvisor ?? false);
        // The Advisor step has no data behind it, so an account whose data
        // steps are all done on first sight was already set up.
        const dataDone = next.ids
          .filter((id) => id !== "advisor")
          .every((id) => next.done.includes(id));
        if (dataDone && !previous) {
          // An account that was already set up: never show the checklist.
          apply({ ...next, state: "finished" });
          return;
        }
        if (!previous) setSlideIn(true);
        apply(next);
      } catch (error) {
        console.error("Failed to load the getting-started steps:", error);
      }
    };

    void refresh();
    const unsubscribes = (["wallets", "expenses", "incomes", "goals"] as const).map((table) =>
      subscribeUserTable(table, userId, () => void refresh())
    );
    return () => {
      active = false;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [apply, preview, restored, userId]);

  const visible = Boolean(saved && saved.state === "open" && saved.ids.length > 0);

  const handleHide = () => {
    if (!saved) return;
    apply({ ...saved, state: "finished" });
  };

  const handleTaskOpen = (taskId: string) => {
    // "Meet your AI Advisor" has no data to check, so opening it completes it.
    if (taskId !== "advisor" || !saved || saved.metAdvisor) return;
    apply({ ...saved, metAdvisor: true, done: [...saved.done, "advisor"] });
  };

  if (preview) {
    return visible && saved ? (
      <div inert aria-hidden="true">
        <GettingStartedCard tasks={toTasks(saved)} onHide={() => {}} />
      </div>
    ) : null;
  }

  return (
    <AnimatePresence initial={false}>
      {visible && saved && (
        <motion.div
          key="getting-started"
          // Clipped only while the height animates, so the card keeps its shadow.
          initial={slideIn ? { height: 0, opacity: 0, overflow: "hidden" } : false}
          animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
          exit={{ height: 0, opacity: 0, overflow: "hidden" }}
          transition={SPRING}
        >
          <GettingStartedCard tasks={toTasks(saved)} onHide={handleHide} onTaskOpen={handleTaskOpen} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
