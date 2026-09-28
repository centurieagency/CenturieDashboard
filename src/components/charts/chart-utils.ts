"use client";

import { useEffect, useRef, useState } from "react";

export type Point = { date: string; value: number };

/** Largeur réelle du conteneur, pour dessiner le SVG au pixel près (traits de 2px nets). */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry?.contentRect.width ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Graduations « rondes » (0 / 50 / 100…) couvrant [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

const numberFmt = new Intl.NumberFormat("en-US");
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const formatNumber = (n: number) => numberFmt.format(n);
export const formatCompact = (n: number) => (Math.abs(n) >= 10_000 ? compactFmt.format(n) : numberFmt.format(n));

export function formatDay(iso: string, withYear = false): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear && { year: "numeric" }),
    timeZone: "UTC",
  }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

export function dayTime(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
}

/** Navigation clavier commune : flèches pour passer d'un point à l'autre, Échap pour sortir. */
export function useKeyboardIndex(length: number) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((i) => {
        const cur = i ?? (e.key === "ArrowRight" ? -1 : length);
        return Math.min(length - 1, Math.max(0, cur + (e.key === "ArrowRight" ? 1 : -1)));
      });
    } else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(length - 1);
    else if (e.key === "Escape") setActive(null);
  };
  return { active, setActive, onKeyDown, onBlur: () => setActive(null) };
}
