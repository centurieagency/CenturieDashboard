"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { findOrCreateCustomer } from "@/lib/stripe";
import { ensureCenturieToken, findUserByEmail, PASSWORD_HASH_ROUNDS } from "@/lib/users";
import { signupSchema, type SignupField } from "@/lib/validations/auth";

export type SignupResult =
  | { ok: true }
  | { ok: false; fieldErrors?: Partial<Record<SignupField, string>>; formError?: string };

const EMAIL_TAKEN = "An account already exists with this email. Log in instead.";

export async function signup(input: unknown): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      ok: false,
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([field, messages]) => [field, messages?.[0]]),
      ) as Partial<Record<SignupField, string>>,
    };
  }

  const { name, businessName, instagramHandle, password, plan } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const existing = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, email),
    columns: { id: true },
  });
  if (existing) return { ok: false, fieldErrors: { email: EMAIL_TAKEN } };

  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

  // Client déjà connu de Stripe : on reprend son customer ID au lieu d'en créer un nouveau.
  // TODO: vérifier l'email (lien de confirmation) avant de relier un client Stripe existant.
  let stripeCustomerId: string | null = null;
  try {
    stripeCustomerId = await findOrCreateCustomer({
      email,
      name,
      metadata: { business_name: businessName, instagram: `@${instagramHandle}`, plan_interest: plan },
    });
  } catch (error) {
    // Pas bloquant : il sera relié à la prochaine connexion.
    console.error("Stripe customer lookup failed during signup", error);
  }

  const inserted = await db
    .insert(users)
    .values({
      email,
      name,
      businessName,
      instagramHandle,
      planInterest: plan,
      passwordHash,
      stripeCustomerId,
      termsAcceptedAt: new Date(),
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });

  if (inserted.length === 0) return { ok: false, fieldErrors: { email: EMAIL_TAKEN } };

  // Token client de l'API Centurie pour ce client Stripe. Pas bloquant : il sera émis à la connexion sinon.
  try {
    const user = await findUserByEmail(email);
    if (user?.stripeCustomerId) await ensureCenturieToken(user);
  } catch (error) {
    console.error("Centurie client token issuance failed during signup", error);
  }

  return { ok: true };
}
