"use client";

import { useState } from "react";

import { LineChart } from "@/components/charts/line-chart";
import styles from "./actions-history.module.css";

const number = new Intl.NumberFormat("en-US");
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export type ActionSeries = {
  key: string;
  label: string;
  color: string;
  points: { date: string; value: number }[];
};

/** Une action à la fois : sélecteur avec le total de chaque action, puis sa courbe dans sa couleur. */
export function ActionsHistory({ series }: { series: ActionSeries[] }) {
  const [selected, setSelected] = useState(series[0]?.key ?? "");
  const current = series.find((s) => s.key === selected) ?? series[0];
  if (!current) return null;

  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Action">
        {series.map((s) => {
          const total = s.points.reduce((sum, p) => sum + p.value, 0);
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={s.key === current.key}
              className={styles.tab}
              style={{ "--c": s.color } as React.CSSProperties}
              onClick={() => setSelected(s.key)}
            >
              <span className={styles.label}>
                <i aria-hidden="true" />
                {s.label}
              </span>
              <span className={styles.total}>{number.format(total)}</span>
              <span className={styles.avg}>{decimal.format(s.points.length ? total / s.points.length : 0)} / day</span>
            </button>
          );
        })}
      </div>
      {/* La courbe reprend la couleur de l'action choisie. */}
      <div style={{ "--data-primary": current.color } as React.CSSProperties}>
        <LineChart key={current.key} data={current.points} valueLabel={current.label} height={240} showTable={false} zeroBased />
      </div>
    </>
  );
}
