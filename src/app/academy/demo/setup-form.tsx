"use client";

import { useActionState } from "react";

import styles from "../academy.module.css";
import { setupDemoAction, type SetupState } from "./actions";

export function SetupForm({ niches }: { niches: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<SetupState, FormData>(setupDemoAction, {});
  return (
    <form action={action} className={styles.form}>
      <div className={styles.grid2}>
        <div className={styles.field}>
          <label htmlFor="d-handle">Instagram du prospect</label>
          <input id="d-handle" name="handle" placeholder="@sonrestaurant" required autoCapitalize="none" spellCheck={false} />
        </div>
        <div className={styles.field}>
          <label htmlFor="d-name">Nom affiché (optionnel)</label>
          <input id="d-name" name="name" placeholder="Le Petit Bistro" maxLength={60} />
        </div>
        <div className={styles.field}>
          <label htmlFor="d-niche">Niche</label>
          <select id="d-niche" name="niche" className={styles.select} defaultValue="restaurant">
            {niches.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="d-plan">Offre présentée</label>
          <select id="d-plan" name="plan" className={styles.select} defaultValue="growth">
            <option value="essential">Essential</option>
            <option value="growth">Growth</option>
            <option value="signature">Signature</option>
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="d-followers">Followers actuels</label>
          <input id="d-followers" name="followers" type="number" min={0} max={5000000} defaultValue={1200} required />
        </div>
        <div className={styles.field}>
          <label htmlFor="d-posts">Nombre de posts</label>
          <input id="d-posts" name="posts" type="number" min={0} max={100000} defaultValue={45} required />
        </div>
      </div>
      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? "Préparation…" : "Lancer la démo →"}
        </button>
      </div>
    </form>
  );
}
