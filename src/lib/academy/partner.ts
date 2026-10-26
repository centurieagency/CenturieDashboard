import "server-only";

import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import { salesPaymentLinks, type User } from "@/db/schema";
import type { PlanId } from "@/lib/plans";
import { stripe } from "@/lib/stripe";
import { accreditationOf } from "./academy";

/**
 * Espace partenaire : liens de paiement personnels et commissions.
 * Un client est rattaché à un apporteur par `sales_rep_id` dans les métadonnées de son abonnement Stripe
 * (posé par le lien de paiement personnel). Les commissions se calculent sur les factures réellement payées.
 */

const TERMS = "https://www.centuriegrowth.com/terms.html";
const PLAN_ORDER: PlanId[] = ["essential", "growth", "signature"];
export const PLAN_LABEL: Record<PlanId, string> = { essential: "Essential", growth: "Growth", signature: "Signature" };

/** Commission par mois payé, en cents USD : mois 1 à 3, puis mois 4 à 12. Rien après le 12e mois. */
export const COMMISSION_CENTS: Record<PlanId, { early: number; later: number }> = {
  essential: { early: 17_100, later: 8_600 },
  growth: { early: 27_300, later: 13_700 },
  signature: { early: 37_500, later: 18_700 },
};
export const COMMISSION_MONTHS = 12;

export const commissionFor = (plan: PlanId, monthIndex: number) =>
  monthIndex <= 3 ? COMMISSION_CENTS[plan].early : monthIndex <= COMMISSION_MONTHS ? COMMISSION_CENTS[plan].later : 0;

// ---------- Pages de paiement (Stripe Checkout, en dollars uniquement) ----------

/**
 * Crée une page de paiement Stripe Checkout pour une offre. Contrairement aux Payment Links (conversion
 * de devise imposée par Stripe), Checkout permet de couper la conversion : le prix reste en dollars pour tous.
 * `rep` : apporteur accrédité à qui rattacher le client (métadonnées de l'abonnement).
 */
export async function createCheckoutUrl(plan: PlanId, origin: string, rep?: Pick<User, "id" | "email">) {
  const price = await priceFor(plan);
  const meta = {
    centurie_plan: plan,
    commitment_months: "12",
    ...(rep ? { sales_rep_id: rep.id, sales_rep_email: rep.email } : {}),
  };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    adaptive_pricing: { enabled: false },
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      terms_of_service_acceptance: {
        message: `I agree to the [Terms of Service](${TERMS}), including the firm 12-month commitment for this Instagram account.`,
      },
      submit: { message: "One subscription covers one Instagram account, with a firm 12-month commitment." },
    },
    custom_fields: [
      {
        key: "instagram_username",
        label: { type: "custom", custom: "Instagram account to grow (@username)" },
        type: "text",
        text: { minimum_length: 2, maximum_length: 40 },
      },
    ],
    subscription_data: {
      description: `Centurie Growth ${PLAN_LABEL[plan]}: firm 12-month commitment per Instagram account. Terms: ${TERMS}`,
      metadata: meta,
    },
    metadata: meta,
    allow_promotion_codes: false,
    success_url: `${origin}/pay/success`,
    cancel_url: "https://www.centuriegrowth.com/#plans",
  });
  if (!session.url) throw new Error("Stripe Checkout returned no URL");
  return session.url;
}

// ---------- Liens de paiement ----------

export type RepLink = { plan: PlanId; url: string };

async function priceFor(plan: PlanId) {
  const [price] = (await stripe.prices.list({ lookup_keys: [`centurie_${plan}_monthly_usd`], limit: 1 })).data;
  if (!price) throw new Error(`Missing Stripe price for ${plan}`);
  return price;
}

/**
 * Liens personnels d'un apporteur accrédité : pages de paiement du dashboard, en dollars, qui portent son identifiant.
 * Sans accréditation valable : rien n'est renvoyé, et la page de paiement refuse le lien (voir app/pay).
 */
export async function repLinks(user: User, origin: string): Promise<RepLink[] | null> {
  if ((await accreditationOf(user.id)).status !== "valid") {
    // Anciens liens Stripe (Payment Links) éventuels : coupés aussi.
    await deactivateRepLinks(user.id);
    return null;
  }
  return PLAN_ORDER.map((plan) => ({ plan, url: `${origin}/pay/${plan}?rep=${user.id}` }));
}

