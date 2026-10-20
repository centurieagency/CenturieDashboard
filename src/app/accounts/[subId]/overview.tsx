import Image from "next/image";
import { TransitionLink } from "./tab-transition";

import { LineChart } from "@/components/charts/line-chart";
import { StatusBadge } from "@/components/status-badge";
import type { StatusTone } from "@/lib/account-status";
import {
  profilePictureUrl,
  type DailyGains,
  type DailyStats,
  type GainedFollower,
  type InstagramProfile,
  type ProfileSnapshot,
  type RecentAction,
} from "@/lib/centurie-api";
import type { Period } from "./analytics";
import styles from "./overview.module.css";

const number = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const signedPct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });

const ACTIONS = [
  { key: "post_like", label: "Post likes", color: "var(--data-1)" },
  { key: "story_like", label: "Story likes", color: "var(--data-2)" },
  { key: "follow", label: "Follows", color: "var(--data-3)" },
  { key: "unfollow", label: "Unfollows", color: "var(--data-4)" },
] as const;

const FEED_LABEL: Record<string, string> = {
  follow: "Followed",
  post_like: "Liked a post",
  story_like: "Liked a story",
  unfollow: "Unfollowed",
  new_follower: "New follower",
};

export type OverviewData = {
  username: string;
  profile: InstagramProfile | null;
  status: { tone: StatusTone; label: string };
  expert: boolean;
  profileStats: ProfileSnapshot[] | null;
  gains: DailyGains | null;
  stats: DailyStats | null;
  prospects: number | null;
  followers: { total: number; followers: GainedFollower[] } | null;
  recentActions: RecentAction[] | null;
};

