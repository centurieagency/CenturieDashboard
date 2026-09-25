import Image from "next/image";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { accountStatus } from "@/lib/account-status";
import {
  getInstagramProfile,
  listAccounts,
  profilePictureUrl,
  type AccountSummary,
  type InstagramProfile,
} from "@/lib/centurie-api";
import { requireCustomer } from "@/lib/customer";
import { listSubscriptions, type CustomerSubscription, type SubscriptionLine } from "@/lib/stripe";
import styles from "./page.module.css";
import { UrgentPassword } from "./urgent-password";

const ZERO_DECIMAL = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);

function formatAmount(amount: number, currency: string): string {
  const value = ZERO_DECIMAL.has(currency) ? amount : amount / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

const INTERVAL_SHORT: Record<string, string> = { day: "day", week: "wk", month: "mo", year: "yr" };

function formatInterval(line: SubscriptionLine): string {
  if (!line.interval) return "";
  if (line.intervalCount === 1) return `/${INTERVAL_SHORT[line.interval] ?? line.interval}`;
  return ` every ${line.intervalCount} ${line.interval}s`;
}

function formatDate(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(unixSeconds * 1000),
  );
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Past due",
  unpaid: "Unpaid",
  paused: "Paused",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  canceled: "Canceled",
};

const ONGOING = new Set(["active", "trialing", "past_due"]);

/** Dernière ligne de la carte : fin effective, fin programmée ou prochain renouvellement. */
function endRow(sub: CustomerSubscription): { label: string; date: number } | null {
  if (sub.endedAt) return { label: "Ended", date: sub.endedAt };
  if (sub.cancelAt) return { label: "Ends", date: sub.cancelAt };
  if (sub.status === "trialing" && sub.trialEnd) return { label: "Trial ends", date: sub.trialEnd };
  if (ONGOING.has(sub.status) && sub.lines[0]) return { label: "Renews", date: sub.lines[0].currentPeriodEnd };
  return null;
}

async function loadSubscriptions(
  customerId: string,
): Promise<{ ok: true; data: CustomerSubscription[] } | { ok: false }> {
  try {
    return { ok: true, data: await listSubscriptions(customerId) };
  } catch (error) {
    console.error("Stripe subscriptions lookup failed", error);
    return { ok: false };
  }
}

type LinkedAccount = { account: AccountSummary; profile: InstagramProfile | null };

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Bas de carte : compte Instagram lié à l'abonnement, avec l'accès à sa gestion. */
function InstagramRow({ subId, linked, apiDown }: { subId: string; linked: LinkedAccount | undefined; apiDown: boolean }) {
  const account = linked?.account;
  const profile = linked?.profile;
  // L'API ne connaît que les abonnements utilisables (actifs, en essai, en retard de paiement).
  if (!account) {
    return apiDown ? (
      <p className={styles.instagramNote}>Instagram account unavailable right now.</p>
    ) : null;
  }

  const status = accountStatus(account.current_status);
  const connecting = account.current_status === "pending" || account.current_status === "waiting_for_connect";
  const href = `/accounts/${subId}`;

  if (!account.username) {
    return (
      <div className={styles.instagram}>
        <span className={styles.instagramLabel}>Instagram</span>
        <p className={styles.instagramNote}>No account connected yet.</p>
        <Link href={href} className={styles.cardButtonPrimary}>
          Connect Instagram
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.instagram}>
      <span className={styles.instagramLabel}>Instagram</span>
      <div className={styles.profile}>
        <Image
          src={profilePictureUrl(account.username)}
          alt={`Profile picture of @${account.username}`}
          width={52}
          height={52}
          className={styles.avatar}
        />
        <div className={styles.profileText}>
          {profile?.full_name && <span className={styles.fullName}>{profile.full_name}</span>}
          <span className={styles.handle}>
            @{account.username}
            {profile?.is_verified && <span className={styles.verified}> · Verified</span>}
          </span>
        </div>
      </div>
      {profile && (
        <dl className={styles.igStats}>
          <div>
            <dt>Followers</dt>
            <dd>{profile.follower_count != null ? compact.format(profile.follower_count) : "–"}</dd>
          </div>
          <div>
            <dt>Following</dt>
            <dd>{profile.following_count != null ? compact.format(profile.following_count) : "–"}</dd>
          </div>
          <div>
            <dt>Posts</dt>
            <dd>{profile.media_count != null ? compact.format(profile.media_count) : "–"}</dd>
          </div>
        </dl>
      )}
      {profile?.biography && <p className={styles.bio}>{profile.biography}</p>}
      <span className={connecting ? styles.dotPending : status.ok ? styles.dotOk : styles.dotWarn}>
        {account.is_active === false && status.ok && !connecting ? "Paused" : status.label}
      </span>
      <Link href={href} className={styles.cardButton}>
        Manage account
      </Link>
    </div>
  );
}

