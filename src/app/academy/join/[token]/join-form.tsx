"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { joinAcademyAction } from "../../actions";
import styles from "../../academy.module.css";

export function JoinForm({ token, email, name }: { token: string; email: string; name: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (form.get("password") !== form.get("confirm")) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setError(null);
    setPending(true);
    const state = await joinAcademyAction({}, form);
    if (!state.done) {
      setError(state.error ?? "Une erreur est survenue.");
      setPending(false);
      return;
    }
    const res = await signIn("credentials", { email, password: String(form.get("password")), redirect: false });
    if (res?.ok) router.push("/academy");
    else router.push("/login?callbackUrl=/academy");
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <input type="hidden" name="token" value={token} />
      <div className={styles.field}>
        <label htmlFor="join-email">Email</label>
        <input id="join-email" value={email} readOnly />
      </div>
      <div className={styles.field}>
        <label htmlFor="join-name">Nom complet</label>
        <input id="join-name" name="name" defaultValue={name ?? ""} autoComplete="name" required minLength={2} maxLength={100} />
      </div>
      <div className={styles.field}>
        <label htmlFor="join-password">Mot de passe</label>
        <input id="join-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </div>
      <div className={styles.field}>
        <label htmlFor="join-confirm">Confirme le mot de passe</label>
        <input id="join-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <button type="submit" className={styles.primary} disabled={pending}>
        {pending ? "Création du compte…" : "Créer mon compte et commencer"}
      </button>
    </form>
  );
}
