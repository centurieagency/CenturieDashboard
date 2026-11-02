"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "@/app/academy/academy.module.css";
import type { PasswordState } from "./actions";

/** Formulaire nom + mot de passe, puis connexion automatique au dashboard. */
export function PasswordForm({
  email,
  name,
  action,
  submitLabel,
}: {
  email: string;
  name: string | null;
  action: (prev: PasswordState, form: FormData) => Promise<PasswordState>;
  submitLabel: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    const state = await action({}, form);
    if (!state.done) {
      setError(state.error ?? "Something went wrong.");
      setPending(false);
      return;
    }
    const res = await signIn("credentials", { email, password: String(form.get("password")), redirect: false });
    router.push(res?.ok ? "/" : "/login");
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="pw-email">Email</label>
        <input id="pw-email" value={email} readOnly />
      </div>
      <div className={styles.field}>
        <label htmlFor="pw-name">Full name</label>
        <input id="pw-name" name="name" defaultValue={name ?? ""} autoComplete="name" required minLength={2} maxLength={100} />
      </div>
      <div className={styles.field}>
        <label htmlFor="pw-password">Password</label>
        <input id="pw-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </div>
      <div className={styles.field}>
        <label htmlFor="pw-confirm">Confirm password</label>
        <input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <button type="submit" className={styles.primary} disabled={pending}>
        {pending ? "Setting up…" : submitLabel}
      </button>
    </form>
  );
}
