"use client";

import { useState, useTransition } from "react";

import { createAccessLinkAction, type AccessLinkState } from "./access-actions";

/** Admin : génère le lien personnel d'accès d'un client, à lui envoyer soi-même. */
export function AccessLinkButton({ customerId, className }: { customerId: string; className?: string }) {
  const [state, setState] = useState<AccessLinkState>({});
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => startTransition(async () => setState(await createAccessLinkAction(customerId)))}
      >
        {pending ? "Creating…" : "Login link"}
      </button>
      {state.error && <span role="alert" style={{ color: "var(--status-danger-text)", fontSize: 13 }}>{state.error}</span>}
      {state.link && (
        <>
          <code style={{ fontSize: 12, wordBreak: "break-all" }}>{state.link}</code>
          <button
            type="button"
            className={className}
            onClick={() => navigator.clipboard.writeText(state.link!).then(() => setCopied(true), () => setCopied(false))}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            Send it to {state.email}. Valid {state.days} days, single use.
          </span>
        </>
      )}
    </span>
  );
}