/** Projection linéaire sur les 14 derniers jours, prolongée de 7 jours. */
function project(points: { date: string; value: number }[], days = 7) {
  const tail = points.slice(-14);
  if (tail.length < 4) return [];
  const xs = tail.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = tail.reduce((a, p) => a + p.value, 0) / tail.length;
  const slope =
    xs.reduce((a, x, i) => a + (x - mx) * (tail[i]!.value - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const last = points.at(-1)!;
  const start = Date.parse(`${last.date}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(start + (i + 1) * 86400000).toISOString().slice(0, 10),
    value: Math.round(last.value + slope * (i + 1)),
  }));
}

/** Heure de la requête : composant serveur rendu à chaque requête, les « il y a 2 h » se calculent à cet instant. */
function requestTime(): number {
  return Date.now();
}

function relative(iso: string, now: number): string {
  const diff = Math.max(0, now - Date.parse(iso));
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))} min ago`;
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** Mini-courbe décorative (non interactive : les valeurs détaillées sont dans l'onglet Statistics). */
function Spark({ values, id }: { values: number[]; id: string }) {
  if (values.length < 2) return null;
  const w = 220, h = 70, min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 6 - ((v - min) / (max - min || 1)) * (h - 14)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  return (
    <svg className={styles.spark} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--data-accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--data-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${w},${h}L0,${h}Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="var(--data-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Anneau de répartition (part du total), étiquettes et pourcentages affichés à côté. */
function Donut({ parts, total }: { parts: { label: string; value: number; color: string }[]; total: number }) {
  const r = 52, c = 2 * Math.PI * r, gap = 3;
  let offset = 0;
  return (
    <div className={styles.donutWrap}>
      <svg viewBox="0 0 140 140" className={styles.donut} role="img" aria-label={`${number.format(total)} actions in total`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--cream-alt)" strokeWidth="18" />
        {total > 0 &&
          parts.map((p) => {
            const len = (p.value / total) * c;
            const seg = (
              <circle
                key={p.label}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth="18"
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += len;
            return seg;
          })}
      </svg>
      <div className={styles.donutCenter}>
        <strong>{compact.format(total)}</strong>
        <span>actions</span>
      </div>
    </div>
  );
}

const Icon = {
  users: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1.4a3.4 3.4 0 0 0-2.5-3.3M15.5 4.6a3 3 0 0 1 0 5.8" /></svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2.5 4.5 13.5h6.5l-1 8 8.5-11h-6.5z" /></svg>
  ),
  live: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2.5 4.5 13.5h6.5l-1 8 8.5-11h-6.5z" /></svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z" /></svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 4 17.5V19M9.5 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 8v6M16 11h6" /></svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="0.6" /></svg>
  ),
};

export function Overview({ data, days, href }: { data: OverviewData; days: Period; href: string }) {
  const { username, profile } = data;
  const followerPoints = (data.profileStats ?? [])
    .map((p) => ({ date: p.date_checked.slice(0, 10), value: p.followers }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const projection = project(followerPoints);
  const first = followerPoints[0]?.value;
  const lastPoint = followerPoints.at(-1)?.value ?? profile?.follower_count ?? null;
  const growth = first && lastPoint != null ? (lastPoint - first) / first : null;
  // Si le profil public ne répond pas, on reprend les chiffres du dernier relevé quotidien.
  const snapshot = (data.profileStats ?? []).at(-1);
  const posts = profile?.media_count ?? snapshot?.nb_posts ?? null;
  const followersCount = profile?.follower_count ?? snapshot?.followers ?? null;
  const following = profile?.following_count ?? snapshot?.followings ?? null;

  const gainDays = data.gains ? Object.entries(data.gains).sort(([a], [b]) => a.localeCompare(b)) : [];
  const gained = gainDays.reduce((s, [, n]) => s + n, 0);
  const statDays = data.stats ? Object.keys(data.stats).sort() : [];
  const dailyTotals = statDays.map((d) =>
    Object.values(data.stats![d] ?? {}).reduce((s: number, n) => s + (n ?? 0), 0),
  );
  const totals = ACTIONS.map((a) => ({
    ...a,
    value: statDays.reduce((s, d) => s + (data.stats?.[d]?.[a.key] ?? 0), 0),
  }));
  const interactions = totals.reduce((s, a) => s + a.value, 0);
  const today = statDays.at(-1) ? data.stats![statDays.at(-1)!] : undefined;

  // Flux : dernières actions + nouveaux followers, du plus récent au plus ancien.
  const now = requestTime();
  const feed = [
    ...(data.recentActions ?? []).map((a) => ({ who: a.interactor_username, kind: a.action_type, at: a.action_date })),
    ...(data.followers?.followers ?? []).slice(0, 6).map((f) => ({ who: f.username, kind: "new_follower", at: `${f.date}T12:00:00Z` })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 24);

  return (
    <div className={styles.grid}>
      {/* Profil */}
      <section className={`${styles.card} ${styles.profile}`} aria-label={`Instagram profile @${username}`}>
        <div className={styles.profileTop}>
          <span className={styles.tag}>{data.expert ? "Expert" : "Standard"}</span>
          <a
            className={styles.iconButton}
            href={`https://www.instagram.com/${encodeURIComponent(username)}/`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open @${username} on Instagram`}
          >
            {Icon.instagram}
          </a>
        </div>
        <div className={styles.avatarRing}>
          <Image src={profilePictureUrl(username)} alt="" width={84} height={84} className={styles.avatar} priority />
        </div>
        <h1 className={styles.handle}>
          {username}
          {profile?.is_verified && <span className={styles.verified} title="Verified">✓</span>}
        </h1>
        {profile?.full_name && <p className={styles.fullName}>{profile.full_name}</p>}
        <StatusBadge tone={data.status.tone} label={data.status.label} size="sm" />
        {profile?.biography && <p className={styles.bio}>{profile.biography}</p>}
        <dl className={styles.profileStats}>
          <div>
            <dd>{posts != null ? number.format(posts) : "–"}</dd>
            <dt>Posts</dt>
          </div>
          <div>
            <dd>{followersCount != null ? compact.format(followersCount) : "–"}</dd>
            <dt>Followers</dt>
          </div>
          <div>
            <dd>{following != null ? compact.format(following) : "–"}</dd>
            <dt>Following</dt>
          </div>
        </dl>
      </section>

      {/* Croissance */}
      <section className={`${styles.card} ${styles.growth}`} aria-labelledby="growth-title">
        <div className={styles.cardHead}>
          <div>
            <h2 id="growth-title" className={styles.cardTitle}>
              Follower growth
            </h2>
            <span className={styles.cardSub}>Last {days} days</span>
          </div>
          <div className={styles.headRight}>
            {growth != null && (
              <span className={`${styles.pill} ${growth >= 0 ? styles.pillUp : styles.pillDown}`}>
                {growth >= 0 ? "↗" : "↘"} {signedPct.format(growth)}
              </span>
            )}
            <nav className={styles.periods} aria-label="Period">
              {([7, 30, 90] as const).map((p) => (
                <TransitionLink
                  key={p}
                  href={`${href}?days=${p}`}
                  className={p === days ? styles.periodOn : styles.period}
                  aria-current={p === days ? "page" : undefined}
                >
                  {p}d
                </TransitionLink>
              ))}
            </nav>
          </div>
        </div>
        <div className={styles.bigNumber}>
          <strong>{lastPoint != null ? number.format(lastPoint) : "–"}</strong>
          <span>followers</span>
        </div>
        <div className={styles.legend} aria-hidden="true">
          <span><i className={styles.legendReal} />Actual</span>
          {projection.length > 0 && <span><i className={styles.legendProj} />Projection, next 7 days</span>}
        </div>
        {followerPoints.length >= 2 ? (
          <LineChart data={followerPoints} projection={projection} valueLabel="Followers" height={210} showTable={false} />
        ) : (
          <p className={styles.muted}>Growth shows here after a few days of data.</p>
        )}
      </section>

      {/* Chiffres clés */}
      <section className={`${styles.card} ${styles.kpi}`}>
        <span className={`${styles.label} ${styles.labelA}`}>{Icon.plus}New followers</span>
        <strong className={styles.kpiValue}>{data.gains ? number.format(gained) : "–"}</strong>
        <span className={styles.kpiSub}>last {days} days</span>
        <Spark values={gainDays.map(([, n]) => n)} id="spark-gains" />
      </section>
      <section className={`${styles.card} ${styles.kpi}`}>
        <span className={`${styles.label} ${styles.labelB}`}>{Icon.eye}People reached</span>
        <strong className={styles.kpiValue}>{data.prospects != null ? number.format(data.prospects) : "–"}</strong>
        <span className={styles.kpiSub}>last {days} days</span>
        <span className={styles.kpiGlyph} aria-hidden="true">{Icon.eye}</span>
      </section>
      <section className={`${styles.card} ${styles.kpi}`}>
        <span className={`${styles.label} ${styles.labelC}`}>{Icon.spark}Interactions</span>
        <strong className={styles.kpiValue}>{data.stats ? number.format(interactions) : "–"}</strong>
        <span className={styles.kpiSub}>last {days} days</span>
        <Spark values={dailyTotals} id="spark-actions" />
      </section>

      {/* Flux en direct */}
      <section className={`${styles.card} ${styles.feed}`} aria-labelledby="feed-title">
        <div className={styles.cardHead}>
          <div className={styles.titleWithIcon}>
            <span className={styles.liveIcon}>{Icon.live}</span>
            <div>
              <h2 id="feed-title" className={styles.cardTitle}>
                Live feed
              </h2>
              <span className={styles.cardSub}>Latest activity on the account</span>
            </div>
          </div>
          <span className={`${styles.pill} ${styles.pillUp}`}>
            <i className={styles.liveDot} />
            Live
          </span>
        </div>
        {today && (
          <div className={styles.todayRow}>
            <span><b>{number.format((today.post_like ?? 0) + (today.story_like ?? 0))}</b> likes</span>
            <span><b>{number.format(today.follow ?? 0)}</b> follows</span>
            <span><b>{number.format(today.unfollow ?? 0)}</b> unfollows</span>
            <span className={styles.todayLabel}>today</span>
          </div>
        )}
        {feed.length === 0 ? (
          <p className={styles.muted}>No activity yet.</p>
        ) : (
          // Défilement automatique et lent, en boucle (liste doublée pour un enchaînement sans saut).
          // Pause au survol ou au clavier ; arrêté si l'utilisateur a demandé moins d'animations.
          <div className={styles.feedViewport}>
            <div
              className={feed.length > 6 ? styles.feedTrack : undefined}
              style={{ "--feed-duration": `${feed.length * 3.5}s` } as React.CSSProperties}
            >
              {(feed.length > 6 ? [false, true] : [false]).map((copy) => (
                <ul key={String(copy)} className={styles.feedList} aria-hidden={copy || undefined}>
                  {feed.map((item, i) => (
                    <li key={`${item.who}-${item.at}-${i}`} className={styles.feedItem}>
                      <span className={styles.feedAvatar} aria-hidden="true">
                        {item.who.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase()}
                      </span>
                      <div className={styles.feedText}>
                        <a
                          href={`https://www.instagram.com/${encodeURIComponent(item.who)}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          tabIndex={copy ? -1 : undefined}
                        >
                          @{item.who}
                        </a>
                        <span>
                          {FEED_LABEL[item.kind] ?? item.kind} · {relative(item.at, now)}
                        </span>
                      </div>
                      <span
                        className={`${styles.feedKind} ${item.kind === "new_follower" ? styles.feedKindStrong : ""}`}
                        aria-hidden="true"
                      >
                        {item.kind.includes("like") ? Icon.heart : Icon.plus}
                      </span>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Répartition des actions */}
      <section className={`${styles.card} ${styles.split}`} aria-labelledby="split-title">
        <div className={styles.cardHead}>
          <div>
            <h2 id="split-title" className={styles.cardTitle}>
              Actions breakdown
            </h2>
            <span className={styles.cardSub}>Last {days} days</span>
          </div>
          <span className={`${styles.pill} ${styles.pillUp}`}>
            <i className={styles.liveDot} />
            Active
          </span>
        </div>
        <div className={styles.splitBody}>
          <Donut parts={totals} total={interactions} />
          <ul className={styles.bars}>
            {totals.map((a) => {
              const pct = interactions ? a.value / interactions : 0;
              return (
                <li key={a.key}>
                  <div className={styles.barHead}>
                    <span>
                      <i style={{ background: a.color }} />
                      {a.label}
                    </span>
                    <b>{Math.round(pct * 100)}%</b>
                  </div>
                  <div className={styles.barTrack}>
                    <span style={{ width: `${pct * 100}%`, background: a.color }} />
                  </div>
                  <span className={styles.barValue}>{number.format(a.value)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
