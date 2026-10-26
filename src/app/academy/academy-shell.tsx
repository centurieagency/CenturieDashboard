import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import type { AcademyViewer } from "@/lib/academy/academy";
import styles from "./academy.module.css";

/** Cadre des pages Academy : en-tête, lien retour, bandeau de relecture pour l'admin. */
export function AcademyShell({
  viewer,
  back,
  children,
}: {
  viewer: AcademyViewer;
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  const admin = viewer.mode === "preview";
  return (
    <div className={styles.page}>
      <div className={styles.noPrint}>
        <SiteHeader email={admin ? viewer.email : viewer.user.email} admin={admin} />
      </div>
      <main className={styles.main}>
        {back && (
          <Link href={back.href} className={`${styles.back} ${styles.noPrint}`}>
            ← {back.label}
          </Link>
        )}
        {admin && (
          <p className={`${styles.notice} ${styles.noPrint}`}>
            Mode relecture (admin) : tu vois le cours comme un apporteur, sans progression ni examen.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
