import styles from "./account-tabs.module.css";
import { TransitionLink } from "./tab-transition";

export const TABS = ["overview", "statistics", "targets", "settings", "analysis"] as const;
export type Tab = (typeof TABS)[number];

/** Onglets visibles : « analysis » (scores, recommandations) est réservé à l'admin. */
const visibleTabs = (admin: boolean) => TABS.filter((t) => admin || t !== "analysis");

export const parseTab = (value: string | undefined, admin = false): Tab =>
  (visibleTabs(admin) as readonly string[]).includes(value ?? "") ? (value as Tab) : "overview";

const LABEL: Record<Tab, string> = {
  overview: "Overview",
  statistics: "Statistics",
  targets: "Targets",
  settings: "Settings",
  analysis: "Analysis",
};

const ICON: Record<Tab, React.ReactNode> = {
  overview: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  statistics: <path d="M3.5 17.5 9 12l4 4 7.5-8M15 8h5.5v5.5" />,
  targets: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  settings: <path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 4.5v5M8 14.5v5" />,
  analysis: <path d="M12 3.5v4M12 20.5v-4M3.5 12h4M20.5 12h-4M6 6l2.6 2.6M18 18l-2.6-2.6M18 6l-2.6 2.6M6 18l2.6-2.6" />,
};

/** Onglets de la page compte (liens : l'onglet vit dans l'URL, ?tab=…). */
export function AccountTabs({ href, tab, days, admin }: { href: string; tab: Tab; days: number; admin: boolean }) {
  return (
    <nav className={styles.tabs} aria-label="Account sections">
      {visibleTabs(admin).map((t) => (
        <TransitionLink
          key={t}
          href={`${href}?tab=${t}${days !== 30 ? `&days=${days}` : ""}`}
          className={t === tab ? styles.tabOn : styles.tab}
          aria-current={t === tab ? "page" : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {ICON[t]}
          </svg>
          {LABEL[t]}
          {t === tab && <i className={styles.dot} aria-hidden="true" />}
        </TransitionLink>
      ))}
    </nav>
  );
}
