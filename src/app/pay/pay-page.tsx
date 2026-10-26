import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand-lockup";
import styles from "@/app/academy/academy.module.css";

/** Cadre simple des pages publiques de paiement (confirmation, lien indisponible). */
export function PayPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <main className={styles.main} style={{ maxWidth: 560 }}>
        <BrandLockup tone="dark" size="lg" />
        <section className={styles.card}>
          <h1 className={styles.cardTitle} style={{ fontSize: 24 }}>
            {title}
          </h1>
          {children}
          <Link href="https://www.centuriegrowth.com" className={styles.ghost}>
            Back to Centurie Growth
          </Link>
        </section>
      </main>
    </div>
  );
}
