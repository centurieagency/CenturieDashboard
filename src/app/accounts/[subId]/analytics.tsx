import Link from "next/link";

import { ColumnChart } from "@/components/charts/column-chart";
import { LineChart } from "@/components/charts/line-chart";
import type { DailyGains, DailyStats, Followback, GainedFollower, ProfileSnapshot } from "@/lib/centurie-api";
import styles from "./analytics.module.css";

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

const number = new Intl.NumberFormat("en-US");
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const signed = new Intl.NumberFormat("en-US", { signDisplay: "exceptZero" });

const ACTIONS = [
  { key: "follow", label: "Follows" },
  { key: "post_like", label: "Post likes" },
  { key: "story_like", label: "Story likes" },
  { key: "unfollow", label: "Unfollows" },
] as const;

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso.slice(0, 10)}T00:00:00Z`),
  );
}

export type AnalyticsData = {
  followerCount: number | null;
  stats: DailyStats | null;
  gains: DailyGains | null;
  profileStats: ProfileSnapshot[] | null;
  followers: { total: number; followers: GainedFollower[] } | null;
  followbacks: { total: number; items: Followback[] } | null;
  prospects: number | null;
};

/** `href` : adresse de la page du compte (client ou admin), pour les liens de période. */
export function Analytics({ href, days, data }: { href: string; days: Period; data: AnalyticsData }) {
  const statDays = data.stats ? Object.keys(data.stats).sort() : [];
  const actionSeries = ACTIONS.map((a) => ({
    ...a,
    points: statDays.map((d) => ({ date: d, value: data.stats?.[d]?.[a.key] ?? 0 })),
  }));
  const actionTotals = Object.fromEntries(
    actionSeries.map((s) => [s.key, s.points.reduce((sum, p) => sum + p.value, 0)]),
  ) as Record<(typeof ACTIONS)[number]["key"], number>;
  const totalActions = Object.values(actionTotals).reduce((a, b) => a + b, 0);

  const gainPoints = data.gains
    ? Object.entries(data.gains)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value }))
    : [];
  const gained = gainPoints.reduce((s, p) => s + p.value, 0);

  const followerPoints = (data.profileStats ?? [])
    .map((p) => ({ date: p.date_checked.slice(0, 10), value: p.followers }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const followerDelta =
    followerPoints.length >= 2 ? followerPoints.at(-1)!.value - followerPoints[0]!.value : null;

  const followBackRate =
    data.followbacks && actionTotals.follow > 0 ? data.followbacks.total / actionTotals.follow : null;

  // Cibles qui ont amené le plus de nouveaux followers (un follower peut venir de plusieurs cibles).
  const sourceCounts = new Map<string, number>();
  for (const f of data.followers?.followers ?? []) {
    for (const s of f.sources) sourceCounts.set(s, (sourceCounts.get(s) ?? 0) + 1);
  }
  const topSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxSource = topSources[0]?.[1] ?? 1;
  const latestFollowers = (data.followers?.followers ?? []).slice(0, 12);

  const dash = "–";

  return (
    <section className={styles.analytics} aria-labelledby="analytics-title">
      <div className={styles.toolbar}>
        <h2 id="analytics-title" className={styles.sectionTitle}>
          Performance
        </h2>
        <nav aria-label="Period" className={styles.periods}>
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`${href}?days=${p}`}
              scroll={false}
              className={p === days ? styles.periodActive : styles.period}
              aria-current={p === days ? "page" : undefined}
            >
              {p} days
            </Link>
          ))}
        </nav>
      </div>

      <div className={styles.kpis}>
        <Stat
          label="Followers"
          value={data.followerCount != null ? number.format(data.followerCount) : dash}
          delta={followerDelta != null ? `${signed.format(followerDelta)} over ${days} days` : undefined}
        />
        <Stat label="New followers" value={data.gains ? `+${number.format(gained)}` : dash} delta={`last ${days} days`} />
        <Stat
          label="Follow-back rate"
          value={followBackRate != null ? percent.format(followBackRate) : dash}
          delta={data.followbacks ? `${number.format(data.followbacks.total)} follow-backs` : undefined}
        />
        <Stat
          label="Actions performed"
          value={data.stats ? number.format(totalActions) : dash}
          delta={statDays.length ? `${number.format(Math.round(totalActions / statDays.length))} per day` : undefined}
        />
        <Stat
          label="People reached"
          value={data.prospects != null ? number.format(data.prospects) : dash}
          delta={`last ${days} days`}
        />
      </div>

      <div className={styles.grid2}>
        <Panel title="Followers" meta={followerPoints.length ? `${shortDate(followerPoints[0]!.date)} to ${shortDate(followerPoints.at(-1)!.date)}` : undefined}>
          {data.profileStats ? (
            <LineChart data={followerPoints} valueLabel="Followers" />
          ) : (
            <Unavailable />
          )}
        </Panel>
        <Panel title="New followers per day" meta={data.gains ? `+${number.format(gained)} in total` : undefined}>
          {data.gains ? <ColumnChart data={gainPoints} valueLabel="New followers" /> : <Unavailable />}
        </Panel>
      </div>

      <Panel title="Actions per day" meta={data.stats ? `${number.format(totalActions)} in total` : undefined}>
        {data.stats ? (
          <>
            <div className={styles.multiples}>
              {actionSeries.map((s) => (
                <div key={s.key} className={styles.multiple}>
                  <div className={styles.multipleHead}>
                    <span className={styles.multipleLabel}>{s.label}</span>
                    <span className={styles.multipleValue}>{number.format(actionTotals[s.key])}</span>
                  </div>
                  <ColumnChart data={s.points} valueLabel={s.label} height={130} compact />
                </div>
              ))}
            </div>
            <details className={styles.tableView}>
              <summary>View as table</summary>
              <div className={styles.tableScroll}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      {ACTIONS.map((a) => (
                        <th key={a.key} scope="col">
                          {a.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...statDays].reverse().map((d) => (
                      <tr key={d}>
                        <td>{shortDate(d)}</td>
                        {ACTIONS.map((a) => (
                          <td key={a.key}>{number.format(data.stats?.[d]?.[a.key] ?? 0)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <Unavailable />
        )}
      </Panel>

      <div className={styles.grid2}>
        <Panel title="Top targets" meta="by new followers brought">
          {topSources.length === 0 ? (
            <p className={styles.muted}>No new followers attributed to a target yet.</p>
          ) : (
            <ol className={styles.bars}>
              {topSources.map(([source, count]) => (
                <li key={source} className={styles.barRow}>
                  <span className={styles.barLabel}>@{source}</span>
                  <span className={styles.barTrack}>
                    <span className={styles.barFill} style={{ width: `${(count / maxSource) * 100}%` }} />
                  </span>
                  <span className={styles.barValue}>{number.format(count)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel
          title="Latest new followers"
          meta={data.followers ? `${number.format(data.followers.total)} over ${days} days` : undefined}
        >
          {latestFollowers.length === 0 ? (
            <p className={styles.muted}>No new followers over this period yet.</p>
          ) : (
            <ul className={styles.people}>
              {latestFollowers.map((f) => (
                <li key={`${f.username}-${f.date}`} className={styles.person}>
                  <a
                    href={`https://www.instagram.com/${encodeURIComponent(f.username)}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.personHandle}
                  >
                    @{f.username}
                  </a>
                  <span className={styles.personMeta}>
                    {shortDate(f.date)}
                    {f.sources[0] && ` · via @${f.sources[0]}`}
                    {f.sources.length > 1 && ` +${f.sources.length - 1}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}

function Stat({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {delta && <span className={styles.statDelta}>{delta}</span>}
    </div>
  );
}

function Panel({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h3 className={styles.panelTitle}>{title}</h3>
        {meta && <span className={styles.panelMeta}>{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Unavailable() {
  return <p className={styles.muted}>This data is unavailable right now.</p>;
}
