import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { StatusBadge } from "@/components/status-badge";
import { accountStatus, displayStatus, hasAccountError } from "@/lib/account-status";
import { profilePictureUrl, type AccountSummary } from "@/lib/centurie-api";
import type { AccountsBySub, LinkedAccount, SubscriptionsResult } from "@/lib/dashboard-data";
import type { CustomerSubscription, SubscriptionLine } from "@/lib/stripe";
import { CardDelete } from "./card-delete";
import { SubscriptionFilters } from "./subscription-filters";
import styles from "./subscriptions.module.css";

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
const ENDED = new Set(["canceled", "incomplete_expired"]);

/** Dernière ligne de la carte : fin effective, fin programmée ou prochain renouvellement. */
function endRow(sub: CustomerSubscription): { label: string; date: number } | null {
  if (sub.endedAt) return { label: "Ended", date: sub.endedAt };
  if (sub.cancelAt) return { label: "Ends", date: sub.cancelAt };
  if (sub.status === "trialing" && sub.trialEnd) return { label: "Trial ends", date: sub.trialEnd };
  if (ONGOING.has(sub.status) && sub.lines[0]) return { label: "Renews", date: sub.lines[0].currentPeriodEnd };
  return null;
}

// Filtres de la liste (valeurs portées par l'URL : ?sub=…&account=…&q=…)
const SUB_FILTERS = {
  all: { label: "All", match: () => true },
  active: { label: "Active", match: (s: CustomerSubscription) => s.status === "active" || s.status === "past_due" },
  trial: { label: "Trial", match: (s: CustomerSubscription) => s.status === "trialing" },
  ended: { label: "Ended", match: (s: CustomerSubscription) => ENDED.has(s.status) },
} as const;

const ACCOUNT_FILTERS = {
  all: { label: "All", match: () => true },
  connected: { label: "Connected", match: (a: AccountSummary | undefined) => a?.current_status === "connected" },
  error: { label: "With an error", match: (a: AccountSummary | undefined) => !!a && hasAccountError(a) },
} as const;

type SubFilter = keyof typeof SUB_FILTERS;
type AccountFilter = keyof typeof ACCOUNT_FILTERS;

const pick = <T extends string>(value: string | undefined, allowed: Record<T, unknown>, fallback: T): T =>
  value && value in allowed ? (value as T) : fallback;

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export type ListParams = { sub?: string; account?: string; q?: string };

/**
 * Liste d'abonnements avec leurs comptes Instagram : alertes, filtres, cartes.
 * Partagée entre l'espace client (`basePath` "") et l'espace admin (`basePath` "/admin", avec le client de chaque abonnement).
 */
