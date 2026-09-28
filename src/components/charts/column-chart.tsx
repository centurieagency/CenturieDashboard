"use client";

import styles from "./chart.module.css";
import {
  formatCompact,
  formatDay,
  formatNumber,
  niceTicks,
  useKeyboardIndex,
  useWidth,
  type Point,
} from "./chart-utils";
import { DataTable } from "./data-table";

const PAD = { top: 12, right: 8, bottom: 28, left: 44 };
const GAP = 2; // espace de surface entre colonnes voisines
const MAX_BAR = 24;

/** Chemin d'une colonne : haut arrondi (4px max), base carrée sur la ligne zéro. */
function columnPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Colonnes d'une seule série sur une base zéro. Chaque colonne est sa propre zone de survol
 * (toute la hauteur du créneau) ; clavier : flèches.
 */
export function ColumnChart({
  data,
  valueLabel,
  height = 220,
  compact = false,
}: {
  data: Point[];
  valueLabel: string;
  height?: number;
  /** Petits multiples : moins de graduations, pas de tableau. */
  compact?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { active, setActive, onKeyDown, onBlur } = useKeyboardIndex(data.length);

  if (data.length === 0) return <p className={styles.empty}>No data for this period yet.</p>;

  const ticks = niceTicks(0, Math.max(1, ...data.map((d) => d.value)), compact ? 2 : 4);
  const yMax = ticks.at(-1)!;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.max(1, Math.min(MAX_BAR, slot - GAP));
  const xBar = (i: number) => PAD.left + i * slot + (slot - barW) / 2;
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;
  const hovered = active !== null ? data[active] : undefined;
  const total = data.reduce((s, d) => s + d.value, 0);
  const xLabels = [0, Math.floor((data.length - 1) / 2), data.length - 1];

  return (
    <div className={styles.chart}>
      <div ref={ref} className={styles.plot} style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${valueLabel} per day, ${formatNumber(total)} in total over ${data.length} days. Use arrow keys to read each day.`}
            tabIndex={0}
            onPointerLeave={() => setActive(null)}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            className={styles.svg}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  className={t === 0 ? styles.baseline : styles.grid}
                />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className={styles.axis}>
                  {formatCompact(t)}
                </text>
              </g>
            ))}
            {xLabels.map((i, k) => (
              <text
                key={`${i}-${k}`}
                x={xBar(i) + barW / 2}
                y={height - 8}
                textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}
                className={styles.axis}
              >
                {formatDay(data[i]!.date)}
              </text>
            ))}
            {data.map((d, i) => (
              <g key={d.date} onPointerEnter={() => setActive(i)}>
                <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH} fill="transparent" />
                <path
                  d={columnPath(xBar(i), y(d.value), barW, PAD.top + innerH - y(d.value))}
                  className={active === i ? styles.barActive : styles.bar}
                />
              </g>
            ))}
          </svg>
        )}
        {hovered && active !== null && (
          <div
            className={styles.tooltip}
            style={{ left: Math.min(Math.max(xBar(active) + barW / 2, 70), width - 70), top: 0 }}
            role="status"
          >
            <strong>{formatNumber(hovered.value)}</strong>
            <span>{formatDay(hovered.date, true)}</span>
          </div>
        )}
      </div>
      {!compact && <DataTable data={data} valueLabel={valueLabel} />}
    </div>
  );
}
