"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import styles from "./palette-switcher.module.css";

/** Thèmes harmonisés à l'essai (voir globals.css). After Hours = thème actuel, par défaut. */
const PALETTES = [
  { id: "after-hours", name: "After Hours (actuel)", colors: ["#0b0b0a", "#d9b66f", "#a6823a", "#12a58d", "#e5657b", "#3fd0b0"] },
  { id: "ember-glow", name: "Ember Glow", colors: ["#0c0a09", "#ff7a2f", "#f0632b", "#ff9b63", "#ffbe8f", "#e9d7c3"] },
  { id: "onyx-champagne", name: "Onyx & Champagne", colors: ["#0d0b09", "#e3cea9", "#bea87f", "#9d865a", "#80683b", "#e6be68"] },
  { id: "onyx-sage", name: "Onyx & Sage", colors: ["#090c09", "#bbdbc0", "#93b599", "#6f9476", "#517659", "#e2bf76"] },
  { id: "midnight-slate", name: "Midnight Slate", colors: ["#070b11", "#b1d6f6", "#88b0d2", "#648eb2", "#457094", "#eac992"] },
  { id: "noir-bordeaux", name: "Noir Bordeaux", colors: ["#100909", "#febdc4", "#d9959d", "#b9727b", "#9a545d", "#ebb896"] },
  { id: "graphite-ember", name: "Graphite & Ember", colors: ["#0c0b09", "#d8d0c4", "#b2a99d", "#91887b", "#746a5e", "#f0834e"] },
  { id: "deep-teal", name: "Deep Teal", colors: ["#060d0d", "#a3dedd", "#78b8b8", "#4f9797", "#2b7979", "#eac586"] },
];
const KEY = "centurie-dev-palette";

const EVENT = "centurie-palette-change";

function apply(id: string) {
  if (id === "after-hours") delete document.documentElement.dataset.palette;
  else document.documentElement.dataset.palette = id;
  window.dispatchEvent(new Event(EVENT));
}

// La palette active est lue sur <html data-palette>, la seule source de vérité.
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};
const getSnapshot = () => document.documentElement.dataset.palette ?? "after-hours";
const getServerSnapshot = () => "after-hours";

/**
 * Sélecteur de palette pour comparer les essais sur les vraies pages.
 * Rendu UNIQUEMENT en développement (voir layout.tsx) : n'apparaît jamais en production.
 */
export function PaletteSwitcher() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(true);

  // Au chargement : reprend la palette choisie la dernière fois.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {}
    if (saved && PALETTES.some((p) => p.id === saved)) apply(saved);
  }, []);

  function choose(id: string) {
    apply(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {}
  }

  return (
    <div className={styles.panel} role="region" aria-label="Palette test (local only)">
      <button type="button" className={styles.head} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Palette · {PALETTES.find((p) => p.id === current)?.name}
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className={styles.list}>
          {PALETTES.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={styles.option}
                aria-pressed={current === p.id}
                onClick={() => choose(p.id)}
              >
                <span className={styles.swatches} aria-hidden="true">
                  {p.colors.map((c, i) => (
                    <span key={i} style={{ background: c }} />
                  ))}
                </span>
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
