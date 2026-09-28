import type { StatusTone } from "@/lib/account-status";
import styles from "./status-badge.module.css";

/** Icône propre à chaque statut : la couleur n'est jamais le seul indice (daltonisme, impression). */
function Icon({ tone }: { tone: StatusTone }) {
  if (tone === "pending" || tone === "neutral") return <span className={styles.dot} aria-hidden="true" />;
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="8" />
      {tone === "ok" && <path d="M4.5 8.2l2.3 2.3 4.7-4.9" />}
      {tone === "warn" && <path d="M8 4.2v4.6M8 11.4v.4" />}
      {tone === "danger" && <path d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2" />}
    </svg>
  );
}

export function StatusBadge({ tone, label, size = "md" }: { tone: StatusTone; label: string; size?: "sm" | "md" }) {
  return (
    <span className={`${styles.badge} ${styles[tone]} ${size === "sm" ? styles.sm : ""}`}>
      <Icon tone={tone} />
      {label}
    </span>
  );
}
