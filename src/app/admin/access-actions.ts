"use server";

import { headers } from "next/headers";
import type Stripe from "stripe";

import { ACCESS_LINK_DAYS, createAccessLinkForCustomer } from "@/lib/access";
import { isAdminSession } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export type AccessLinkState = { error?: string; link?: string; email?: string; days?: number };

/**
 * Admin : lien personnel pour qu'un client définisse son mot de passe (accès au dashboard, ou mot de passe oublié).
 * Le client Stripe est relu côté serveur : on ne se fie jamais à un email envoyé par le navigateur.
 */
export async function createAccessLinkAction(customerId: string): Promise<AccessLinkState> {
  if (!isAdminSession(await auth())) return { error: "Not allowed." };
  if (!/^cus_[A-Za-z0-9]+$/.test(customerId)) return { error: "Unknown client." };

  let customer: Stripe.Customer | Stripe.DeletedCustomer;
  try {
    customer = await stripe.customers.retrieve(customerId);
  } catch {
    return { error: "This Stripe client can't be found." };
  }
  if ("deleted" in customer && customer.deleted) return { error: "This Stripe client was deleted." };

  const res = await createAccessLinkForCustomer({ id: customer.id, email: customer.email ?? null, name: customer.name ?? null });
  if ("error" in res) return { error: res.error };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return { link: `${proto}://${host}/access/${res.token}`, email: res.email, days: ACCESS_LINK_DAYS };
}
