import Link from "next/link";
import { FaCompass } from "react-icons/fa";
import styles from "./newUserGuide.module.css";

/** Home URL that reopens the Getting started checklist, even if it was hidden. */
export const GUIDE_HREF = "/dashboard/home?guide=1";

/**
 * Friendly empty state for a new account. Pages that have nothing to show
 * yet use this instead of a row of "No data" messages, and point the user at
 * the Getting started checklist on Home.
 */
export default function NewUserGuide({
  title = "New to Buck?",
  message = "Here's a short guide to begin your journey. Add a wallet, log what you spend, and this page fills in by itself.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <section className={styles.card} aria-labelledby="new-user-guide-title">
      <span className={styles.icon} aria-hidden="true">
        <FaCompass />
      </span>
      <div className={styles.body}>
        <h2 id="new-user-guide-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.message}>{message}</p>
      </div>
      <Link href={GUIDE_HREF} className={styles.cta}>
        Open the guide
      </Link>
    </section>
  );
}
