import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, gte, lt } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import { accessLinks, loginFailures, users, type User } from "@/db/schema";
import { ADMIN_EMAIL } from "@/lib/admin-email";
import { stripe } from "@/lib/stripe";
import { findUserByEmail } from "@/lib/users";

/**
 * Accès au dashboard client. Un compte n'est relié à un client Stripe que par une preuve :
 * - connexion Google (email vérifié par Google) ;
 * - paiement qui vient d'être fait (session Stripe Checkout, voir claimableCheckout) ;
 * - lien personnel généré par l'admin (createAccessLink).
 * Jamais par un simple email saisi dans un formulaire : l'inscription ne vérifie pas l'adresse.
 */

const HOUR = 3_600_000;
export const ACCESS_LINK_DAYS = 7;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// ---------- Liens personnels (créés par l'admin) ----------

/** Crée (ou retrouve) le compte d'un client Stripe et renvoie un lien à usage unique pour définir son mot de passe. */
export async function createAccessLinkForCustomer(customer: { id: string; email: string | null; name: string | null }) {
  if (!customer.email) return { error: "This Stripe client has no email address." } as const;
  const email = customer.email.toLowerCase();
  if (email === ADMIN_EMAIL) return { error: "This is the admin address." } as const;

  let user = await findUserByEmail(email);
  if (user?.role === "sales") return { error: "This email belongs to a sales partner." } as const;
  if (user?.stripeCustomerId && user.stripeCustomerId !== customer.id) {
    return { error: "This email is already linked to another Stripe client. Check it in Stripe first." } as const;
  }
  if (!user) {
    [user] = await db.insert(users).values({ email, name: customer.name, stripeCustomerId: customer.id }).returning();
  } else if (!user.stripeCustomerId) {
    // L'admin se porte garant : on relie le compte (créé sans vérification) à ce client Stripe.
    await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, user.id));
  }

  const token = randomBytes(24).toString("base64url");
  await db.insert(accessLinks).values({
    tokenHash: hashToken(token),
    userId: user!.id,
    expiresAt: new Date(Date.now() + ACCESS_LINK_DAYS * 24 * HOUR),
  });
  return { token, email } as const;
}

export async function findUsableAccessLink(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const link = await db.query.accessLinks.findFirst({ where: eq(accessLinks.tokenHash, hashToken(token)) });
  if (!link || link.usedAt || link.expiresAt <= new Date()) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, link.userId) });
  return user ? { link, user } : null;
}

export async function consumeAccessLink(linkId: string, userId: string, passwordHash: string, name?: string) {
  await db.update(users).set({ passwordHash, ...(name ? { name } : {}) }).where(eq(users.id, userId));
  await db.update(accessLinks).set({ usedAt: new Date() }).where(eq(accessLinks.id, linkId));
}

// ---------- Après paiement (Stripe Checkout) ----------

export type CheckoutClaim =
  | { status: "invalid" }
  /** Ce client a déjà son compte (même client Stripe) : il n'a qu'à se connecter. */
  | { status: "existing"; email: string }
  /** L'email a déjà un compte relié à un autre client Stripe : l'équipe rattache le nouvel abonnement. */
  | { status: "conflict"; email: string }
  | { status: "claimable"; email: string; name: string | null; customerId: string };

/** Délai pendant lequel la page de confirmation permet de créer son compte. */
const CLAIM_DAYS = 7;

/**
 * Une session Checkout payée prouve qu'on vient de souscrire avec ce client Stripe : elle permet de créer
 * le compte relié, ou d'en reprendre un non relié (créé sans vérification) avec un nouveau mot de passe.
 * Un compte déjà relié à ce client ou à un autre n'est jamais repris.
 */
export async function checkoutClaim(sessionId: string): Promise<CheckoutClaim & { session?: Stripe.Checkout.Session }> {
  if (!/^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(sessionId)) return { status: "invalid" };
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return { status: "invalid" };
  }
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const email = session.customer_details?.email?.toLowerCase();
  const fresh = Date.now() - session.created * 1000 < CLAIM_DAYS * 24 * HOUR;
  if (session.status !== "complete" || !customerId || !email || !fresh || email === ADMIN_EMAIL) return { status: "invalid" };

  const user = await findUserByEmail(email);
  if (user?.role === "sales") return { status: "conflict", email, session };
  // Déjà relié à ce client avec un mot de passe : rien à créer. Sans mot de passe, le payeur peut le définir.
  if (user?.stripeCustomerId === customerId && user.passwordHash) return { status: "existing", email, session };
  if (user?.stripeCustomerId && user.stripeCustomerId !== customerId) return { status: "conflict", email, session };
  return { status: "claimable", email, name: session.customer_details?.name ?? null, customerId, session };
}

/** Crée ou reprend le compte relié au paiement. À n'appeler qu'après checkoutClaim() == "claimable". */
export async function claimCheckoutAccount(claim: Extract<CheckoutClaim, { status: "claimable" }>, passwordHash: string, name: string): Promise<User> {
  const existing = await findUserByEmail(claim.email);
  if (existing) {
    const [updated] = await db
      .update(users)
      .set({ passwordHash, name, stripeCustomerId: claim.customerId })
      .where(eq(users.id, existing.id))
      .returning();
    return updated!;
  }
  const [created] = await db
    .insert(users)
    .values({ email: claim.email, name, passwordHash, stripeCustomerId: claim.customerId, termsAcceptedAt: new Date() })
    .returning();
  return created!;
}

/** Recopie dans l'abonnement le compte Instagram saisi au paiement, pour l'afficher dans l'admin. */
export async function saveInstagramFromCheckout(session: Stripe.Checkout.Session) {
  const handle = session.custom_fields
    ?.find((f) => f.key === "instagram_username")
    ?.text?.value?.trim()
    .replace(/^@/, "")
    .toLowerCase();
  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!handle || !subId || !/^[a-z0-9._]{1,30}$/.test(handle)) return;
  try {
    const sub = await stripe.subscriptions.retrieve(subId);
    if (sub.metadata?.instagram_username !== handle) {
      await stripe.subscriptions.update(subId, { metadata: { ...sub.metadata, instagram_username: handle } });
    }
  } catch (error) {
    console.error("Saving Instagram handle on the subscription failed", error);
  }
}

// ---------- Limite des tentatives de connexion ----------

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 10;

export async function tooManyFailures(email: string) {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  const count = await db.$count(loginFailures, and(eq(loginFailures.email, email.toLowerCase()), gte(loginFailures.createdAt, since)));
  return count >= MAX_FAILURES;
}

export async function recordFailure(email: string) {
  await db.insert(loginFailures).values({ email: email.toLowerCase() });
  // Ménage : les échecs de plus d'un jour ne servent plus.
  await db.delete(loginFailures).where(lt(loginFailures.createdAt, new Date(Date.now() - 24 * HOUR)));
}

export async function clearFailures(email: string) {
  await db.delete(loginFailures).where(eq(loginFailures.email, email.toLowerCase()));
}
