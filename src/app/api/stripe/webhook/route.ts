import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { checkoutClaim, saveInstagramFromCheckout } from "@/lib/access";
import { sendSubscriptionAddedEmail, sendWelcomeEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";

/**
 * Webhook Stripe (checkout.session.completed) : après chaque paiement, on enregistre le compte Instagram saisi
 * et on envoie l'email de bienvenue avec le lien pour créer l'espace client, même si le client a fermé la page.
 * La signature Stripe est vérifiée : sans elle, la requête est rejetée.
 */
export async function POST(request: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.mode === "subscription" && session.status === "complete") {
      try {
        await handlePaidCheckout(session, new URL(request.url).origin);
      } catch (error) {
        // On répond quand même 200 : Stripe ne doit pas renvoyer l'événement en boucle pour un email raté.
        console.error("Post-checkout handling failed", session.id, error);
      }
    }
  }
  return NextResponse.json({ received: true });
}

async function handlePaidCheckout(session: Stripe.Checkout.Session, requestOrigin: string) {
  await saveInstagramFromCheckout(session);
  const origin = env.NEXTAUTH_URL?.replace(/\/$/, "") ?? requestOrigin;
  const claim = await checkoutClaim(session.id);
  const name = session.customer_details?.name ?? null;
  if (claim.status === "claimable") {
    await sendWelcomeEmail(claim.email, name, `${origin}/pay/success?session_id=${session.id}`, session.id);
  } else if (claim.status === "existing") {
    await sendSubscriptionAddedEmail(claim.email, name, `${origin}/login`, session.id);
  }
  // « conflict » : l'équipe rattache l'abonnement à la main (la page de confirmation l'a déjà annoncé).
}
