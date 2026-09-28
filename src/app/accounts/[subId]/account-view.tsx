import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { StatusBadge } from "@/components/status-badge";
import { accountStatus, displayStatus } from "@/lib/account-status";
import {
  CenturieApiError,
  getConfig,
  getFollowbacks,
  getFollowersGained,
  getGains,
  getInstagramProfile,
  getProfileStats,
  getProspectsTotal,
  getStats,
  getTargets,
  listAccounts,
  profilePictureUrl,
  type AccountConfig,
  type AccountSummary,
} from "@/lib/centurie-api";
import type { SubscriptionCustomer } from "@/lib/stripe";
import styles from "./account.module.css";
import { Analytics, PERIODS, type Period } from "./analytics";
import {
  ActiveToggle,
  AddTargetForm,
  AutoRefresh,
  BackupCodesForm,
  ConfigForm,
  ConnectForm,
  DeleteAccountForm,
  PasswordForm,
  RemoveTargetButton,
  TotpKeyForm,
} from "./forms";

const number = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function settled<T>(result: PromiseSettledResult<T>): T | null {
  if (result.status === "fulfilled") return result.value;
  console.error("Centurie API read failed", result.reason);
  return null;
}

export function parsePeriod(value: string | undefined): Period {
  const n = Number(value);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30;
}

export const isSubId = (value: string) => /^sub_[A-Za-z0-9]+$/.test(value);

/**
 * Page d'un compte Instagram : statut, statistiques, limites, cibles, identifiants.
 * Partagée entre l'espace client (`basePath` "") et l'espace admin (`basePath` "/admin").
 * `token` (client `cbk_`/`b64_` ou admin) reste côté serveur : il n'est jamais passé aux composants client.
 */
