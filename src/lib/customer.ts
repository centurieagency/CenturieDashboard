import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { backendToken } from "@/lib/centurie-api";
import { ensureCenturieToken, ensureStripeCustomer, findUserByEmail } from "@/lib/users";

/**
 * Utilisateur connecté, son client Stripe et son token pour l'API Centurie. Redirige vers /login sans session.
 * La base fait foi pour le customer ID (la session peut garder un ancien ID) ; la session ne sert que de repli.
 * Le token client `cbk_` est émis au besoin ; s'il ne peut pas l'être, on se rabat sur le token backend `b64_`.
 * `apiToken` est un secret : ne jamais le passer à un composant client.
 */
export const requireCustomer = cache(async (callbackUrl = "/") => {
  const session = await auth();
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);

  let customerId: string | undefined;
  let apiToken: string | undefined;
  const dbUser = session.user.email ? await findUserByEmail(session.user.email) : undefined;

  if (dbUser) {
    try {
      customerId = await ensureStripeCustomer(dbUser);
    } catch (error) {
      console.error("Stripe customer lookup failed", error);
    }
    if (customerId) {
      try {
        apiToken = await ensureCenturieToken(dbUser);
      } catch (error) {
        console.error("Centurie client token issuance failed", error);
      }
    }
  }

  customerId ??= session.user.stripeCustomerId;
  if (customerId && !apiToken) apiToken = backendToken(customerId);

  return { user: session.user, customerId, apiToken };
});
