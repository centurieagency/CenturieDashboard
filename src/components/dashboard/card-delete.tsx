"use client";

import { useActionState, useState, useTransition } from "react";

import { deleteAccountAction, hideSubscriptionAction, type ActionState } from "@/app/accounts/[subId]/actions";
import styles from "./card-delete.module.css";

const IDLE: ActionState = { status: "idle" };

/**
 * Espace admin, sur chaque carte :
 * - abonnement en cours : suppression du compte + résiliation Stripe, confirmée en retapant le @username (ou sub_id) ;
 * - abonnement terminé : retrait du dashboard (Stripe ne permet pas de supprimer un abonnement résilié).
 */
export function CardDelete({ subId, username, ended }: { subId: string; username: string | null; ended: boolean }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        {ended ? "Remove from dashboard" : "Delete"}
      </button>
    );
  }
  return ended ? (
    <HideConfirm subId={subId} onCancel={() => setOpen(false)} />
  ) : (
    <DeleteConfirm subId={subId} username={username} onCancel={() => setOpen(false)} />
  );
}

function HideConfirm({ subId, onCancel }: { subId: string; onCancel: () => void }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(IDLE);
  return (
    <div className={styles.box}>
      <p className={styles.text}>Hide this ended subscription from the dashboard? Stripe keeps it in its history.</p>
      {state.status === "error" && (
        <p role="alert" className={styles.error}>
          {state.message}
        </p>
      )}
      <div className={styles.row}>
        <button
          type="button"
          className={styles.danger}
          disabled={pending}
          onClick={() => startTransition(async () => setState(await hideSubscriptionAction(subId)))}
        >
          {pending ? "Removing…" : "Remove"}
        </button>
        <button type="button" className={styles.cancel} onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function DeleteConfirm({ subId, username, onCancel }: { subId: string; username: string | null; onCancel: () => void }) {
  const [state, action, pending] = useActionState(deleteAccountAction.bind(null, subId, username), IDLE);
  const [typed, setTyped] = useState("");
  const expected = username ? `@${username}` : subId;
  const matches = typed.trim().replace(/^@/, "").toLowerCase() === (username ?? subId).toLowerCase();
  const inputId = `delete-${subId}`;

  return (
    <form action={action} className={styles.box}>
      <p className={styles.text}>
        Cancels the Stripe subscription now{username ? ` and deletes @${username} from Centurie` : ""}. This can&apos;t
        be undone.
      </p>
      <label htmlFor={inputId} className={styles.label}>
        Type <code>{expected}</code> to confirm
      </label>
      <input
        id={inputId}
        name="confirm"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className={styles.input}
        autoFocus
      />
      {state.status === "error" && (
        <p role="alert" className={styles.error}>
          {state.message}
        </p>
      )}
      <div className={styles.row}>
        <button type="submit" className={styles.danger} disabled={!matches || pending}>
          {pending ? "Deleting…" : "Delete"}
        </button>
        <button type="button" className={styles.cancel} onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
