import type { Metadata } from "next";
import Link from "next/link";

import {
  EXAM_SIZE,
  EXAM_TIME_LIMIT_MINUTES,
  examState,
  PASS_RATIO,
  RETRY_HOURS,
  requireAcademy,
} from "@/lib/academy/academy";
import { startExamAction } from "../actions";
import { AcademyShell } from "../academy-shell";
import styles from "../academy.module.css";
import { ExamForm } from "./exam-form";

export const metadata: Metadata = { title: "Exam · Academy · Centurie Growth" };

const dateEn = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default async function ExamPage() {
  const viewer = await requireAcademy("/academy/exam");
  const state = viewer.mode === "sales" ? await examState(viewer.user.id) : null;
  const passPercent = Math.round(PASS_RATIO * 100);

  return (
    <AcademyShell viewer={viewer} back={{ href: "/academy", label: "Academy" }}>
      <header>
        <span className={styles.eyebrow}>Accreditation exam</span>
        <h1 className={styles.title}>Centurie Growth partner exam</h1>
        <p className={styles.lead}>
          {EXAM_SIZE} questions drawn at random. You need {passPercent}% to pass, and no critical error: choosing a forbidden
          promise on a critical question fails the exam. You have {EXAM_TIME_LIMIT_MINUTES} minutes once you start. If you
          don&apos;t pass, you can try again after {RETRY_HOURS} hours.
        </p>
      </header>

      {state === null && <p className={styles.notice}>Preview mode: the exam is only available to sales partners.</p>}

      {state?.status === "locked" && (
        <section className={styles.card}>
          <p className={styles.cardText}>
            Finish the course first: {state.remaining} module{state.remaining > 1 ? "s" : ""} left.
          </p>
          <Link href="/academy" className={styles.primary}>
            Back to the course
          </Link>
        </section>
      )}

      {state?.status === "accredited" && (
        <section className={styles.card}>
          <p className={styles.cardText}>You are already accredited.</p>
          <Link href="/academy/certificate" className={styles.primary}>
            View my certificate
          </Link>
        </section>
      )}

      {state?.status === "cooldown" && (
        <section className={styles.card}>
          <p className={styles.cardText}>
            You can take the exam again from {dateEn.format(state.retryAt)}. Use the time to review the modules.
          </p>
          <Link href="/academy" className={styles.ghost}>
            Review the course
          </Link>
        </section>
      )}

      {state?.status === "ready" && (
        <section className={styles.card}>
          <p className={styles.cardText}>
            Make sure you have {EXAM_TIME_LIMIT_MINUTES} quiet minutes. The timer starts as soon as you click, and leaving the
            exam unfinished counts as a failed attempt.
          </p>
          <form action={startExamAction}>
            <button type="submit" className={styles.primary}>
              Start the exam
            </button>
          </form>
        </section>
      )}

      {state?.status === "in_progress" && (
        <ExamForm
          attemptId={state.attemptId}
          deadline={state.deadline.toISOString()}
          questions={state.questions}
          passPercent={passPercent}
        />
      )}
    </AcademyShell>
  );
}
