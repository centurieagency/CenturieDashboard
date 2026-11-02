import "server-only";

import { z } from "zod";

const envSchema = z.object({
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.url().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  DATABASE_URL: z.url(),
  CENTURIE_API_TOKEN: z.string().startsWith("CENTURIE-ADMIN-"),
  STRIPE_SECRET_KEY: z.string().regex(/^(sk|rk)_(test|live)_/),
  /** Webhook Stripe (checkout.session.completed) : sans lui, l'email de bienvenue n'est pas envoyé. */
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  /** Resend, clé d'envoi uniquement : sans elle, aucun email n'est envoyé (journalisé). */
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
});

export const env = envSchema.parse(process.env);
