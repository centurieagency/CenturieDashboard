"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  addTargetAction,
  backupCodesAction,
  connectAction,
  passwordAction,
  removeTargetAction,
  saveConfigAction,
  setActiveAction,
  totpKeyAction,
  type ActionState,
} from "./actions";
import styles from "./account.module.css";

const IDLE: ActionState = { status: "idle" };

function Feedback({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? styles.error : styles.success}>
      {state.message}
    </p>
  );
}

/** Vide le formulaire après un succès (champs sensibles, ajout de cible). */
function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") ref.current?.reset();
  }, [state]);
  return ref;
}

// ---------- Connexion en cours ----------

const REFRESH_SECONDS = 20;

/** Recharge les données du serveur toutes les 20 s tant que le compte est en cours de connexion. */
export function AutoRefresh() {
  const router = useRouter();
  const [left, setLeft] = useState(REFRESH_SECONDS);

  useEffect(() => {
    const id = setInterval(() => {
      setLeft((s) => {
        if (s > 1) return s - 1;
        if (document.visibilityState === "visible") router.refresh();
        return REFRESH_SECONDS;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <span className={styles.refresh} aria-live="off">
      <span className={styles.refreshDot} aria-hidden="true" />
      Checking again in {left}s
    </span>
  );
}

// ---------- Connexion ----------

export function ConnectForm({ subId }: { subId: string }) {
  const [state, action, pending] = useActionState(connectAction.bind(null, subId), IDLE);
  const [show, setShow] = useState(false);
  const ref = useResetOnSuccess(state);

  return (
    <form ref={ref} action={action} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="ig-username" className={styles.label}>
          Instagram username
        </label>
        <div className={styles.prefixed}>
          <span className={styles.prefix} aria-hidden="true">
            @
          </span>
          <input
            id="ig-username"
            name="username"
            className={styles.prefixedInput}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            placeholder="yourbusiness"
            required
          />
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="ig-password" className={styles.label}>
          Instagram password
        </label>
        <div className={styles.passwordWrap}>
          <input
            id="ig-password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            className={`${styles.input} ${styles.passwordInput}`}
            required
          />
          <button type="button" className={styles.toggle} onClick={() => setShow((v) => !v)} aria-pressed={show}>
            {show ? "Hide" : "Show"}
          </button>
        </div>
        <span className={styles.hint}>Sent securely to our team to run your account. Never shown again.</span>
      </div>
      <Feedback state={state} />
      <button type="submit" className={styles.primaryButton} disabled={pending}>
        {pending ? "Connecting…" : "Connect account"}
      </button>
    </form>
  );
}

// ---------- Pause / reprise ----------

export function ActiveToggle({ subId, isActive }: { subId: string; isActive: boolean }) {
  const [state, action, pending] = useActionState(setActiveAction.bind(null, subId), IDLE);
  return (
    <form action={action} className={styles.toggleForm}>
      <input type="hidden" name="is_active" value={String(!isActive)} />
      <button type="submit" className={isActive ? styles.ghostButton : styles.primaryButton} disabled={pending}>
        {pending ? "Saving…" : isActive ? "Pause growth" : "Resume growth"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

// ---------- Quotas ----------

type ConfigValues = {
  per_day_follow: number;
  per_day_like_post: number;
  per_day_like_story: number;
  enabled_follow: boolean;
  enabled_post_like: boolean;
  enabled_like_story: boolean;
  enabled_warmup: boolean;
};

export function ConfigForm({ subId, config, expert }: { subId: string; config: ConfigValues; expert: boolean }) {
  const [state, action, pending] = useActionState(saveConfigAction.bind(null, subId), IDLE);
  const max = expert ? { follow: 90, post: 350, story: 550 } : { follow: 70, post: 250, story: 250 };

  const rows = [
    { key: "follow", label: "Follows", enabled: "enabled_follow", perDay: "per_day_follow", max: max.follow },
    { key: "post", label: "Post likes", enabled: "enabled_post_like", perDay: "per_day_like_post", max: max.post },
    { key: "story", label: "Story likes", enabled: "enabled_like_story", perDay: "per_day_like_story", max: max.story },
  ] as const;

  return (
    <form action={action} className={styles.form}>
      <div className={styles.quotaList}>
        {rows.map((row) => (
          <div key={row.key} className={styles.quotaRow}>
            <label className={styles.switch}>
              <input type="checkbox" name={row.enabled} defaultChecked={config[row.enabled]} />
              <span>{row.label}</span>
            </label>
            <div className={styles.quotaInput}>
              <label htmlFor={`q-${row.key}`} className={styles.srOnly}>
                {row.label} per day
              </label>
              <input
                id={`q-${row.key}`}
                name={row.perDay}
                type="number"
                inputMode="numeric"
                min={1}
                max={row.max}
                step={1}
                defaultValue={config[row.perDay]}
                className={`${styles.input} ${styles.numberInput}`}
                required
              />
              <span className={styles.unit}>/ day · max {row.max}</span>
            </div>
          </div>
        ))}
      </div>
      <label className={styles.switch}>
        <input type="checkbox" name="enabled_warmup" defaultChecked={config.enabled_warmup} />
        <span>
          Warmup
          <span className={styles.hint}> · ramps limits up gradually, recommended for new or quiet accounts</span>
        </span>
      </label>
      <Feedback state={state} />
      <button type="submit" className={styles.primaryButton} disabled={pending}>
        {pending ? "Saving…" : "Save limits"}
      </button>
    </form>
  );
}

// ---------- Cibles ----------

export function AddTargetForm({ subId }: { subId: string }) {
  const [state, action, pending] = useActionState(addTargetAction.bind(null, subId), IDLE);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className={styles.inlineForm}>
      <label htmlFor="target-username" className={styles.srOnly}>
        Instagram username to target
      </label>
      <div className={`${styles.prefixed} ${styles.grow}`}>
        <span className={styles.prefix} aria-hidden="true">
          @
        </span>
        <input
          id="target-username"
          name="target_username"
          className={styles.prefixedInput}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="account_to_target"
          required
        />
      </div>
      <button type="submit" className={styles.primaryButton} disabled={pending}>
        {pending ? "Adding…" : "Add target"}
      </button>
      <div className={styles.fullRow}>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function RemoveTargetButton({ subId, username }: { subId: string; username: string }) {
  const [state, action, pending] = useActionState(removeTargetAction.bind(null, subId), IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="target_username" value={username} />
      <button
        type="submit"
        className={styles.linkButton}
        disabled={pending}
        aria-label={`Remove @${username} from targets`}
      >
        {pending ? "Removing…" : state.status === "error" ? "Retry" : "Remove"}
      </button>
    </form>
  );
}

// ---------- Identifiants ----------

export function PasswordForm({ subId }: { subId: string }) {
  const [state, action, pending] = useActionState(passwordAction.bind(null, subId), IDLE);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="new-password" className={styles.label}>
          New Instagram password
        </label>
        <input id="new-password" name="password" type="password" autoComplete="new-password" className={styles.input} required />
      </div>
      <Feedback state={state} />
      <button type="submit" className={styles.ghostButton} disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

export function TotpKeyForm({ subId }: { subId: string }) {
  const [state, action, pending] = useActionState(totpKeyAction.bind(null, subId), IDLE);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="totp-key" className={styles.label}>
          Authenticator key
        </label>
        <input
          id="totp-key"
          name="twofa_key"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABCD EFGH IJKL MNOP"
          className={styles.input}
          required
        />
        <span className={styles.hint}>
          In Instagram: Accounts Center, Password and security, Two-factor authentication, Authentication app.
        </span>
      </div>
      <Feedback state={state} />
      <button type="submit" className={styles.ghostButton} disabled={pending}>
        {pending ? "Saving…" : "Save key"}
      </button>
    </form>
  );
}

export function BackupCodesForm({ subId }: { subId: string }) {
  const [state, action, pending] = useActionState(backupCodesAction.bind(null, subId), IDLE);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="backup-codes" className={styles.label}>
          Backup codes
        </label>
        <textarea
          id="backup-codes"
          name="codes"
          rows={3}
          autoComplete="off"
          spellCheck={false}
          placeholder="1234 5678, 8765 4321…"
          className={`${styles.input} ${styles.textarea}`}
          required
        />
        <span className={styles.hint}>Up to 5 codes of 8 digits, from Instagram&apos;s backup codes page.</span>
      </div>
      <Feedback state={state} />
      <button type="submit" className={styles.ghostButton} disabled={pending}>
        {pending ? "Saving…" : "Save codes"}
      </button>
    </form>
  );
}
