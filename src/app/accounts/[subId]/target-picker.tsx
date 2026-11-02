"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";

import { lookupTargetAction, type LookupResult } from "./actions";
import styles from "./account.module.css";

const PHOTO = (username: string) => `https://api.centuriegrowth.com/instagram/pdp/${encodeURIComponent(username)}`;
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const clean = (v: string) => v.trim().replace(/^@/, "").toLowerCase();
const VALID = /^[a-z0-9._]{1,30}$/;

/** Photo de profil, ou initiales si l'image ne répond pas. */
function Avatar({ username, size }: { username: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className={styles.pickerInitials} style={{ width: size, height: size }} aria-hidden="true">
        {username.replace(/[^a-z0-9]/g, "").slice(0, 2).toUpperCase()}
      </span>
    );
  return <Image src={PHOTO(username)} alt="" width={size} height={size} className={styles.pickerAvatar} onError={() => setFailed(true)} />;
}

/**
 * Choix des comptes similaires (questionnaire) : recherche par @ exact avec photo, nom et followers,
 * puis liste des comptes retenus. La valeur part dans un champ caché, un @ par ligne.
 */
export function TargetPicker({ name, initial, min = 3, max = 10 }: { name: string; initial: string[]; min?: number; max?: number }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [pending, startTransition] = useTransition();
  const latest = useRef("");

  // Recherche 450 ms après la dernière frappe ; seule la réponse à la dernière saisie est affichée.
  useEffect(() => {
    const q = clean(query);
    if (!VALID.test(q)) return;
    const timer = setTimeout(() => {
      latest.current = q;
      startTransition(async () => {
        const res = await lookupTargetAction(q);
        if (latest.current === q) setResult(res);
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [query]);

  const q = clean(query);
  const found = result?.status === "found" && result.account.username === q ? result.account : null;
  const full = selected.length >= max;

  function add(username: string) {
    if (!VALID.test(username) || selected.includes(username) || full) return;
    setSelected((s) => [...s, username]);
    setQuery("");
    setResult(null);
  }

  return (
    <div className={styles.picker}>
      <input type="hidden" name={name} value={selected.map((u) => `@${u}`).join("\n")} />

      <div className={styles.pickerSearch}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.5-4.5" />
        </svg>
        <input
          type="search"
          aria-label="Search an Instagram account by username"
          placeholder={full ? `Maximum ${max} accounts` : "Search an account, e.g. @nike"}
          value={query}
          disabled={full}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            setResult(null);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (found) add(found.username);
          }}
        />
      </div>

      {VALID.test(q) && !full && (
        <div className={styles.pickerResult} aria-live="polite">
          {found ? (
            <div className={styles.pickerCard}>
              <Avatar username={found.username} size={44} />
              <div className={styles.pickerWho}>
                <b>
                  {found.fullName || found.username}
                  {found.isVerified && <span className={styles.pickerVerified} aria-label="Verified"> ✓</span>}
                </b>
                <span>
                  @{found.username}
                  {found.followers != null && ` · ${compact.format(found.followers)} followers`}
                </span>
                {found.isPrivate && <span className={styles.pickerWarn}>Private account: we can&apos;t reach its audience.</span>}
              </div>
              <button type="button" className={styles.ghostButton} onClick={() => add(found.username)} disabled={selected.includes(found.username)}>
                {selected.includes(found.username) ? "Added" : "Add"}
              </button>
            </div>
          ) : pending || !result ? (
            <p className={styles.muted}>Searching…</p>
          ) : result.status === "not_found" ? (
            <p className={styles.muted}>No Instagram account with this exact username.</p>
          ) : (
            <p className={styles.muted}>
              Search is unavailable right now.{" "}
              <button type="button" className={styles.linkButton} onClick={() => add(q)}>
                Add @{q} anyway
              </button>
            </p>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <ul className={styles.chips} aria-label="Accounts added">
          {selected.map((u) => (
            <li key={u} className={styles.chip}>
              <Avatar username={u} size={26} />
              <span>@{u}</span>
              <button type="button" aria-label={`Remove @${u}`} onClick={() => setSelected((s) => s.filter((x) => x !== u))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <span className={styles.hint}>
        {selected.length < min
          ? `Add at least ${min} accounts (${selected.length}/${max}).`
          : `${selected.length}/${max} accounts added.`}{" "}
        Accounts whose followers look like your customers: we reach their audience.
      </span>
    </div>
  );
}
