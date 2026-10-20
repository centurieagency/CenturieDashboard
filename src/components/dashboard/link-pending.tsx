"use client";

import { useLinkStatus } from "next/link";

import styles from "./subscriptions.module.css";

/** À placer dans un <Link> : petit spinner pendant que la page de destination se charge. */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span className={styles.linkSpinner} aria-hidden="true" /> : null;
}