/** Coupe les liens d'un apporteur (accréditation retirée ou expirée) : plus aucun nouveau client possible. */
export async function deactivateRepLinks(userId: string) {
  const rows = await db
    .select()
    .from(salesPaymentLinks)
    .where(and(eq(salesPaymentLinks.userId, userId), eq(salesPaymentLinks.active, true)));
  for (const row of rows) {
    await stripe.paymentLinks.update(row.stripeLinkId, { active: false });
    await db.update(salesPaymentLinks).set({ active: false }).where(and(eq(salesPaymentLinks.userId, userId), eq(salesPaymentLinks.plan, row.plan)));
  }
}

// ---------- Clients et commissions ----------

export type RepClient = {
  subId: string;
  plan: PlanId;
  status: Stripe.Subscription.Status;
  customer: string;
  instagram: string | null;
  startedAt: Date;
  paidMonths: number;
  earnedCents: number;
  /** Commission encore à venir si le client va au bout des 12 mois. */
  remainingCents: number;
};

export type RepSales = {
  clients: RepClient[];
  /** Commissions par mois de paiement (AAAA-MM), du plus récent au plus ancien. */
  months: { month: string; cents: number }[];
  totalCents: number;
};

const planOf = (sub: Stripe.Subscription): PlanId | null => {
  const p = sub.metadata?.centurie_plan;
  return p === "essential" || p === "growth" || p === "signature" ? p : null;
};

async function instagramOf(subId: string) {
  try {
    const [session] = (await stripe.checkout.sessions.list({ subscription: subId, limit: 1 })).data;
    return session?.custom_fields?.find((f) => f.key === "instagram_username")?.text?.value?.replace(/^@/, "") ?? null;
  } catch {
    return null;
  }
}

export async function repSales(repId: string): Promise<RepSales> {
  if (!/^[0-9a-f-]{36}$/.test(repId)) throw new Error("Invalid rep id");
  const subs = await stripe.subscriptions.search({
    query: `metadata['sales_rep_id']:'${repId}'`,
    limit: 100,
    expand: ["data.customer"],
  });

  const byMonth = new Map<string, number>();
  const clients = await Promise.all(
    subs.data.map(async (sub): Promise<RepClient | null> => {
      const plan = planOf(sub);
      if (!plan) return null;
      const [invoices, instagram] = await Promise.all([
        stripe.invoices.list({ subscription: sub.id, status: "paid", limit: 100 }),
        instagramOf(sub.id),
      ]);
      const paid = invoices.data
        .filter((i) => (i.amount_paid ?? 0) > 0)
        .sort((a, b) => (a.status_transitions?.paid_at ?? a.created) - (b.status_transitions?.paid_at ?? b.created));
      let earned = 0;
      paid.forEach((inv, i) => {
        const cents = commissionFor(plan, i + 1);
        if (!cents) return;
        earned += cents;
        const month = new Date((inv.status_transitions?.paid_at ?? inv.created) * 1000).toISOString().slice(0, 7);
        byMonth.set(month, (byMonth.get(month) ?? 0) + cents);
      });
      let remaining = 0;
      for (let m = paid.length + 1; m <= COMMISSION_MONTHS; m++) remaining += commissionFor(plan, m);
      const customer = typeof sub.customer === "object" && !("deleted" in sub.customer && sub.customer.deleted)
        ? (sub.customer as Stripe.Customer).name || (sub.customer as Stripe.Customer).email || "Client"
        : "Client";
      return {
        subId: sub.id,
        plan,
        status: sub.status,
        customer,
        instagram,
        startedAt: new Date(sub.start_date * 1000),
        paidMonths: paid.length,
        earnedCents: earned,
        remainingCents: sub.status === "active" || sub.status === "past_due" ? remaining : 0,
      };
    }),
  );

  const list = clients.filter((c): c is RepClient => c !== null).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, cents]) => ({ month, cents }));
  return { clients: list, months, totalCents: list.reduce((s, c) => s + c.earnedCents, 0) };
}
