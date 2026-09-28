import "server-only";

import type { Session } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { ADMIN_EMAIL } from "@/lib/admin-email";
import { auth } from "@/lib/auth";

export { ADMIN_EMAIL };

/**
 * Admin = cet email ET une connexion Google (adresse vérifiée par Google).
 * Une connexion email/mot de passe avec la même adresse ne donne JAMAIS l'accès :
 * l'inscription par formulaire ne vérifie pas encore la propriété de l'email.
 */
export function isAdminSession(session: Session | null): boolean {
  return session?.user.email?.toLowerCase() === ADMIN_EMAIL && session.user.provider === "google";
}

/** Garde des pages admin : redirige vers /login sans session, 404 pour tout autre compte. */
export const requireAdmin = cache(async (callbackUrl = "/admin") => {
  const session = await auth();
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  if (!isAdminSession(session)) notFound();
  return session;
});
