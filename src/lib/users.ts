import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { issueClientToken } from "@/lib/centurie-api";
import { findOrCreateCustomer } from "@/lib/stripe";

export const PASSWORD_HASH_ROUNDS = 12;

export async function findUserByEmail(email: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
}

/** Crée l'utilisateur à sa première connexion Google (email vérifié par Google). */
export async function upsertOAuthUser({ email, name }: { email: string; name?: string | null }): Promise<User> {
  const normalized = email.toLowerCase();
  await db
    .insert(users)
    .values({ email: normalized, name: name ?? null })
    .onConflictDoNothing({ target: users.email });
  const user = await findUserByEmail(normalized);
  if (!user) throw new Error("User upsert failed");
  return user;
}

/** Renvoie le client Stripe de l'utilisateur, en le retrouvant ou le créant au besoin, puis l'enregistre. */
export async function ensureStripeCustomer(user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customerId = await findOrCreateCustomer({ email: user.email, name: user.name });
  await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id));
  user.stripeCustomerId = customerId;
  return customerId;
}

/**
 * Renvoie le token client `cbk_` de l'API Centurie pour le client Stripe de l'utilisateur,
 * en le faisant émettre par le token admin s'il n'existe pas (ou s'il a été émis pour un autre client).
 */
export async function ensureCenturieToken(user: User): Promise<string> {
  const customerId = await ensureStripeCustomer(user);
  if (user.centurieToken && user.centurieTokenCustomerId === customerId) return user.centurieToken;
  const token = await issueClientToken(customerId);
  await db
    .update(users)
    .set({ centurieToken: token, centurieTokenCustomerId: customerId })
    .where(eq(users.id, user.id));
  user.centurieToken = token;
  user.centurieTokenCustomerId = customerId;
  return token;
}
