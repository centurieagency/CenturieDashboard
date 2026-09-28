import "server-only";

import { db } from "@/db";
import { hiddenSubscriptions } from "@/db/schema";
import {
  getInstagramProfile,
  listAccounts,
  listAccountsDetailed,
  type AccountSummary,
  type InstagramProfile,
} from "@/lib/centurie-api";
import { listAllSubscriptions, listSubscriptions, type CustomerSubscription } from "@/lib/stripe";

export type LinkedAccount = { account: AccountSummary; profile: InstagramProfile | null };
export type AccountsBySub = Map<string, LinkedAccount>;
export type SubscriptionsResult = { ok: true; data: CustomerSubscription[] } | { ok: false };

/** Abonnements retirés du dashboard par l'admin : masqués dans l'espace admin comme dans l'espace client. */
async function hiddenSubIds(): Promise<Set<string>> {
  const rows = await db.select({ subId: hiddenSubscriptions.subId }).from(hiddenSubscriptions);
  return new Set(rows.map((r) => r.subId));
}

async function safeSubscriptions(load: () => Promise<CustomerSubscription[]>): Promise<SubscriptionsResult> {
  try {
    const [subs, hidden] = await Promise.all([load(), hiddenSubIds()]);
    return { ok: true, data: subs.filter((s) => !hidden.has(s.id)) };
  } catch (error) {
    console.error("Stripe subscriptions lookup failed", error);
    return { ok: false };
  }
}

/** Abonnements d'un client (espace client). */
export const loadCustomerSubscriptions = (customerId: string) => safeSubscriptions(() => listSubscriptions(customerId));

/** Tous les abonnements, avec leur client (espace admin). */
export const loadAllSubscriptions = () => safeSubscriptions(listAllSubscriptions);

/**
 * Espace client : comptes Instagram par sub_id, profil public via GET /instagram/username (endpoint à privilégier).
 * Non bloquant : sans l'API, les cartes s'affichent sans la partie Instagram.
 */
export async function loadCustomerAccounts(token: string | undefined): Promise<AccountsBySub | null> {
  if (!token) return null;
  try {
    const accounts = await listAccounts(token);
    const profiles = await Promise.all(
      accounts.map((a) =>
        a.username
          ? getInstagramProfile(token, a.username).catch((error: unknown) => {
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

/**
 * Espace admin : tous les comptes en UN appel (/accounts/detailed, profil inclus), pour tenir la charge
 * quand il y a beaucoup de clients.
 */
export async function loadAllAccounts(adminToken: string): Promise<AccountsBySub | null> {
  try {
    const accounts = await listAccountsDetailed(adminToken);
    return new Map(
      accounts.map(({ infos, ...account }) => [
        account.sub_id,
        {
          account,
          profile: infos
            ? {
                pk: infos.pk,
                username: infos.username,
                full_name: infos.full_name,
                biography: infos.biography,
                media_count: infos.media_count,
                follower_count: infos.follower_count,
                following_count: infos.following_count,
                is_verified: infos.is_verified,
              }
            : null,
        },
      ]),
    );
  } catch (error) {
    console.error("Centurie API accounts lookup failed", error);
    return null;
  }
}
