"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./analysis.module.css";

export type Recommendation = {
  id: string;
  tone: "info" | "warn" | "danger";
  tag: string;
  title: string;
  text: string;
  /** Où faire la modification : onglet du compte, ou profil Instagram (lien externe). */
  action?: { href: string; label: string; external?: boolean };
};

/** Recommandations à cocher. L'état coché est mémorisé dans ce navigateur (outil de suivi de l'admin). */
export function RecommendationList({ subId, items }: { subId: string; items: Recommendation[] }) {
  const key = `centurie-reco-${subId}`;
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "[]");
      // Lecture unique au montage : l'état serveur (vide) puis celui du navigateur.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setDone(saved.filter((v): v is string => typeof v === "string"));
    } catch {}
  }, [key]);

  function toggle(id: string) {
    setDone((prev) => {
      const next = prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const doneCount = items.filter((i) => done.includes(i.id)).length;

  return (
    <>
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <span className={`${styles.icon} ${styles.iconViolet}`} aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8zM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></svg>
          </span>
          <div>
            <h2 id="reco-title" className={styles.title}>Smart recommendations</h2>
            <span className={styles.sub}>Ticking only tracks progress. Use the button to make the change</span>
          </div>
        </div>
        {items.length > 0 && (
          <div className={styles.progress} aria-label={`${doneCount} of ${items.length} done`}>
            <span className={styles.progressTrack}>
              <span style={{ width: `${(doneCount / items.length) * 100}%` }} />
            </span>
            <b>
              {doneCount}/{items.length}
            </b>
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <p className={styles.sub}>Nothing to improve right now. The account is in good shape.</p>
      ) : (
        <ul className={styles.recos}>
          {items.map((r) => {
            const checked = done.includes(r.id);
            return (
              <li key={r.id} className={`${styles.reco} ${styles[`reco_${r.tone}`]} ${checked ? styles.recoDone : ""}`}>
                <label className={styles.check}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(r.id)} />
                  <span className={styles.srOnly}>Mark &ldquo;{r.title}&rdquo; as done</span>
                </label>
                <div className={styles.recoBody}>
                  <div className={styles.recoTitle}>
                    {r.title}
                    <span className={styles.recoTag}>{r.tag}</span>
                  </div>
                  <p>{r.text}</p>
                  {r.action &&
                    (r.action.external ? (
                      <a href={r.action.href} target="_blank" rel="noopener noreferrer" className={styles.recoLink}>
                        {r.action.label} ↗
                      </a>
                    ) : (
                      <Link href={r.action.href} className={styles.recoLink}>
                        {r.action.label} →
                      </Link>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
