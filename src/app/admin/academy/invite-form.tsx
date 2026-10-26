"use client";

import { useActionState, useState } from "react";

import styles from "@/app/academy/academy.module.css";
import { createInviteAction, type InviteState } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInviteAction, {});
  const [copied, setCopied] = useState(false);

  return (
    <div className={styles.form}>
      <form action={action} className={styles.form}>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label htmlFor="inv-email">Partner email</label>
            <input id="inv-email" name="email" type="email" required placeholder="partner@example.com" />
          </div>
          <div className={styles.field}>
            <label htmlFor="inv-name">Name (optional)</label>
            <input id="inv-name" name="name" maxLength={100} placeholder="First and last name" />
          </div>
        </div>
        <div className={styles.actions}>
          <button type="submit" className={styles.primary} disabled={pending}>
            {pending ? "Creating…" : "Create invitation link"}
          </button>
        </div>
      </form>
      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      {state.link && (
        <div className={styles.notice} role="status">
          <p style={{ margin: "0 0 8px" }}>
            Invitation for <b>{state.email}</b>. Send this link yourself (email, WhatsApp…). It works once, for 14 days, and
            won&apos;t be shown again.
          </p>
          <div className={styles.actions}>
            <code style={{ wordBreak: "break-all", fontSize: 13 }}>{state.link}</code>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                navigator.clipboard.writeText(state.link!).then(() => setCopied(true), () => setCopied(false));
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
