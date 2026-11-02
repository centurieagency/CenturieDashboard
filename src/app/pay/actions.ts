"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { checkoutClaim, claimCheckoutAccount, clearFailures, consumeAccessLink, findUsableAccessLink } from "@/lib/access";
import { ensureCenturieToken, PASSWORD_HASH_ROUNDS } from "@/lib/users";

export type PasswordState = { error?: string; done?: boolean; email?: string };

const passwordSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100),
  // bcrypt ne prend en compte que les 72 premiers octets.
  password: z.string().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer."),
});

const parse = (form: FormData) => {
  if (form.get("password") !== form.get("confirm")) return { error: "The two passwords don't match." } as const;
  const parsed = passwordSchema.safeParse({ name: form.get("name"), password: form.get("password") });
  return parsed.success ? ({ data: parsed.data } as const) : ({ error: parsed.error.issues[0]?.message ?? "Invalid form." } as const);
};

/** Crée le compte client relié au paiement qui vient d'être fait (la session Stripe en est la preuve). */
export async function claimAccountAction(sessionId: string, _prev: PasswordState, form: FormData): Promise<PasswordState> {
  const input = parse(form);
  if ("error" in input) return { error: input.error };
  const claim = await checkoutClaim(sessionId);
  if (claim.status !== "claimable") return { error: "This link can no longer be used to create an account. Log in, or contact us." };
  const user = await claimCheckoutAccount(claim, await bcrypt.hash(input.data.password, PASSWORD_HASH_ROUNDS), input.data.name);
  try {
    await ensureCenturieToken(user);
  } catch (error) {
    // Pas bloquant : il sera émis à la connexion.
    console.error("Centurie client token issuance failed after checkout", error);
  }
  return { done: true, email: user.email };
}

/** Définit le mot de passe via un lien personnel envoyé par l'équipe. */
export async function setPasswordAction(token: string, _prev: PasswordState, form: FormData): Promise<PasswordState> {
  const input = parse(form);
  if ("error" in input) return { error: input.error };
  const found = await findUsableAccessLink(token);
  if (!found) return { error: "This link has expired or was already used. Ask your account manager for a new one." };
  await consumeAccessLink(found.link.id, found.user.id, await bcrypt.hash(input.data.password, PASSWORD_HASH_ROUNDS), input.data.name);
  // Nouveau mot de passe : les échecs passés ne doivent plus bloquer la connexion.
  await clearFailures(found.user.email);
  return { done: true, email: found.user.email };
}
