import Link from "next/link";

import { SignOutButton } from "@/app/sign-out-button";
import { BrandLockup } from "@/components/brand/brand-lockup";
import styles from "./site-header.module.css";

export function SiteHeader({ email }: { email?: string | null }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.home} aria-label="Centurie Growth, back to subscriptions">
          <BrandLockup tone="light" />
        </Link>
        <div className={styles.account}>
          {email && <span className={styles.email}>{email}</span>}
          <SignOutButton className={styles.ghostButton} />
        </div>
      </div>
    </header>
  );
}
