"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { addTargetAction, addTargetsBulkAction, removeTargetAction, type ActionState } from "./actions";
import styles from "./targets.module.css";

const IDLE: ActionState = { status: "idle" };

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;
/** Actions injectables : la démo de l'Academy remplace les vraies actions par les siennes. */
export type TargetActions = { add: FormAction; addMany: FormAction; remove: FormAction };
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export type TargetRow = {
  username: string;
  fullName: string | null;
  followers: number | null;
  isPrivate: boolean;
  pending: boolean;
  avatar: string;
  /** Admin uniquement : nouveaux followers attribués à cette cible sur 90 jours, et score relatif 0-100. */
  conversions?: number;
  score?: number;
};

function Feedback({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? styles.error : styles.success}>
      {state.message}
    </p>
  );
}

function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") ref.current?.reset();
  }, [state]);
  return ref;
}

const ICON = {
  addOne: <path d="M15 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 4 17.5V19M9.5 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 8v6M16 11h6" />,
  addMany: <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1.4a3.4 3.4 0 0 0-2.5-3.3M15.5 4.6a3 3 0 0 1 0 5.8" />,
  smart: <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M7 7l1.8 1.8M15.2 15.2 17 17M17 7l-1.8 1.8M8.8 15.2 7 17M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />,
  search: <path d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.5-4.5" />,
  warn: <path d="M12 4 2.8 19.5h18.4zM12 10v4.5M12 17v.3" />,
};

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.svg}>
      {children}
    </svg>
  );
}

// ---------- Outils d'ajout (admin) ----------

export function TargetTools({
  subId,
  analysisHref,
  actions,
}: {
  subId: string;
  analysisHref?: string;
  actions?: TargetActions;
}) {
  const [tool, setTool] = useState<"one" | "many">("one");
  return (
    <div className={styles.tools}>
      <div className={styles.toolTiles} role="tablist" aria-label="Add targets">
        <button type="button" role="tab" aria-selected={tool === "one"} className={styles.tile} onClick={() => setTool("one")}>
          <span className={styles.tileIcon}><Svg>{ICON.addOne}</Svg></span>
          Add a profile
        </button>
        <button type="button" role="tab" aria-selected={tool === "many"} className={styles.tile} onClick={() => setTool("many")}>
          <span className={styles.tileIcon}><Svg>{ICON.addMany}</Svg></span>
          Add several accounts
        </button>
        {analysisHref && (
          <Link href={analysisHref} className={styles.tile}>
            <span className={styles.tileIcon}><Svg>{ICON.smart}</Svg></span>
            Smart analysis
          </Link>
        )}
      </div>
      {tool === "one" ? <AddOne subId={subId} action={actions?.add} /> : <AddMany subId={subId} action={actions?.addMany} />}
    </div>
  );
}

function AddOne({ subId, action: override }: { subId: string; action?: FormAction }) {
  const [state, action, pending] = useActionState(override ?? addTargetAction.bind(null, subId), IDLE);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.headIcon}><Svg>{ICON.addOne}</Svg></span>
        <div>
          <h2 className={styles.panelTitle}>Add a profile</h2>
          <p className={styles.panelSub}>Add an account whose followers look like the client&apos;s ideal audience.</p>
        </div>
      </div>
      <div className={styles.searchRow}>
        <label htmlFor="target-username" className={styles.srOnly}>Instagram username</label>
        <div className={styles.search}>
          <Svg>{ICON.search}</Svg>
          <input
            id="target-username"
            name="target_username"
            placeholder="Instagram username, e.g. brand_name"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </div>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? "Adding…" : "Add target"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

function AddMany({ subId, action: override }: { subId: string; action?: FormAction }) {
  const [state, action, pending] = useActionState(override ?? addTargetsBulkAction.bind(null, subId), IDLE);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.headIcon}><Svg>{ICON.addMany}</Svg></span>
        <div>
          <h2 className={styles.panelTitle}>Add several accounts</h2>
          <p className={styles.panelSub}>One username per line, or separated by commas. Up to 50 at a time.</p>
        </div>
      </div>
      <label htmlFor="target-usernames" className={styles.srOnly}>Instagram usernames</label>
      <textarea
        id="target-usernames"
        name="usernames"
        rows={4}
        placeholder={"brand_one\nbrand_two\n@brand_three"}
        className={styles.textarea}
        spellCheck={false}
        required
      />
      <div>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? "Adding…" : "Add accounts"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

// ---------- Tableau des cibles ----------

function RemoveButton({ subId, username, action: override }: { subId: string; username: string; action?: FormAction }) {
  const [state, action, pending] = useActionState(override ?? removeTargetAction.bind(null, subId), IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="target_username" value={username} />
      <button
        type="submit"
        className={styles.remove}
        disabled={pending}
        aria-label={`Remove @${username} from targets`}
        title={state.status === "error" ? state.message : "Remove"}
      >
        {pending ? "…" : "×"}
      </button>
    </form>
  );
}

