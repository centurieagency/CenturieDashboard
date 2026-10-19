import Link from "next/link";

import { LineChart } from "@/components/charts/line-chart";
import type { DailyGains, DailyStats, GainedFollower, ProfileSnapshot } from "@/lib/centurie-api";
import { ActionsHistory } from "./actions-history";
import type { Period } from "./analytics";
import styles from "./statistics.module.css";

const number = new Intl.NumberFormat("en-US");
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

// Une action affichée à la fois : chacune garde sa propre échelle (les likes écrasaient les follows).
const SERIES = [
  { key: "story_like", label: "Story likes", color: "var(--data-1)" },
  { key: "post_like", label: "Post likes", color: "var(--data-2)" },
  { key: "follow", label: "Follows", color: "var(--data-3)" },
  { key: "unfollow", label: "Unfollows", color: "var(--data-4)" },
] as const;

function range(dates: string[]): string {
  if (!dates.length) return "";
  const fmt = (d: string) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  return `${fmt(dates[0]!)} to ${fmt(dates.at(-1)!)}`;
}

function Periods({ href, days }: { href: string; days: Period }) {
  return (
    <nav className={styles.periods} aria-label="Period">
      {([7, 30, 90] as const).map((p) => (
        <Link
          key={p}
          href={`${href}&days=${p}`}
          scroll={false}
          className={p === days ? styles.periodOn : styles.period}
          aria-current={p === days ? "page" : undefined}
        >
          {p} d
        </Link>
      ))}
    </nav>
  );
}

export function Statistics({
  href,
  days,
  data,
}: {
  /** Adresse de l'onglet, avec ?tab=statistics. */
  href: string;
  days: Period;
  data: {
    stats: DailyStats | null;
    gains: DailyGains | null;
    profileStats: ProfileSnapshot[] | null;
    followers: { total: number; followers: GainedFollower[] } | null;
  };
}) {
  const statDays = data.stats ? Object.keys(data.stats).sort() : [];
  const actionSeries = SERIES.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    points: statDays.map((d) => ({ date: d, value: data.stats?.[d]?.[s.key] ?? 0 })),
  }));

  const gainPoints = data.gains
    ? Object.entries(data.gains)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value }))
    : [];
  const gained = gainPoints.reduce((s, p) => s + p.value, 0);
  const average = gainPoints.length ? gained / gainPoints.length : 0;
  const record = gainPoints.reduce((best, p) => (p.value > best.value ? p : best), { date: "", value: 0 });

  const followerPoints = (data.profileStats ?? [])
    .map((p) => ({ date: p.date_checked.slice(0, 10), value: p.followers }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Cibles qui ont amené le plus de nouveaux followers sur la période.
  const sourceCounts = new Map<string, number>();
  for (const f of data.followers?.followers ?? []) for (const s of f.sources) sourceCounts.set(s, (sourceCounts.get(s) ?? 0) + 1);
  const topSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxSource = topSources[0]?.[1] ?? 1;

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="history-title">
        <div className={styles.head}>
          <div>
            <h2 id="history-title" className={styles.title}>Actions history</h2>
            <span className={styles.sub}>{range(statDays)}</span>
          </div>
          <Periods href={href} days={days} />
        </div>
        {data.stats ? (
          <ActionsHistory series={actionSeries} />
        ) : (
          <p className={styles.muted}>Action history is unavailable right now.</p>
        )}
      </section>

      <section className={styles.card} aria-labelledby="gains-title">
        <div className={styles.head}>
          <div>
            <h2 id="gains-title" className={styles.title}>New followers</h2>
            <span className={styles.sub}>{range(gainPoints.map((p) => p.date))}</span>
          </div>
          <Periods href={href} days={days} />
        </div>
        {gainPoints.length >= 2 ? (
          <>
            <LineChart data={gainPoints} valueLabel="New followers" height={230} showTable={false} />
            <dl className={styles.footer}>
              <div>
                <dt>Total</dt>
                <dd>+{number.format(gained)}</dd>
              </div>
              <div>
                <dt>Average</dt>
                <dd>
                  {decimal.format(average)}
                  <span>/day</span>
                </dd>
              </div>
              <div>
                <dt>Record</dt>
                <dd>{number.format(record.value)}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className={styles.muted}>New followers show here after a few days of data.</p>
        )}
      </section>

      <div className={styles.grid2}>
        <section className={styles.card} aria-labelledby="followers-title">
          <div className={styles.head}>
            <div>
              <h2 id="followers-title" className={styles.title}>Followers</h2>
              <span className={styles.sub}>{range(followerPoints.map((p) => p.date))}</span>
            </div>
          </div>
          {followerPoints.length >= 2 ? (
            <LineChart data={followerPoints} valueLabel="Followers" height={220} />
          ) : (
            <p className={styles.muted}>Not enough data for this period yet.</p>
          )}
        </section>

        <section className={styles.card} aria-labelledby="top-title">
          <div className={styles.head}>
            <div>
              <h2 id="top-title" className={styles.title}>Top targets</h2>
              <span className={styles.sub}>By new followers brought, last {days} days</span>
            </div>
          </div>
          {topSources.length === 0 ? (
            <p className={styles.muted}>No new followers attributed to a target yet.</p>
          ) : (
            <ol className={styles.bars}>
              {topSources.map(([source, count], i) => (
                <li key={source}>
                  <span className={styles.barLabel}>@{source}</span>
                  <span className={styles.barTrack}>
                    <span style={{ width: `${(count / maxSource) * 100}%` }} className={i === 0 ? styles.barTop : undefined} />
                  </span>
                  <b>{number.format(count)}</b>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
