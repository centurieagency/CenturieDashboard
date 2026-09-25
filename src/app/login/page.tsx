import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = {
  title: "Log in · Centurie Growth",
};

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

/** Accepte uniquement un chemin interne pour éviter les redirections ouvertes. */
function safeCallbackUrl(value: string | undefined): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl, error } = await searchParams;
  const redirectTo = safeCallbackUrl(callbackUrl);

  if (await auth()) redirect(redirectTo);

  return (
    <div className={styles.shell}>
      <aside className={styles.aside}>
        <Image
          src="/brand/centurie-mark-white.png"
          alt=""
          width={700}
          height={599}
          className={styles.watermark}
          aria-hidden
        />
        <BrandLockup tone="dark" />
        <div className={styles.pitch}>
          <span className={styles.eyebrowOnDark}>Client space</span>
          <h2 className={styles.pitchTitle}>Followers were never the point.</h2>
          <p className={styles.pitchText}>
            Track your growth, review your monthly report and talk to the person managing your account.
          </p>
        </div>
        <div className={styles.asideFooter}>
          <div className={styles.ruleOnDark} />
          <span>No bots. No ads. No guesswork.</span>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.topbar}>
          <span>New to Centurie Growth?</span>
          <Link href="/signup" className={styles.ghostButton}>
            Create an account
          </Link>
        </div>

        <div className={styles.center}>
          <div className={styles.formColumn}>
            <div className={styles.heading}>
              <span className={styles.eyebrow}>Welcome back</span>
              <h1 className={styles.title}>Log in to your account</h1>
            </div>

            <LoginForm callbackUrl={redirectTo} initialError={error} />

            <div className={styles.mobileSignup}>
              <div className={styles.rule} />
              <span>New to Centurie Growth?</span>
              <Link href="/signup" className={styles.ghostButtonBlock}>
                Create an account
              </Link>
            </div>
          </div>
        </div>

        <footer className={styles.legal}>
          <span>© 2026 Centurie Growth, a Centurie Agency company</span>
          <span>Terms · Privacy</span>
        </footer>
      </main>
    </div>
  );
}