/** Photo de profil, ou initiales si l'API n'en a pas pour ce compte. */
function Avatar({ src, username, size }: { src: string; username: string; size: 28 | 36 }) {
  // Sans adresse d'image (cibles fictives de la démo), on affiche directement les initiales.
  const [failed, setFailed] = useState(!src);
  if (failed)
    return (
      <span className={styles.avatarFallback} style={{ width: size, height: size }} aria-hidden="true">
        {username.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase()}
      </span>
    );
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={styles.avatar}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function scoreTone(score: number) {
  return score >= 60 ? styles.scoreHigh : score >= 30 ? styles.scoreMid : styles.scoreLow;
}

export function TargetsTable({
  subId,
  rows,
  admin,
  removeAction,
}: {
  subId: string;
  rows: TargetRow[];
  admin: boolean;
  /** Démo : bouton de retrait sans les scores (réservés à l'admin). */
  removeAction?: FormAction;
}) {
  const removable = admin || !!removeAction;
  const [showAll, setShowAll] = useState(false);
  const PAGE = 10;
  const visible = showAll ? rows : rows.slice(0, PAGE);

  return (
    <section className={styles.tableCard} aria-label="Targets">
      <div className={`${styles.row} ${styles.rowHead} ${admin ? styles.rowAdmin : removable ? styles.rowRemovable : ""}`} aria-hidden="true">
        <span>Rank</span>
        <span>Account</span>
        {admin && <span className={styles.right}>Score</span>}
        {removable && <span />}
      </div>
      <ol className={styles.list}>
        {visible.map((t, i) => (
          <li key={t.username} className={`${styles.row} ${admin ? styles.rowAdmin : removable ? styles.rowRemovable : ""}`}>
            <span className={styles.rank}>{i + 1}</span>
            <div className={styles.who}>
              <Avatar src={t.avatar} username={t.username} size={36} />
              <div className={styles.whoText}>
                <span className={styles.name}>{t.fullName || t.username}</span>
                <span className={styles.meta}>
                  <a href={`https://www.instagram.com/${encodeURIComponent(t.username)}/`} target="_blank" rel="noopener noreferrer">
                    @{t.username}
                  </a>
                  {t.followers != null && ` · ${compact.format(t.followers)}`}
                  {t.isPrivate && " · Private"}
                  {t.pending && " · Pending review"}
                </span>
              </div>
            </div>
            {admin && (
              <span className={styles.right}>
                <span
                  className={`${styles.score} ${scoreTone(t.score ?? 0)}`}
                  title={`${t.conversions ?? 0} new followers over 90 days`}
                >
                  {t.score ?? 0}/100
                </span>
              </span>
            )}
            {removable && <RemoveButton subId={subId} username={t.username} action={removeAction} />}
          </li>
        ))}
      </ol>
      {rows.length > PAGE && (
        <button type="button" className={styles.more} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show less" : `Show more (${rows.length - PAGE} more)`}
        </button>
      )}
    </section>
  );
}

// ---------- Recommandation de suppression (admin) ----------

const LEVELS = [
  { id: "tolerant", label: "Tolerant", max: 0 },
  { id: "medium", label: "Medium", max: 1 },
  { id: "strict", label: "Strict", max: 3 },
] as const;

export function RemovalPanel({ subId, rows }: { subId: string; rows: TargetRow[] }) {
  const [level, setLevel] = useState<(typeof LEVELS)[number]["id"]>("medium");
  const max = LEVELS.find((l) => l.id === level)!.max;
  const weak = rows.filter((r) => (r.conversions ?? 0) <= max);

  return (
    <section className={styles.removal} aria-labelledby="removal-title">
      <div className={styles.removalHead}>
        <span className={styles.warnIcon}><Svg>{ICON.warn}</Svg></span>
        <div>
          <h2 id="removal-title" className={styles.panelTitle}>Removal suggestions</h2>
          <p className={styles.panelSub}>Targets that brought few or no new followers over the last 90 days.</p>
        </div>
        <span className={styles.countPill}>{weak.length} targets</span>
      </div>
      <div className={styles.levels} role="radiogroup" aria-label="Sensitivity">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={level === l.id}
            className={styles.level}
            onClick={() => setLevel(l.id)}
          >
            {l.label}
          </button>
        ))}
        <span className={styles.levelHint}>
          {max === 0 ? "No new follower" : `${max} new follower${max > 1 ? "s" : ""} or fewer`} in 90 days
        </span>
      </div>
      {weak.length === 0 ? (
        <p className={styles.panelSub}>Every target brings followers at this level. Nothing to remove.</p>
      ) : (
        <ul className={styles.weakList}>
          {weak.slice(0, 12).map((t) => (
            <li key={t.username} className={styles.weakItem}>
              <Avatar src={t.avatar} username={t.username} size={28} />
              <span className={styles.weakName}>@{t.username}</span>
              <span className={styles.weakMeta}>{t.conversions ?? 0} in 90 d</span>
              <RemoveButton subId={subId} username={t.username} />
            </li>
          ))}
          {weak.length > 12 && <li className={styles.weakMore}>+{weak.length - 12} more in the table above</li>}
        </ul>
      )}
    </section>
  );
}
