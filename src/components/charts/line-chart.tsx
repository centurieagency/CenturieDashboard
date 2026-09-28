"use client";

import styles from "./chart.module.css";
import {
  dayTime,
  formatCompact,
  formatDay,
  formatNumber,
  niceTicks,
  useKeyboardIndex,
  useWidth,
  type Point,
} from "./chart-utils";
import { DataTable } from "./data-table";

const PAD = { top: 16, right: 56, bottom: 28, left: 52 };

/**
 * Courbe d'une seule série (trait 2px, lavis à 10 %, point final avec anneau).
 * Axe Y hors zéro : on montre l'évolution, pas la grandeur absolue.
 * Survol : réticule qui s'aligne sur le jour le plus proche ; clavier : flèches.
 */
export function LineChart({
  data,
  valueLabel,
  height = 240,
}: {
  data: Point[];
  valueLabel: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { active, setActive, onKeyDown, onBlur } = useKeyboardIndex(data.length);

  if (data.length < 2) return <p className={styles.empty}>Not enough data for this period yet.</p>;

  const values = data.map((d) => d.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0]!;
  const yMax = ticks.at(-1)!;
  const t0 = dayTime(data[0]!.date);
  const t1 = dayTime(data.at(-1)!.date);
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const x = (d: Point) => PAD.left + ((dayTime(d.date) - t0) / Math.max(1, t1 - t0)) * innerW;
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const line = data.map((d, i) => `${i ? "L" : "M"}${x(d).toFixed(1)},${y(d.value).toFixed(1)}`).join("");
  const area = `${line}L${x(data.at(-1)!).toFixed(1)},${PAD.top + innerH}L${x(data[0]!).toFixed(1)},${PAD.top + innerH}Z`;
  const last = data.at(-1)!;
  const hovered = active !== null ? data[active] : undefined;
  const xLabels = [data[0]!, data[Math.floor((data.length - 1) / 2)]!, last];

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    let best = 0;
    for (let i = 1; i < data.length; i++) {
      if (Math.abs(x(data[i]!) - px) < Math.abs(x(data[best]!) - px)) best = i;
    }
    setActive(best);
  }

  return (
    <div className={styles.chart}>
      <div ref={ref} className={styles.plot} style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${valueLabel}: from ${formatNumber(data[0]!.value)} on ${formatDay(data[0]!.date)} to ${formatNumber(last.value)} on ${formatDay(last.date)}. Use arrow keys to read each day.`}
            tabIndex={0}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(null)}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            className={styles.svg}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className={styles.grid} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className={styles.axis}>
                  {formatCompact(t)}
                </text>
              </g>
            ))}
            {xLabels.map((d, i) => (
              <text
                key={`${d.date}-${i}`}
                x={x(d)}
                y={height - 8}
                textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
                className={styles.axis}
              >
                {formatDay(d.date)}
              </text>
            ))}
            <path d={area} className={styles.area} />
            <path d={line} className={styles.line} />
            <circle cx={x(last)} cy={y(last.value)} r={4} className={styles.dot} />
            <text x={x(last) + 10} y={y(last.value)} dy="0.32em" className={styles.endLabel}>
              {formatCompact(last.value)}
            </text>
            {hovered && (
              <g pointerEvents="none">
                <line x1={x(hovered)} x2={x(hovered)} y1={PAD.top} y2={PAD.top + innerH} className={styles.crosshair} />
                <circle cx={x(hovered)} cy={y(hovered.value)} r={4} className={styles.dot} />
              </g>
            )}
          </svg>
        )}
        {hovered && (
          <div
            className={styles.tooltip}
            style={{ left: Math.min(Math.max(x(hovered), 70), width - 70), top: 0 }}
            role="status"
          >
            <strong>{formatNumber(hovered.value)}</strong>
            <span>{formatDay(hovered.date, true)}</span>
          </div>
        )}
      </div>
      <DataTable data={data} valueLabel={valueLabel} />
    </div>
  );
}
