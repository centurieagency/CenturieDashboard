"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { requestPasswordReset } from "@/lib/access";
import { sendPasswordResetEmail } from "@/lib/email";
import { env } from "@/lib/env";

export type ForgotState = { sent?: boolean; error?: string };

/** Même réponse que l'email existe ou non : on ne révèle pas quels comptes existent. */
export async function forgotPasswordAction(_prev: ForgotState, form: FormData): Promise<ForgotState> {
  const parsed = z.email().max(254).safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = env.NEXTAUTH_URL?.replace(/\/$/, "") ?? `${host?.startsWith("localhost") ? "http" : "https"}://${host}`;
  try {
    await requestPasswordReset(parsed.data, origin, sendPasswordResetEmail);
  } catch (error) {
    console.error("Password reset request failed", error);
  }
  return { sent: true };
}
