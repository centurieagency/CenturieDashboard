import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import styles from "@/components/auth/auth.module.css";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create your account · Centurie Growth",
};

const STEPS = [
  { title: "Connect", text: "Link your account. Takes minutes, no disruption." },
  { title: "Target", text: "We map your niche to reach people already interested." },
  { title: "Grow", text: "Daily, managed growth. We monitor, adjust and report." },
];

export default async function SignupPage() {
  if (await auth()) redirect("/");

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
        <div className={styles.asideTop}>
          <BrandLockup tone="dark" size="lg" />
          <Link href="/login" className={styles.lightGhostButton}>
            Log in
          </Link>
        </div>
        <div className={styles.pitch}>
          <span className={styles.eyebrowOnDark}>Get started</span>
          <h2 className={styles.pitchTitle}>Let&apos;s build your audience.</h2>
          <ol className={styles.steps}>
            {STEPS.map((step, i) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber}>{String(i + 1).padStart(2, "0")}.</span>
                <div className={styles.stepBody}>
                  <span className={styles.stepTitle}>{step.title}</span>
                  <span className={styles.stepText}>{step.text}</span>
                </div>
              </li>
            ))}
          </ol>
          <span className={styles.stepsInline}>
            {STEPS.map((step, i) => `${String(i + 1).padStart(2, "0")}. ${step.title}`).join(" · ")}
          </span>
        </div>
        <div className={styles.asideFooter}>
          <span>No bots. No ads. No guesswork.</span>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.topbar}>
          <span>Already a client?</span>
          <Link href="/login" className={styles.ghostButton}>
            Log in
          </Link>
        </div>

        <div className={styles.center}>
          <div className={`${styles.formColumn} ${styles.formColumnWide}`}>
            <div className={styles.heading}>
              <h1 className={styles.title}>Your account comes with your subscription</h1>
              <p className={styles.intro}>
                Your client space is created right after you subscribe: the payment confirmation page lets you set your
                password. Already a client without access? Your account manager can send you a personal link.
              </p>
            </div>

            <div className={styles.fields}>
              <a href="https://www.centuriegrowth.com/#plans" className={styles.primaryButton}>
                See the plans
              </a>
              <Link href="/login" className={styles.ghostButtonBlock}>
                I already have an account
              </Link>
            </div>
          </div>
        </div>

        <footer className={styles.legal}>
          <span>© 2026 Centurie Growth, a Centurie Agency company</span>
          <span>
            <a href="https://www.centuriegrowth.com/terms.html">Terms</a> ·{" "}
            <a href="https://www.centuriegrowth.com/privacy.html">Privacy</a>
          </span>
        </footer>
      </main>
    </div>
  );
}
