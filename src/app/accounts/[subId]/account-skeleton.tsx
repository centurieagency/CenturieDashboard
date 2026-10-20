import { SiteHeader } from "@/components/site-header";
import styles from "./account.module.css";
import sk from "./account-skeleton.module.css";

/**
 * Squelette de la page compte, affiché instantanément pendant le chargement (loading.tsx) :
 * même cadre que la page (en-tête, onglets, grille de l'overview), cartes qui scintillent.
 */
export function AccountSkeleton({ admin = false }: { admin?: boolean }) {
  return (
    <div className={styles.page}>
      <SiteHeader admin={admin} />
      <main className={styles.main} aria-busy="true">
        <span className={styles.back}>← All subscriptions</span>
        <p role="status" className={sk.srOnly}>
          Loading the account…
        </p>
        {admin && <div className={`${sk.block} ${sk.customer}`} />}
        <div className={styles.topRow} aria-hidden="true">
          <div className={styles.miniIdentity}>
            <span className={`${sk.block} ${sk.avatar}`} />
            <div>
              <span className={`${sk.block} ${sk.line}`} style={{ width: 120 }} />
              <span className={`${sk.block} ${sk.line}`} style={{ width: 80 }} />
            </div>
          </div>
          <div className={`${sk.block} ${sk.tabs}`} />
        </div>
        <div className={sk.grid} aria-hidden="true">
          <div className={`${sk.block} ${sk.profile}`} />
          <div className={`${sk.block} ${sk.chart}`} />
          <div className={`${sk.block} ${sk.kpi}`} />
          <div className={`${sk.block} ${sk.kpi}`} />
          <div className={`${sk.block} ${sk.kpi}`} />
          <div className={`${sk.block} ${sk.feed}`} />
          <div className={`${sk.block} ${sk.breakdown}`} />
        </div>
      </main>
    </div>
  );
}