/**
 * Comptes Instagram par sub_id, avec leur profil public. Non bloquant : sans l'API, les cartes
 * s'affichent sans la partie Instagram ; sans profil, seulement le @ et le statut.
 */
async function loadAccounts(apiToken: string | undefined): Promise<Map<string, LinkedAccount> | null> {
  if (!apiToken) return null;
  try {
    const accounts = await listAccounts(apiToken);
    const profiles = await Promise.all(
      accounts.map((a) =>
        a.username
          ? getInstagramProfile(apiToken, a.username).catch((error: unknown) => {
              console.error("Instagram profile lookup failed", error);
              return null;
            })
          : null,
      ),
    );
    return new Map(accounts.map((account, i) => [account.sub_id, { account, profile: profiles[i] ?? null }]));
  } catch (error) {
    console.error("Centurie API accounts lookup failed", error);
    return null;
  }
}

export default async function HomePage() {
  const { user, customerId, apiToken } = await requireCustomer("/");
  const [subscriptions, accounts] = customerId
    ? await Promise.all([loadSubscriptions(customerId), loadAccounts(apiToken)])
    : [{ ok: false as const }, null];
  const wrongPassword = [...(accounts?.values() ?? [])]
    .map((l) => l.account)
    .filter((a) => a.current_status === "wrong_password" && a.username);

  return (
    <div className={styles.page}>
      <SiteHeader email={user.email ?? user.name} />

      <main className={styles.main}>
        <div className={styles.head}>
          <span className={styles.eyebrow}>Client space</span>
          <h1 className={styles.title}>Your subscriptions</h1>
          <dl className={styles.meta}>
            <dt>Customer ID</dt>
            <dd>
              <code className={styles.code}>{customerId ?? "Not available"}</code>
            </dd>
          </dl>
        </div>

        {/* Urgent : Instagram refuse le mot de passe, la croissance est à l'arrêt. */}
        {wrongPassword.length > 0 && (
          <div className={styles.urgentList}>
            {wrongPassword.map((a) => (
              <UrgentPassword key={a.sub_id} subId={a.sub_id} username={a.username!} />
            ))}
          </div>
        )}

        {!subscriptions.ok ? (
          <p role="alert" className={styles.notice}>
            We couldn&apos;t load your subscriptions right now. Please refresh the page in a moment.
          </p>
        ) : subscriptions.data.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>No subscription yet</h2>
            <p className={styles.emptyText}>
              When you start working with us, your plan will show up here.
            </p>
          </div>
        ) : (
          <ul className={styles.grid}>
            {subscriptions.data.map((sub) => {
              const end = endRow(sub);
              return (
                <li key={sub.id} className={`${styles.card} ${ONGOING.has(sub.status) ? "" : styles.cardInactive}`}>
                  <div className={styles.cardTop}>
                    <span className={sub.status === "active" ? styles.status : styles.statusMuted}>
                      {STATUS_LABELS[sub.status] ?? sub.status}
                    </span>
                    <code className={styles.subId}>{sub.id}</code>
                  </div>
                  {sub.lines.map((line, i) => (
                    <div key={i} className={styles.line}>
                      <h2 className={styles.planName}>
                        {line.productName}
                        {line.quantity > 1 && <span className={styles.quantity}> × {line.quantity}</span>}
                      </h2>
                      {line.amount !== null && (
                        <p className={styles.price}>
                          {formatAmount(line.amount, line.currency)}
                          <span className={styles.unit}>{formatInterval(line)}</span>
                        </p>
                      )}
                    </div>
                  ))}
                  <dl className={styles.details}>
                    <div>
                      <dt>Started</dt>
                      <dd>{formatDate(sub.startDate)}</dd>
                    </div>
                    {end && (
                      <div>
                        <dt>{end.label}</dt>
                        <dd>{formatDate(end.date)}</dd>
                      </div>
                    )}
                  </dl>
                  <InstagramRow subId={sub.id} linked={accounts?.get(sub.id)} apiDown={accounts === null} />
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
