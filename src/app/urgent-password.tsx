"use client";

import { useActionState, useState } from "react";

import { passwordAction, type ActionState } from "./accounts/[subId]/actions";
import styles from "./urgent-password.module.css";

const IDLE: ActionState = { status: "idle" };

/** Encart urgent de la page principale : Instagram refuse le mot de passe, on demande le nouveau sur place. */
export function UrgentPassword({ subId, username }: { subId: string; username: string }) {
  const [state, action, pending] = useActionState(passwordAction.bind(null, subId), IDLE);
  const [show, setShow] = useState(false);
  const inputId = `urgent-pw-${subId}`;

  if (state.status === "success") {
    return (
      <section className={styles.banner} aria-labelledby={`${inputId}-title`}>
        <span className={styles.eyebrow}>Password received</span>
        <h2 id={`${inputId}-title`} className={styles.title}>
          Thanks. We&apos;re logging back in to @{username}.
        </h2>
        <p className={styles.text}>Growth resumes as soon as the connection goes through, usually within minutes.</p>
      </section>
    );
  }

  return (
    <section className={styles.banner} aria-labelledby={`${inputId}-title`}>
      <span className={styles.eyebrow}>Action needed</span>
      <h2 id={`${inputId}-title`} className={styles.title}>
        We can&apos;t log in to @{username}.
      </h2>
      <p className={styles.text}>
        Instagram rejected the password we have, so growth is on hold. Enter the current password to restart it.
      </p>
      <form action={action} className={styles.form}>
        <label htmlFor={inputId} className={styles.label}>
          New Instagram password for @{username}
        </label>
        <div className={styles.row}>
          <div className={styles.passwordWrap}>
            <input
              id={inputId}
              name="password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              className={styles.input}
              aria-invalid={state.status === "error" ? true : undefined}
              aria-describedby={state.status === "error" ? `${inputId}-error` : undefined}
              required
            />
            <button type="button" className={styles.toggle} onClick={() => setShow((v) => !v)} aria-pressed={show}>
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <button type="submit" className={styles.submit} disabled={pending}>
            {pending ? "Sending…" : "Update password"}
          </button>
        </div>
        {state.status === "error" && (
          <p id={`${inputId}-error`} role="alert" className={styles.error}>
            {state.message}
          </p>
        )}
      </form>
    </section>
  );
}
