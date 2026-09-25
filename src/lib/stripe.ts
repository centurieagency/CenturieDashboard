import "server-only";

import Stripe from "stripe";

import { env } from "@/lib/env";

/** Client Stripe côté serveur. La version d'API est celle épinglée par le SDK. */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  appInfo: { name: "Centurie Growth" },
});

/** Tous les clients Stripe ayant cet email (Stripe autorise les doublons), du plus récent au plus ancien. */
export async function findCustomersByEmail(email: string): Promise<Stripe.Customer[]> {
  const emails = [...new Set([email, email.toLowerCase()])];
  const lists = await Promise.all(
    emails.map((e) => stripe.customers.list({ email: e, limit: 100 }).autoPagingToArray({ limit: 1000 })),
  );
  const byId = new Map(lists.flat().map((c) => [c.id, c]));
  return [...byId.values()].sort((a, b) => b.created - a.created);
}

/**
 * Retrouve le client Stripe associé à cet email, ou en crée un s'il n'existe pas.
 * S'il y en a plusieurs, on garde en priorité celui qui a un abonnement en cours,
 * puis celui qui a déjà eu un abonnement, sinon le plus récent.
 */
export async function findOrCreateCustomer({
  email,
  name,
  metadata,
}: {
  email: string;
  name?: string | null;
  /** Utilisé seulement si le client est créé ; un client existant n'est pas modifié. */
  metadata?: Record<string, string>;
}): Promise<string> {
  const customers = await findCustomersByEmail(email);

  if (customers.length === 1) return customers[0]!.id;

  if (customers.length > 1) {
    const subsByCustomer = await Promise.all(
      customers.map((c) => stripe.subscriptions.list({ customer: c.id, status: "all", limit: 20 })),
    );
    const ongoing = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);
    const withOngoing = customers.find((_, i) => subsByCustomer[i]!.data.some((s) => ongoing.has(s.status)));
    const withAny = customers.find((_, i) => subsByCustomer[i]!.data.length > 0);
    return (withOngoing ?? withAny ?? customers[0]!).id;
  }

  const created = await stripe.customers.create(
    { email: email.toLowerCase(), name: name ?? undefined, metadata },
    // Évite de créer deux clients si deux connexions arrivent en même temps.
    { idempotencyKey: `customer-create-${email.toLowerCase()}` },
  );
  return created.id;
}

export type SubscriptionLine = {
  productName: string;
  amount: number | null;
  currency: string;
  interval: Stripe.Price.Recurring.Interval | null;
  intervalCount: number;
  quantity: number;
  currentPeriodEnd: number;
};

export type CustomerSubscription = {
  id: string;
  status: Stripe.Subscription.Status;
  startDate: number;
  cancelAt: number | null;
  endedAt: number | null;
  trialEnd: number | null;
  lines: SubscriptionLine[];
};

const STATUS_ORDER: Record<string, number> = {
  active: 0,
  trialing: 1,
  past_due: 2,
  unpaid: 3,
  paused: 4,
  incomplete: 5,
  canceled: 6,
  incomplete_expired: 7,
};

/** Tous les abonnements d'un client (tous statuts), en cours d'abord, avec le nom de chaque produit. */
export async function listSubscriptions(customerId: string): Promise<CustomerSubscription[]> {
  const subscriptions = await stripe.subscriptions
    .list({ customer: customerId, status: "all", limit: 100 })
    .autoPagingToArray({ limit: 1000 });
  subscriptions.sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99) || b.created - a.created,
  );

  const productIds = [
    ...new Set(
      subscriptions.flatMap((sub) =>
        sub.items.data.map((item) =>
          typeof item.price.product === "string" ? item.price.product : item.price.product.id,
        ),
      ),
    ),
  ];
  const products = productIds.length
    ? await stripe.products.list({ ids: productIds, limit: 100 })
    : { data: [] as Stripe.Product[] };
  const productNames = new Map(products.data.map((p) => [p.id, p.name]));

  return subscriptions.map((sub) => ({
    id: sub.id,
    status: sub.status,
    startDate: sub.start_date,
    cancelAt: sub.cancel_at,
    endedAt: sub.ended_at,
    trialEnd: sub.trial_end,
    lines: sub.items.data.map((item) => {
      const productId = typeof item.price.product === "string" ? item.price.product : item.price.product.id;
      return {
        productName: productNames.get(productId) ?? item.price.nickname ?? "Subscription",
        amount: item.price.unit_amount,
        currency: item.price.currency,
        interval: item.price.recurring?.interval ?? null,
        intervalCount: item.price.recurring?.interval_count ?? 1,
        quantity: item.quantity ?? 1,
        currentPeriodEnd: item.current_period_end,
      };
    }),
  }));
}