export async function AccountView({
  subId,
  days,
  token,
  basePath,
  email,
  customer,
}: {
  subId: string;
  days: Period;
  token: string;
  basePath: "" | "/admin";
  email?: string | null;
  /** Espace admin : client propriétaire de l'abonnement. */
  customer?: SubscriptionCustomer | null;
}) {
  const admin = basePath === "/admin";
  // Les clients voient tout mais ne modifient rien : seul l'admin a les formulaires (et les actions le vérifient).
  const readOnly = !admin;
  const shell = (children: React.ReactNode) => (
    <Shell email={email} admin={admin} backHref={basePath || "/"}>
      {customer !== undefined && <CustomerBar customer={customer} />}
      {children}
    </Shell>
  );

  let summary: AccountSummary | undefined;
  try {
    summary = (await listAccounts(token)).find((a) => a.sub_id === subId);
  } catch (error) {
    console.error("Centurie API accounts lookup failed", error);
    return shell(
      <p role="alert" className={styles.error}>
        We couldn&apos;t reach this Instagram account right now. Please refresh the page in a moment.
      </p>,
    );
  }
  // Abonnement inconnu, hors périmètre ou non utilisable (annulé…).
  if (!summary) notFound();

  if (!summary.username) {
    return shell(
      <>
        <div className={styles.head}>
          <span className={styles.eyebrow}>Instagram account</span>
          <h1 className={styles.title}>{admin ? "Connect an Instagram account" : "No Instagram account yet"}</h1>
          <p className={styles.lead}>
            {admin
              ? "Link the account to grow on this subscription. We log in and start within a day."
              : "Your account manager will connect your Instagram account to this subscription. It will show up here once it's done."}
          </p>
          <code className={styles.subId}>{subId}</code>
        </div>
        {admin && (
          <>
            <section className={`${styles.panel} ${styles.narrow}`}>
              <ConnectForm subId={subId} />
            </section>
            <DangerZone subId={subId} username={null} />
          </>
        )}
      </>,
    );
  }

  const username = summary.username;
  const [profileR, configR, targetsR, statsR, gainsR, profileStatsR, followersR, followbacksR, prospectsR] =
    await Promise.allSettled([
      getInstagramProfile(token, username),
      getConfig(token, subId),
      getTargets(token, subId),
      getStats(token, subId, days),
      getGains(token, subId, days),
      getProfileStats(token, subId, days),
      getFollowersGained(token, subId, days),
      getFollowbacks(token, subId, days),
      getProspectsTotal(token, subId, days),
    ]);
  const profile = settled(profileR);
  // Pas encore de configuration (compte tout juste connecté) : on part des valeurs par défaut, le PUT la créera.
  const config =
    configR.status === "rejected" && configR.reason instanceof CenturieApiError && configR.reason.status === 404
      ? ({} as Partial<AccountConfig>)
      : settled(configR);
  const targets = settled(targetsR);

  const status = accountStatus(summary.current_status);
  const shown = displayStatus(summary);
  const needsPassword = summary.current_status === "wrong_password";
  const needs2FA = summary.current_status === "wrong_2fa";
  const isConnecting = summary.current_status === "pending" || summary.current_status === "waiting_for_connect";
  const isActive = summary.is_active !== false;
  const expert = summary.expert === true;

  return shell(
    <>
      <div className={styles.headRow}>
        <div className={styles.identity}>
          <Image
            src={profilePictureUrl(username)}
            alt={`Profile picture of @${username}`}
            width={88}
            height={88}
            className={styles.avatar}
            priority
          />
          <div className={styles.head}>
            <span className={styles.eyebrow}>Instagram account</span>
            <h1 className={styles.title}>
              @{username}
              {profile?.is_verified && <span className={styles.verified}>Verified</span>}
            </h1>
            <div className={styles.metaRow}>
              {profile?.full_name && <span>{profile.full_name}</span>}
              {profile?.follower_count != null && (
                <span>
                  {compact.format(profile.follower_count)} followers ·{" "}
                  {compact.format(profile.following_count ?? 0)} following · {number.format(profile.media_count ?? 0)}{" "}
                  posts
                </span>
              )}
              <StatusBadge tone={shown.tone} label={shown.label} />
              <span>{expert ? "Expert mode" : "Normal mode"}</span>
              <code className={styles.subId}>{subId}</code>
            </div>
            {profile?.biography && <p className={styles.bio}>{profile.biography}</p>}
          </div>
        </div>
        {admin && !isConnecting && <ActiveToggle subId={subId} isActive={isActive} />}
      </div>

      {(status.tone === "warn" || status.tone === "danger") && (readOnly ? status.clientHelp : status.help) && (
        <p
          role="alert"
          className={`${styles.notice} ${status.tone === "danger" ? styles.noticeDanger : styles.noticeWarn}`}
        >
          <StatusBadge tone={status.tone} label={`${status.label}.`} /> {readOnly ? status.clientHelp : status.help}
        </p>
      )}

      {isConnecting ? (
        <ConnectingPanel username={username} readOnly={readOnly} />
      ) : (
        <Analytics
          href={`${basePath}/accounts/${subId}`}
          days={days}
          data={{
            followerCount: profile?.follower_count ?? null,
            stats: settled(statsR),
            gains: settled(gainsR),
            profileStats: settled(profileStatsR),
            followers: settled(followersR),
            followbacks: settled(followbacksR),
            prospects: settled(prospectsR),
          }}
        />
      )}

      <div className={admin && (needsPassword || needs2FA) ? styles.columns : undefined}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Daily limits</h2>
          </div>
          {config && readOnly ? (
            <ReadOnlyLimits config={config} />
          ) : config ? (
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
        {admin && (needsPassword || needs2FA) && (
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
          We reach people who follow these accounts{admin ? ". Pick accounts whose audience looks like the client's customers." : "."}
        </p>
        {admin && <AddTargetForm subId={subId} />}
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
                {admin && <RemoveTargetButton subId={subId} username={t.username} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {admin && <DangerZone subId={subId} username={username} />}
    </>,
  );
}

const LIMIT_ROWS = [
  { label: "Follows", enabled: "enabled_follow", perDay: "per_day_follow" },
  { label: "Post likes", enabled: "enabled_post_like", perDay: "per_day_like_post" },
  { label: "Story likes", enabled: "enabled_like_story", perDay: "per_day_like_story" },
] as const;

/** Espace client : limites quotidiennes en lecture seule. */
function ReadOnlyLimits({ config }: { config: Partial<AccountConfig> }) {
  return (
    <dl className={styles.readList}>
      {LIMIT_ROWS.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{config[row.enabled] === false ? "Off" : `${number.format(config[row.perDay] ?? 0)} per day`}</dd>
        </div>
      ))}
      <div>
        <dt>Warmup</dt>
        <dd>{config.enabled_warmup ? "On" : "Off"}</dd>
      </div>
    </dl>
  );
}

/** Espace admin : suppression définitive du compte et résiliation de l'abonnement Stripe. */
function DangerZone({ subId, username }: { subId: string; username: string | null }) {
  return (
    <section className={`${styles.panel} ${styles.dangerPanel}`} aria-labelledby="danger-title">
      <div className={styles.panelHead}>
        <h2 id="danger-title" className={styles.panelTitle}>
          Delete account
        </h2>
      </div>
      <ul className={styles.dangerList}>
        <li>
          The Stripe subscription <code className={styles.confirmCode}>{subId}</code> is cancelled immediately, without
          proration. Billing stops.
        </li>
        {username && <li>The Instagram account @{username} is deleted from Centurie, with its settings and targets.</li>}
        <li>This can&apos;t be undone.</li>
      </ul>
      <DeleteAccountForm subId={subId} username={username} />
    </section>
  );
}

function Shell({
  email,
  admin,
  backHref,
  children,
}: {
  email?: string | null;
  admin: boolean;
  backHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page}>
      <SiteHeader email={email} admin={admin} />
      <main className={styles.main}>
        <Link href={backHref} className={styles.back}>
          ← All subscriptions
        </Link>
        {children}
      </main>
    </div>
  );
}

/** Espace admin : à qui appartient ce compte. */
function CustomerBar({ customer }: { customer: SubscriptionCustomer | null }) {
  return (
    <div className={styles.customerBar}>
      <span className={styles.customerLabel}>Client</span>
      {customer?.email ? (
        <a href={`mailto:${customer.email}`} className={styles.customerEmail}>
          {customer.email}
        </a>
      ) : (
        <span className={styles.customerEmail}>{customer ? "No email on file" : "Unknown client"}</span>
      )}
      {customer?.name && <span className={styles.customerMeta}>{customer.name}</span>}
      {customer && <code className={styles.subId}>{customer.id}</code>}
    </div>
  );
}

const CONNECT_STEPS = [
  { title: "Account received", text: "Your username and password reached our team." },
  { title: "Logging in to Instagram", text: "We sign in from our secure devices. This usually takes a few minutes." },
  { title: "Growth starts", text: "Your first follows and likes go out, and stats appear on this page." },
];

/** État « connexion en cours » : étapes, conseil en cas de vérification Instagram, rafraîchissement auto. */
function ConnectingPanel({ username, readOnly }: { username: string; readOnly: boolean }) {
  const current = 1;
  return (
    <section className={`${styles.panel} ${styles.connecting}`} aria-labelledby="connecting-title">
      <div className={styles.connectingHead}>
        <span className={styles.eyebrow}>Connection in progress</span>
        <h2 id="connecting-title" className={styles.connectingTitle}>
          We&apos;re logging in to @{username}.
        </h2>
        <p className={styles.lead}>
          {readOnly
            ? "Nothing to do on your side for now. Your stats appear here as soon as we're in."
            : "Daily limits and targets below apply as soon as we're in."}
        </p>
      </div>

      <ol className={styles.connectSteps}>
        {CONNECT_STEPS.map((step, i) => {
          const state = i < current ? "done" : i === current ? "current" : "upcoming";
          return (
            <li
              key={step.title}
              className={styles.connectStep}
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
            >
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
