import type { StatusTone } from "@/lib/account-status";
import { RecommendationList, type Recommendation } from "./analysis-checklist";
import styles from "./analysis.module.css";

const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const clamp = (v: number) => Math.max(0, Math.min(1, v));

export type AnalysisInput = {
  subId: string;
  targetsHref: string;
  settingsHref: string;
  username: string;
  targetsCount: number | null;
  weakTargets: number | null;
  follows: number;
  followbacks: number | null;
  gainsPerDay: number | null;
  statusTone: StatusTone;
  statusLabel: string;
  isActive: boolean;
  posts: number | null;
  hasBio: boolean;
};

/** Score de profil 0-100 : chaque critère est ramené entre 0 et 1, puis pondéré. */
function computeScore(d: AnalysisInput) {
  const followBackRate = d.followbacks != null && d.follows > 0 ? d.followbacks / d.follows : null;
  const parts = [
    { label: "Targets", weight: 0.25, value: d.targetsCount != null ? clamp(d.targetsCount / 40) : 0.5 },
    { label: "Follow-back rate", weight: 0.25, value: followBackRate != null ? clamp(followBackRate / 0.25) : 0.5 },
    { label: "New followers per day", weight: 0.25, value: d.gainsPerDay != null ? clamp(d.gainsPerDay / 10) : 0.5 },
    {
      label: "Account health",
      weight: 0.15,
      value: d.statusTone === "ok" ? (d.isActive ? 1 : 0.5) : d.statusTone === "pending" ? 0.6 : 0.15,
    },
    { label: "Profile", weight: 0.1, value: clamp(((d.posts ?? 0) >= 9 ? 0.6 : (d.posts ?? 0) / 15) + (d.hasBio ? 0.4 : 0)) },
  ];
  const score = Math.round(parts.reduce((s, p) => s + p.weight * p.value, 0) * 100);
  return { score, parts, followBackRate };
}

function recommendations(d: AnalysisInput, followBackRate: number | null): Recommendation[] {
  const list: Recommendation[] = [];
  const instagram = { href: `https://www.instagram.com/${encodeURIComponent(d.username)}/`, label: "Open Instagram profile", external: true };
  if (d.statusTone === "warn" || d.statusTone === "danger")
    list.push({ id: "status", tone: "danger", tag: "Urgent", title: `Fix the account: ${d.statusLabel.toLowerCase()}`, text: "Growth is on hold until the login problem is solved. Go to Settings to update the credentials.", action: { href: d.settingsHref, label: "Update login" } });
  if (!d.isActive && d.statusTone === "ok")
    list.push({ id: "paused", tone: "warn", tag: "To do", title: "Growth is paused", text: "No actions are sent while the account is paused. Resume it in Settings when the client is ready.", action: { href: d.settingsHref, label: "Open settings" } });
  if (d.targetsCount != null && d.targetsCount < 40)
    list.push({ id: "targets", tone: "info", tag: "To do", title: "Widen the targets", text: `${d.targetsCount} targets today. Aim for 40 or more varied accounts with the same audience to keep reach steady.`, action: { href: d.targetsHref, label: "Add targets" } });
  if (d.weakTargets != null && d.weakTargets >= 5)
    list.push({ id: "weak", tone: "warn", tag: "To do", title: "Remove low-performing targets", text: `${d.weakTargets} targets brought no new follower in 90 days. Replace them with closer accounts.`, action: { href: d.targetsHref, label: "Review targets" } });
  if (followBackRate != null && followBackRate < 0.1 && (d.targetsCount ?? 0) >= 20)
    list.push({ id: "conversion", tone: "danger", tag: "Important", title: "Low conversion despite good targeting", text: `Only ${pct.format(followBackRate)} of follows come back. The profile itself (bio, recent posts, highlights) probably doesn't convert visitors.`, action: instagram });
  if (d.gainsPerDay != null && d.gainsPerDay < 3)
    list.push({ id: "slow", tone: "warn", tag: "To do", title: "Growth is slow", text: `${decimal.format(d.gainsPerDay)} new followers a day on average. Review the targets and raise the daily limits if the account allows it.`, action: { href: d.settingsHref, label: "Adjust daily limits" } });
  if ((d.posts ?? 0) < 9 || !d.hasBio)
    list.push({ id: "profile", tone: "info", tag: "To do", title: "Strengthen the profile", text: "Visitors decide in seconds. A clear bio and at least 9 posts make them follow back more often.", action: instagram });
  return list;
}

