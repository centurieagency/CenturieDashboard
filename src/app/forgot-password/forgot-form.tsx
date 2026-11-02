"use client";

import Link from "next/link";
import { useActionState } from "react";

import styles from "@/app/academy/academy.module.css";
import { forgotPasswordAction, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(forgotPasswordAction, {});
  if (state.sent) {
    return (
      <>
        <p role="status" className={styles.notice}>
          If an account exists for this email, a link is on its way. It works once, for 2 hours. Check your spam folder too.
        </p>
        <Link href="/login" className={styles.ghost}>
          Back to log in
        </Link>
      </>
    );
  }
  return (
    <form action={action} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="forgot-email">Email</label>
        <input id="forgot-email" name="email" type="email" autoComplete="email" required maxLength={254} />
      </div>
      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <button type="submit" className={styles.primary} disabled={pending}>
        {pending ? "Sending…" : "Send me a link"}
      </button>
    </form>
  );
}