export function SubscriptionsView({
  subscriptions,
  accounts,
  params,
  basePath,
  showCustomer = false,
  filters = true,
  readOnly = false,
  notice,
  head,
}: {
  subscriptions: SubscriptionsResult;
  accounts: AccountsBySub | null;
  params: ListParams;
  basePath: "" | "/admin";
  showCustomer?: boolean;
  /** Barre de recherche et filtres (espace admin). */
  filters?: boolean;
  /** Espace client : on consulte, on ne corrige pas (les actions sont réservées à l'admin). */
  readOnly?: boolean;
  /** Message affiché sous l'en-tête (ex. confirmation de suppression). */
  notice?: string;
  head: React.ReactNode;
}) {
  const subFilter = filters ? pick<SubFilter>(params.sub, SUB_FILTERS, "all") : "all";
  const accountFilter = filters ? pick<AccountFilter>(params.account, ACCOUNT_FILTERS, "all") : "all";
  const query = filters ? (params.q ?? "").trim().slice(0, 100) : "";
  const accountHref = (subId: string) => `${basePath}/accounts/${subId}`;

  const all = subscriptions.ok ? subscriptions.data : [];
  const customerBySub = new Map(all.map((s) => [s.id, s.customer]));
  const accountOf = (s: CustomerSubscription) => accounts?.get(s.id)?.account;
  const matchesQuery = (s: CustomerSubscription) => {
    if (!query) return true;
    const q = query.toLowerCase().replace(/^@/, "");
    const linked = accounts?.get(s.id);
    return [
      s.id,
      ...s.lines.map((l) => l.productName),
      linked?.account.username,
      linked?.profile?.full_name,
      s.customer?.email,
      s.customer?.name,
      s.customer?.id,
    ]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(q));
  };
  const visible = all.filter(
    (s) => SUB_FILTERS[subFilter].match(s) && ACCOUNT_FILTERS[accountFilter].match(accountOf(s)) && matchesQuery(s),
  );
  const subOptions = (Object.keys(SUB_FILTERS) as SubFilter[]).map((k) => ({
    value: k,
    label: SUB_FILTERS[k].label,
    count: all.filter((s) => SUB_FILTERS[k].match(s)).length,
  }));
  const accountOptions = (Object.keys(ACCOUNT_FILTERS) as AccountFilter[]).map((k) => ({
    value: k,
    label: ACCOUNT_FILTERS[k].label,
    count: all.filter((s) => ACCOUNT_FILTERS[k].match(accountOf(s))).length,
  }));
  const alerts = [...(accounts?.values() ?? [])].map((l) => l.account).filter((a) => a.username && hasAccountError(a));

  return (
    <main className={styles.main}>
      {head}

      {notice && (
        <p role="status" className={styles.success}>
          {notice}
        </p>
      )}

      {/* Comptes qui demandent une action : un bandeau compact par compte, avec accès direct. */}
      {alerts.length > 0 && (
        <ul className={styles.alerts} aria-label="Accounts that need attention">
          {alerts.map((a) => (
            <AccountAlert
              key={a.sub_id}
              account={a}
              href={accountHref(a.sub_id)}
              customerEmail={showCustomer ? customerBySub.get(a.sub_id)?.email : undefined}
              readOnly={readOnly}
            />
          ))}
        </ul>
      )}

      {!subscriptions.ok ? (
        <p role="alert" className={styles.notice}>
          We couldn&apos;t load the subscriptions right now. Please refresh the page in a moment.
        </p>
      ) : all.length === 0 ? (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>No subscription yet</h2>
          <p className={styles.emptyText}>When you start working with us, your plan will show up here.</p>
        </div>
      ) : (
        <>
          {filters && (
            <Suspense>
              <SubscriptionFilters
                subscription={{ value: subFilter, options: subOptions }}
                account={{ value: accountFilter, options: accountOptions }}
                query={query}
                placeholder={showCustomer ? "Search client email, @username, plan or ID" : undefined}
              />
            </Suspense>
          )}
          {visible.length === 0 ? (
            <div className={styles.empty}>
              <h2 className={styles.emptyTitle}>No subscription matches</h2>
              <p className={styles.emptyText}>
                Try another filter, or <Link href={basePath || "/"}>show all subscriptions</Link>.
              </p>
            </div>
          ) : (
            <ul className={styles.grid}>
              {visible.map((sub) => {
                const end = endRow(sub);
                return (
                  <li key={sub.id} className={`${styles.card} ${ONGOING.has(sub.status) ? "" : styles.cardInactive}`}>
                    <div className={styles.cardTop}>
                      <span className={sub.status === "active" ? styles.status : styles.statusMuted}>
                        {STATUS_LABELS[sub.status] ?? sub.status}
                      </span>
                      <code className={styles.subId}>{sub.id}</code>
                    </div>
                    {showCustomer && sub.customer && <CustomerLine customer={sub.customer} />}
                    {sub.lines.map((line, i) => (
                      <div key={i} className={styles.line}>
                        {readOnly && <span className={styles.planLabel}>Plan</span>}
                        <h2 className={styles.planName}>
                          {line.productName}
                          {line.quantity > 1 && <span className={styles.quantity}> × {line.quantity}</span>}
                        </h2>
                        {/* Espace client : pas de prix (nom du produit Stripe seulement), il reste visible côté admin. */}
                        {!readOnly && line.amount !== null && (
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
                    <InstagramRow
                      href={accountHref(sub.id)}
                      linked={accounts?.get(sub.id)}
                      apiDown={accounts === null}
                      ended={ENDED.has(sub.status)}
                      readOnly={readOnly}
                    />
                    {basePath === "/admin" && (
                      <div className={styles.cardDanger}>
                        <CardDelete
                          subId={sub.id}
                          username={accounts?.get(sub.id)?.account.username ?? null}
                          ended={ENDED.has(sub.status)}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

/** Espace admin : à qui appartient l'abonnement. */
function CustomerLine({ customer }: { customer: NonNullable<CustomerSubscription["customer"]> }) {
  return (
    <div className={styles.customer}>
      <span className={styles.customerLabel}>Client</span>
      {customer.email ? (
        <a href={`mailto:${customer.email}`} className={styles.customerEmail}>
          {customer.email}
        </a>
      ) : (
        <span className={styles.customerEmail}>No email on file</span>
      )}
      <span className={styles.customerMeta}>
        {customer.name && `${customer.name} · `}
        <code>{customer.id}</code>
      </span>
    </div>
  );
}

/** Bandeau compact : un compte a un problème, un bouton mène droit à sa page pour le régler. */
function AccountAlert({
  account,
  href,
  customerEmail,
  readOnly,
}: {
  account: AccountSummary;
  href: string;
  customerEmail?: string | null;
  readOnly: boolean;
}) {
  const status = accountStatus(account.current_status);
  return (
    <li className={`${styles.alert} ${status.tone === "danger" ? styles.alertDanger : styles.alertWarn}`}>
      <StatusBadge tone={status.tone} label={status.label} size="sm" />
      <span className={styles.alertText}>
        <strong>@{account.username}</strong>
        {customerEmail && <span className={styles.alertClient}> ({customerEmail})</span>}
        {readOnly
          ? account.current_status === "challenge_required"
            ? " · confirm the login in your Instagram app."
            : " · growth is on hold, our team is on it."
          : account.current_status === "wrong_password"
            ? " · growth is on hold until the password is updated."
            : " · growth is on hold until this is fixed."}
      </span>
      <Link href={href} className={styles.alertButton}>
        {readOnly ? "View" : "Fix it"}
      </Link>
    </li>
  );
}

/** Bas de carte : compte Instagram lié à l'abonnement, avec l'accès à sa gestion. */
function InstagramRow({
  href,
  linked,
  apiDown,
  ended,
  readOnly,
}: {
  href: string;
  linked: LinkedAccount | undefined;
  apiDown: boolean;
  ended: boolean;
  readOnly: boolean;
}) {
  const account = linked?.account;
  const profile = linked?.profile;
  // Abonnement terminé : le compte Instagram n'est plus actif du tout.
  if (ended) {
    return (
      <div className={styles.instagram}>
        <span className={styles.instagramLabel}>Instagram</span>
        <StatusBadge tone="danger" label="No longer active" size="sm" />
      </div>
    );
  }
  // L'API ne connaît que les abonnements utilisables (actifs, en essai, en retard de paiement).
  if (!account) {
    return apiDown ? <p className={styles.instagramNote}>Instagram account unavailable right now.</p> : null;
  }

  const status = displayStatus(account);

  if (!account.username) {
    return (
      <div className={styles.instagram}>
        <span className={styles.instagramLabel}>Instagram</span>
        <p className={styles.instagramNote}>
          {readOnly ? "Your account manager will connect your account soon." : "No account connected yet."}
        </p>
        {!readOnly && (
          <Link href={href} className={styles.cardButtonPrimary}>
            Connect Instagram
          </Link>
        )}
      </div>
    );
  }

  const needsFix = !readOnly && (status.tone === "warn" || status.tone === "danger");
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
      <StatusBadge tone={status.tone} label={status.label} size="sm" />
      <Link href={href} className={needsFix ? styles.cardButtonPrimary : styles.cardButton}>
        {needsFix ? "Fix the problem" : readOnly ? "View account" : "Manage account"}
      </Link>
    </div>
  );
}
