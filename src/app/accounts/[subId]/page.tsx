import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { accountStatus } from "@/lib/account-status";
import {
  getAccountDetailed,
  getConfig,
  getGains,
  getStats,
  getTargets,
  listAccounts,
  type AccountSummary,
} from "@/lib/centurie-api";
import { requireCustomer } from "@/lib/customer";
import styles from "./account.module.css";
import {
  ActiveToggle,
  AddTargetForm,
  AutoRefresh,
  BackupCodesForm,
  ConfigForm,
  ConnectForm,
  PasswordForm,
  RemoveTargetButton,
  TotpKeyForm,
} from "./forms";

export const metadata: Metadata = { title: "Instagram account · Centurie Growth" };

type PageProps = { params: Promise<{ subId: string }> };

const number = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function settled<T>(result: PromiseSettledResult<T>): T | null {
  if (result.status === "fulfilled") return result.value;
  console.error("Centurie API read failed", result.reason);
  return null;
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`));
}

export default async function AccountPage({ params }: PageProps) {
  const { subId } = await params;
  if (!/^sub_[A-Za-z0-9]+$/.test(subId)) notFound();

  const { user, apiToken } = await requireCustomer(`/accounts/${subId}`);
  if (!apiToken) notFound();

  let summary: AccountSummary | undefined;
  try {
    summary = (await listAccounts(apiToken)).find((a) => a.sub_id === subId);
  } catch (error) {
    console.error("Centurie API accounts lookup failed", error);
    return (
      <Shell email={user.email}>
        <p role="alert" className={styles.error}>
          We couldn&apos;t reach your Instagram account right now. Please refresh the page in a moment.
        </p>
      </Shell>
    );
  }
  // Abonnement inconnu, hors périmètre ou non utilisable (annulé…).
  if (!summary) notFound();

  if (!summary.username) {
    return (
      <Shell email={user.email}>
        <div className={styles.head}>
          <span className={styles.eyebrow}>Instagram account</span>
          <h1 className={styles.title}>Connect your Instagram</h1>
          <p className={styles.lead}>
            Link the account we should grow on this subscription. We log in for you and start within a day.
          </p>
          <code className={styles.subId}>{subId}</code>
        </div>
        <section className={`${styles.panel} ${styles.narrow}`}>
          <ConnectForm subId={subId} />
        </section>
      </Shell>
    );
  }

  const [detailedR, configR, targetsR, statsR, gainsR] = await Promise.allSettled([
    getAccountDetailed(apiToken, subId),
    getConfig(apiToken, subId),
    getTargets(apiToken, subId),
    getStats(apiToken, subId),
    getGains(apiToken, subId),
  ]);
  const detailed = settled(detailedR);
  const config = settled(configR);
  const targets = settled(targetsR);
  const stats = settled(statsR);
  const gains = settled(gainsR);

  const status = accountStatus(summary.current_status);
  const needsPassword = summary.current_status === "wrong_password";
  const needs2FA = summary.current_status === "wrong_2fa";
  const isConnecting = summary.current_status === "pending" || summary.current_status === "waiting_for_connect";
  const isActive = summary.is_active !== false;
  const expert = summary.expert === true;
  const infos = detailed?.infos;

  const today = stats ? Object.keys(stats).sort().at(-1) : undefined;
  const todayStats = today && stats ? stats[today] : undefined;
  const gainDays = gains ? Object.entries(gains).sort(([a], [b]) => a.localeCompare(b)).slice(-30) : [];
  const gained30 = gainDays.reduce((sum, [, n]) => sum + n, 0);
  const maxGain = Math.max(1, ...gainDays.map(([, n]) => n));

  return (
    <Shell email={user.email}>
      <div className={styles.headRow}>
        <div className={styles.head}>
          <span className={styles.eyebrow}>Instagram account</span>
          <h1 className={styles.title}>@{summary.username}</h1>
          <div className={styles.metaRow}>
            {infos?.full_name && <span>{infos.full_name}</span>}
            <span className={isConnecting ? styles.dotPending : status.ok ? styles.dotOk : styles.dotWarn}>
              {status.label}
            </span>
            {!isConnecting && (
              <span className={isActive ? styles.dotOk : styles.dotWarn}>{isActive ? "Running" : "Paused"}</span>
            )}
            <span>{expert ? "Expert mode" : "Normal mode"}</span>
            <code className={styles.subId}>{subId}</code>
          </div>
        </div>
        {!isConnecting && <ActiveToggle subId={subId} isActive={isActive} />}
      </div>

      {!status.ok && status.help && (
        <p role="alert" className={styles.notice}>
          <strong>{status.label}.</strong> {status.help}
        </p>
      )}

      {isConnecting ? (
        <ConnectingPanel username={summary.username} />
      ) : (
        <>
      <section aria-label="Key figures" className={styles.kpis}>
        <Kpi label="Followers" value={infos ? number.format(infos.follower_count) : "–"} />
        <Kpi label="Gained, last 30 days" value={gains ? `+${number.format(gained30)}` : "–"} />
        <Kpi label="Follows today" value={todayStats ? number.format(todayStats.follow ?? 0) : "–"} />
        <Kpi
          label="Likes today"
          value={todayStats ? number.format((todayStats.post_like ?? 0) + (todayStats.story_like ?? 0)) : "–"}
        />
      </section>

      {gainDays.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>New followers per day</h2>
            <span className={styles.panelMeta}>
              {shortDate(gainDays[0]![0])} to {shortDate(gainDays.at(-1)![0])}
            </span>
          </div>
          <div className={styles.chart} role="img" aria-label={`New followers per day, ${gained30} in total over ${gainDays.length} days`}>
            {gainDays.map(([day, n]) => (
              <div key={day} className={styles.barSlot} title={`${shortDate(day)}: +${n}`}>
                <div className={styles.bar} style={{ height: `${Math.max(2, (n / maxGain) * 100)}%` }} />
              </div>
            ))}
          </div>
        </section>
      )}
        </>
      )}

      <div className={needsPassword || needs2FA ? styles.columns : undefined}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Daily limits</h2>
          </div>
          {config ? (
            <ConfigForm
              subId={subId}
              expert={expert}
              config={{
                per_day_follow: config.per_day_follow ?? 30,
                per_day_like_post: config.per_day_like_post ?? 150,
                per_day_like_story: config.per_day_like_story ?? 250,
                enabled_follow: config.enabled_follow ?? true,
                enabled_post_like: config.enabled_post_like ?? true,
                enabled_like_story: config.enabled_like_story ?? true,
                enabled_warmup: config.enabled_warmup ?? false,
              }}
            />
          ) : (
            <p className={styles.muted}>Limits are unavailable right now.</p>
          )}
        </section>

        {/* Identifiants : seulement quand Instagram les a refusés. */}
        {(needsPassword || needs2FA) && (
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Login and security</h2>
            </div>
            <div className={styles.stack}>
              {needsPassword && <PasswordForm subId={subId} />}
              {needs2FA && (
                <>
                  <TotpKeyForm subId={subId} />
                  <div className={styles.rule} />
                  <BackupCodesForm subId={subId} />
                </>
              )}
            </div>
          </section>
        )}
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Targets</h2>
          {targets && <span className={styles.panelMeta}>{number.format(targets.length)} accounts</span>}
        </div>
        <p className={styles.muted}>
          We reach people who follow these accounts. Pick accounts whose audience looks like your customers.
        </p>
        <AddTargetForm subId={subId} />
        {targets === null ? (
          <p className={styles.muted}>Targets are unavailable right now.</p>
        ) : targets.length === 0 ? (
          <p className={styles.muted}>No targets yet.</p>
        ) : (
          <ul className={styles.targets}>
            {targets.map((t) => (
              <li key={t.username} className={styles.target}>
                <div className={styles.targetMain}>
                  <span className={styles.targetHandle}>@{t.username}</span>
                  {t.full_name && t.full_name !== t.username && (
                    <span className={styles.targetName}>{t.full_name}</span>
                  )}
                </div>
                <span className={styles.targetMeta}>
                  {t.followers != null && `${compact.format(t.followers)} followers`}
                  {t.is_private && " · Private"}
                  {t.accepted === false && " · Pending review"}
                </span>
                <RemoveTargetButton subId={subId} username={t.username} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

function Shell({ email, children }: { email?: string | null; children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <SiteHeader email={email} />
      <main className={styles.main}>
        <Link href="/" className={styles.back}>
          ← All subscriptions
        </Link>
        {children}
      </main>
    </div>
  );
}

const CONNECT_STEPS = [
  { title: "Account received", text: "Your username and password reached our team." },
  { title: "Logging in to Instagram", text: "We sign in from our secure devices. This usually takes a few minutes." },
  { title: "Growth starts", text: "Your first follows and likes go out, and stats appear on this page." },
];

/** État « connexion en cours » : étapes, conseil en cas de vérification Instagram, rafraîchissement auto. */
function ConnectingPanel({ username }: { username: string }) {
  const current = 1;
  return (
    <section className={`${styles.panel} ${styles.connecting}`} aria-labelledby="connecting-title">
      <div className={styles.connectingHead}>
        <span className={styles.eyebrow}>Connection in progress</span>
        <h2 id="connecting-title" className={styles.connectingTitle}>
          We&apos;re logging in to @{username}.
        </h2>
        <p className={styles.lead}>
          Nothing to do on your side for now. You can already set your daily limits and targets below, they
          apply as soon as we&apos;re in.
        </p>
      </div>

      <ol className={styles.connectSteps}>
        {CONNECT_STEPS.map((step, i) => {
          const state = i < current ? "done" : i === current ? "current" : "upcoming";
          return (
            <li key={step.title} className={styles.connectStep} data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <span className={styles.connectMarker} aria-hidden="true">
                {state === "done" ? "✓" : String(i + 1).padStart(2, "0")}
              </span>
              <div className={styles.connectBody}>
                <span className={styles.connectTitle}>
                  {step.title}
                  <span className={styles.srOnly}>
                    {state === "done" ? " (done)" : state === "current" ? " (in progress)" : " (next)"}
                  </span>
                </span>
                <span className={styles.connectText}>{step.text}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className={styles.connectFoot}>
        <p className={styles.connectTip}>
          <strong>Instagram may ask you to confirm it was you.</strong> If you get a login alert, open the app and tap
          &ldquo;This was me&rdquo; so we can finish.
        </p>
        <AutoRefresh />
      </div>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
    </div>
  );
}
