import Link from "next/link";
import { FaCheck } from "react-icons/fa";
import styles from "./gettingStarted.module.css";

export type GettingStartedTask = {
  id: string;
  title: string;
  /** One plain sentence: what the step does for the user. */
  description: string;
  /** Where the step is done. */
  href: string;
  /** Button text; says what happens next. */
  cta: string;
  done: boolean;
};

type GettingStartedCardProps = {
  tasks: GettingStartedTask[];
  onHide: () => void;
  onTaskOpen?: (taskId: string) => void;
};

/**
 * First-run checklist for the Home tab (ADR-057). Presentational only: the
 * steps and whether each is done come from the caller. The first step still
 * open is the "next" one and gets the filled button; the rest stay quiet.
 */
export default function GettingStartedCard({ tasks, onHide, onTaskOpen }: GettingStartedCardProps) {
  const doneCount = tasks.filter((task) => task.done).length;
  const allDone = doneCount === tasks.length;
  const nextId = tasks.find((task) => !task.done)?.id;

  return (
    <section className={styles.card} aria-labelledby="getting-started-title">
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Getting started</p>
          <h2 id="getting-started-title" className={styles.title}>
            {allDone ? "You're all set" : "Set up Buck in a few steps"}
          </h2>
          <p className={styles.lede}>
            {allDone
              ? "Buck now has what it needs. Your charts, forecast and advice update as you log more."
              : "Buck's charts, forecast and advice are built from your own numbers. These steps give it enough to start."}
          </p>
        </div>
        <button type="button" className={styles.hide} onClick={onHide}>
          {allDone ? "Close" : "Dismiss"}
        </button>
      </header>

      <div className={styles.progressRow}>
        <div
          className={styles.progress}
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={tasks.length}
          aria-valuenow={doneCount}
          aria-valuetext={`${doneCount} of ${tasks.length} steps done`}
        >
          <span style={{ width: `${(doneCount / tasks.length) * 100}%` }} />
        </div>
        <span className={styles.progressText}>
          {doneCount} of {tasks.length} done
        </span>
      </div>

      <ol className={styles.tasks}>
        {tasks.map((task, index) => {
          const isNext = task.id === nextId;
          return (
            <li
              key={task.id}
              className={`${styles.task}${task.done ? ` ${styles.taskDone}` : ""}${isNext ? ` ${styles.taskNext}` : ""}`}
            >
              <span className={styles.marker} aria-hidden="true">
                {task.done ? <FaCheck /> : index + 1}
              </span>
              <div className={styles.taskCopy}>
                <h3>{task.title}</h3>
                <p>{task.description}</p>
              </div>
              {task.done ? (
                <span className={styles.doneLabel}>Done</span>
              ) : (
                <Link
                  href={task.href}
                  className={isNext ? styles.ctaPrimary : styles.cta}
                  onClick={() => onTaskOpen?.(task.id)}
                >
                  {task.cta}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
