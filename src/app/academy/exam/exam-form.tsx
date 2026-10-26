"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import type { ExamResult } from "@/lib/academy/academy";
import type { PublicQuestion } from "@/lib/academy/content";
import { submitExamAction } from "../actions";
import styles from "../academy.module.css";

const STORAGE = (attemptId: string) => `centurie-exam-${attemptId}`;

/** Examen en cours : réponses gardées dans ce navigateur (rechargement sans perte), remise et correction côté serveur. */
export function ExamForm({
  attemptId,
  deadline,
  questions,
  passPercent,
}: {
  attemptId: string;
  deadline: string;
  questions: PublicQuestion[];
  passPercent: number;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE(attemptId)) ?? "{}");
      // Lecture unique au montage : réponses déjà données avant un rechargement.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && typeof saved === "object") setAnswers(saved);
    } catch {}
  }, [attemptId]);

  useEffect(() => {
    const end = new Date(deadline).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  function choose(id: string, key: string) {
    setAnswers((prev) => {
      const next = { ...prev, [id]: key };
      try {
        localStorage.setItem(STORAGE(attemptId), JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = questions.length - Object.keys(answers).length;
    if (missing > 0 && !window.confirm(`${missing} question(s) unanswered. Submit anyway?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await submitExamAction(attemptId, answers);
      if (res.ok) {
        setResult(res.result);
        try {
          localStorage.removeItem(STORAGE(attemptId));
        } catch {}
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else setError(res.error);
    });
  }

  if (result) {
    return (
      <section className={`${styles.card} ${styles.result}`} aria-live="polite">
        <span className={styles.eyebrow}>{result.passed ? "Passed" : "Not passed"}</span>
        <p className={styles.resultScore}>
          {result.score}
          <small> / {result.total}</small>
        </p>
        {result.passed ? (
          <>
            <p className={styles.lead} style={{ margin: "14px auto 22px" }}>
              Congratulations, you are now an accredited Centurie Growth partner. Certificate {result.certificateNumber}.
            </p>
            <Link href="/academy/certificate" className={styles.primary}>
              View my certificate
            </Link>
          </>
        ) : (
          <>
            <p className={styles.lead} style={{ margin: "14px auto 10px" }}>
              {result.criticalFailed
                ? "You chose a forbidden promise on a critical question. That fails the exam, whatever the score."
                : `You need ${passPercent}% to pass.`}{" "}
              You can try again in 24 hours.
            </p>
            {result.weakSections.length > 0 && (
              <p className={styles.cardText}>Review these topics: {result.weakSections.join(", ")}.</p>
            )}
            <Link href="/academy" className={styles.ghost}>
              Back to the Academy
            </Link>
          </>
        )}
      </section>
    );
  }

  const answered = Object.keys(answers).filter((id) => questions.some((q) => q.id === id)).length;
  const mm = left != null ? String(Math.floor(left / 60)).padStart(2, "0") : "--";
  const ss = left != null ? String(left % 60).padStart(2, "0") : "--";

  return (
    <form onSubmit={submit} className={styles.form}>
      <div className={styles.examBar}>
        <span>
          Answered <b>{answered}</b> / {questions.length}
        </span>
        <span className={left != null && left < 300 ? styles.timeLow : undefined}>
          Time left <b>{mm}:{ss}</b>
        </span>
      </div>

      {questions.map((q, i) => (
        <fieldset key={q.id} className={styles.question}>
          <legend>
            <span>
              Question {i + 1} of {questions.length}
            </span>
            {q.text}
          </legend>
          {q.options.map((o) => (
            <label key={o.key} className={styles.option}>
              <input
                type="radio"
                name={q.id}
                value={o.key}
                checked={answers[q.id] === o.key}
                onChange={() => choose(q.id, o.key)}
              />
              {o.text}
            </label>
          ))}
        </fieldset>
      ))}

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={pending || left === 0}>
          {pending ? "Submitting…" : "Submit my answers"}
        </button>
        {left === 0 && <span className={styles.error}>Time is up.</span>}
      </div>
    </form>
  );
}