/** Jauge en demi-cercle : graduations rouge → orange → vert, aiguille sur le score. */
function Gauge({ score }: { score: number }) {
  const ticks = 40;
  const cx = 150, cy = 140, r1 = 100, r2 = 122;
  const angle = (t: number) => Math.PI * (1 - t);
  const tone = (t: number) => (t < 0.4 ? "var(--status-danger)" : t < 0.7 ? "var(--status-warn)" : "var(--status-ok)");
  const needle = angle(score / 100);
  return (
    <svg viewBox="0 0 300 175" className={styles.gauge} role="img" aria-label={`Profile score ${score} out of 100`}>
      {Array.from({ length: ticks }, (_, i) => {
        const t = i / (ticks - 1);
        const a = angle(t);
        const on = t <= score / 100;
        return (
          <line
            key={i}
            x1={cx + r1 * Math.cos(a)}
            y1={cy - r1 * Math.sin(a)}
            x2={cx + r2 * Math.cos(a)}
            y2={cy - r2 * Math.sin(a)}
            stroke={on ? tone(t) : "var(--cream-alt)"}
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
      })}
      <line x1={cx} y1={cy} x2={cx + 78 * Math.cos(needle)} y2={cy - 78 * Math.sin(needle)} stroke="var(--charcoal)" strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={7} fill="var(--white)" stroke="var(--charcoal)" strokeWidth={3} />
      <text x={cx - r2} y={cy + 22} className={styles.gaugeAxis} textAnchor="middle">0</text>
      <text x={cx + r2} y={cy + 22} className={styles.gaugeAxis} textAnchor="middle">100</text>
    </svg>
  );
}

export function Analysis({ data }: { data: AnalysisInput }) {
  const { score, parts, followBackRate } = computeScore(data);
  const label = score >= 70 ? "Excellent" : score >= 40 ? "Good" : "Needs work";
  const labelTone = score >= 70 ? styles.badgeOk : score >= 40 ? styles.badgeWarn : styles.badgeDanger;
  const recos = recommendations(data, followBackRate);
  const count = data.targetsCount ?? 0;
  const markerPos = Math.min(94, Math.max(6, (count / 80) * 100));

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="score-title">
        <div className={styles.head}>
          <div className={styles.titleRow}>
            <span className={`${styles.icon} ${styles.iconOk}`} aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z" /></svg>
            </span>
            <div>
              <h2 id="score-title" className={styles.title}>Profile score</h2>
              <span className={styles.sub}>Overall performance of the account, admin only</span>
            </div>
          </div>
          <span className={`${styles.badge} ${labelTone}`}><i />{label}</span>
        </div>
        <div className={styles.scoreBody}>
          <div className={styles.gaugeWrap}>
            <Gauge score={score} />
            <div className={styles.scoreValue}>
              <strong>{score}</strong>
              <span>/100</span>
            </div>
          </div>
          <ul className={styles.parts}>
            {parts.map((p) => (
              <li key={p.label}>
                <div className={styles.partHead}>
                  <span>{p.label}</span>
                  <b>{Math.round(p.value * 100)}</b>
                </div>
                <div className={styles.partTrack}>
                  <span style={{ width: `${p.value * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="reco-title">
        <RecommendationList subId={data.subId} items={recos} />
      </section>

      <section className={styles.card} aria-labelledby="count-title">
        <div className={styles.titleRow}>
          <span className={`${styles.icon} ${styles.iconAccent}`} aria-hidden="true">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>
          </span>
          <div>
            <h2 id="count-title" className={styles.title}>Number of targets</h2>
            <span className={styles.sub}>Accounts whose followers we reach</span>
          </div>
        </div>
        <div className={styles.meter}>
          <span className={styles.marker} style={{ left: `${markerPos}%` }}>
            <b>{count} targets</b>
          </span>
          <div className={styles.meterBar} aria-hidden="true">
            <span className={styles.segLow} />
            <span className={styles.segMid} />
            <span className={styles.segHigh} />
          </div>
          <div className={styles.meterLabels}>
            <span>Too few · 0 to 15</span>
            <span>Correct · 15 to 40</span>
            <span>Ideal · 40 and more</span>
          </div>
        </div>
      </section>
    </div>
  );
}
