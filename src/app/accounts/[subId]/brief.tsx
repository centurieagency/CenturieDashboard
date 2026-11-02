"use client";

import { useActionState } from "react";

import type { BriefAnswers } from "@/db/schema";
import { addBriefTargetsAction, saveBriefAction, type ActionState } from "./actions";
import styles from "./account.module.css";
import { TargetPicker } from "./target-picker";

const IDLE: ActionState = { status: "idle" };

export const SECTORS = [
  "Restaurant, café or bar",
  "Fitness, coaching or wellness",
  "Beauty, salon or spa",
  "Online store",
  "Fashion or accessories",
  "Real estate",
  "Travel or hospitality",
  "Creator or influencer",
  "Professional services",
  "Other",
];

export const GOALS = [
  "More customers or bookings",
  "More online sales",
  "Brand awareness",
  "Brand partnerships",
  "Build a community",
];

function Feedback({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? styles.error : styles.success}>
      {state.message}
    </p>
  );
}

/** Questionnaire de démarrage : ce qui nous aide à choisir les premières cibles. */
export function BriefForm({ subId, initial }: { subId: string; initial?: BriefAnswers | null }) {
  const [state, action, pending] = useActionState(saveBriefAction.bind(null, subId), IDLE);
  const knownSector = initial && SECTORS.includes(initial.sector);
  return (
    <form action={action} className={styles.form}>
      <div className={styles.columns}>
        <div className={styles.field}>
          <label htmlFor="b-sector" className={styles.label}>
            Business sector
          </label>
          <select id="b-sector" name="sector" className={styles.input} defaultValue={initial ? (knownSector ? initial.sector : "Other") : ""} required>
            <option value="" disabled>
              Choose…
            </option>
            {SECTORS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            name="sector_other"
            className={styles.input}
            placeholder="If other: your sector"
            defaultValue={initial && !knownSector ? initial.sector : ""}
            maxLength={80}
            style={{ marginTop: 8 }}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="b-location" className={styles.label}>
            City or area <span className={styles.muted}>(if you serve local customers)</span>
          </label>
          <input id="b-location" name="location" className={styles.input} placeholder="Miami, FL" defaultValue={initial?.location ?? ""} maxLength={120} />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="b-ideal" className={styles.label}>
          Your ideal customer
        </label>
        <textarea
          id="b-ideal"
          name="idealCustomer"
          className={styles.input}
          rows={3}
          placeholder="Young professionals in Miami who love brunch and natural wine."
          defaultValue={initial?.idealCustomer ?? ""}
          required
          minLength={10}
          maxLength={600}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>3 to 10 similar accounts or competitors</span>
        <TargetPicker name="competitors" initial={initial?.competitors ?? []} />
      </div>

      <div className={styles.columns}>
        <div className={styles.field}>
          <label htmlFor="b-website" className={styles.label}>
            Website <span className={styles.muted}>(optional)</span>
          </label>
          <input id="b-website" name="website" className={styles.input} placeholder="https://…" defaultValue={initial?.website ?? ""} maxLength={200} />
        </div>
        <div className={styles.field}>
          <label htmlFor="b-goal" className={styles.label}>
            Main goal
          </label>
          <select id="b-goal" name="goal" className={styles.input} defaultValue={initial?.goal ?? ""} required>
            <option value="" disabled>
              Choose…
            </option>
            {GOALS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="b-notes" className={styles.label}>
          Anything else we should know? <span className={styles.muted}>(optional)</span>
        </label>
        <textarea id="b-notes" name="notes" className={styles.input} rows={2} defaultValue={initial?.notes ?? ""} maxLength={1000} />
      </div>

      <div>
        <button type="submit" className={styles.primaryButton} disabled={pending}>
          {pending ? "Saving…" : initial ? "Update my answers" : "Send my answers"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** Admin : ajoute d'un clic les comptes cités par le client comme cibles. */
export function AddBriefTargets({ subId, count }: { subId: string; count: number }) {
  const [state, action, pending] = useActionState(addBriefTargetsAction.bind(null, subId), IDLE);
  return (
    <form action={action} className={styles.form}>
      <div>
        <button type="submit" className={styles.primaryButton} disabled={pending || count === 0}>
          {pending ? "Adding…" : `Add these ${count} accounts as targets`}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
