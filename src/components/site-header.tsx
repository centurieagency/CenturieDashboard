import Link from "next/link";

import { SignOutButton } from "@/app/sign-out-button";
import { BrandLockup } from "@/components/brand/brand-lockup";
import styles from "./site-header.module.css";

export function SiteHeader({ email, admin = false }: { email?: string | null; admin?: boolean }) {
  const home = admin ? "/admin" : "/";
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link href={home} className={styles.home} aria-label="Centurie Growth, back to subscriptions">
            <BrandLockup tone="light" />
          </Link>
          {admin && <span className={styles.adminTag}>Admin</span>}
        </div>
        <div className={styles.account}>
          {email && <span className={styles.email}>{email}</span>}
          <SignOutButton className={styles.ghostButton} />
        </div>
      </div>
    </header>
  );
}
