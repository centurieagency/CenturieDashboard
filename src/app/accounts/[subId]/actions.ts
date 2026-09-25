"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  addTarget,
  CenturieApiError,
  connectAccount,
  removeTarget,
  send2FAKey,
  toggleActive,
  update2FACodes,
  updateConfig,
  updatePassword,
} from "@/lib/centurie-api";
import { requireCustomer } from "@/lib/customer";

export type ActionState = { status: "idle" | "success" | "error"; message?: string };

const subIdSchema = z.string().regex(/^sub_[A-Za-z0-9]+$/);
const instagramUsername = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, "").toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9._]{1,30}$/, "Enter a valid Instagram username."));

function errorMessage(error: unknown, conflict = "This already exists."): string {
  if (error instanceof CenturieApiError) {
    if (error.status === 400) return "Some values were rejected. Check them and try again.";
    if (error.status === 401 || error.status === 403 || error.status === 404)
      return "This account isn't available on your subscriptions.";
    if (error.status === 409) return conflict;
    if (error.status >= 500) return "The service is unavailable right now. Try again in a moment.";
  }
  return "Something went wrong. Try again.";
}

/** Vérifie le sub_id, récupère le token API de l'utilisateur, exécute l'appel et rafraîchit les pages. */
async function run(
  subId: string,
  fn: (token: string, subId: string) => Promise<string>,
  conflict?: string,
): Promise<ActionState> {
  if (!subIdSchema.safeParse(subId).success) return { status: "error", message: "Unknown subscription." };
  const { apiToken } = await requireCustomer(`/accounts/${subId}`);
  if (!apiToken) return { status: "error", message: "Your billing account isn't ready yet. Try again later." };
  try {
    const message = await fn(apiToken, subId);
    revalidatePath(`/accounts/${subId}`);
    revalidatePath("/");
    return { status: "success", message };
  } catch (error) {
    if (!(error instanceof CenturieApiError)) console.error("Centurie API action failed", error);
    return { status: "error", message: errorMessage(error, conflict) };
  }
}

const invalid = (error: z.ZodError): ActionState => ({
  status: "error",
  message: error.issues[0]?.message ?? "Check the values and try again.",
});

// ---------- Connexion du compte ----------

const connectSchema = z.object({
  username: instagramUsername,
  password: z.string().min(1, "Enter the Instagram password.").max(200),
});

export async function connectAction(subId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = connectSchema.safeParse({ username: form.get("username"), password: form.get("password") });
  if (!parsed.success) return invalid(parsed.error);
  return run(
    subId,
    async (token, sub) => {
      await connectAccount(token, { sub_id: sub, ...parsed.data });
      return "Account sent. We're logging in, this can take a few minutes.";
    },
    "This Instagram account is already connected to a subscription.",
  );
}

// ---------- Pause / reprise ----------

export async function setActiveAction(subId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const isActive = form.get("is_active") === "true";
  return run(subId, async (token, sub) => {
    await toggleActive(token, sub, isActive);
    return isActive ? "Growth resumed." : "Growth paused.";
  });
}

// ---------- Quotas quotidiens ----------

const quota = (max: number) => z.coerce.number().int("Use whole numbers.").min(1, "Use at least 1.").max(max);

// Bornes max du mode Expert ; l'API applique les bornes du mode Normal (250 / 250 / 70) et renvoie 400 au-delà.
const configSchema = z.object({
  per_day_follow: quota(90),
  per_day_like_post: quota(350),
  per_day_like_story: quota(550),
  enabled_follow: z.boolean(),
  enabled_post_like: z.boolean(),
  enabled_like_story: z.boolean(),
  enabled_warmup: z.boolean(),
});

export async function saveConfigAction(subId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = configSchema.safeParse({
    per_day_follow: form.get("per_day_follow"),
    per_day_like_post: form.get("per_day_like_post"),
    per_day_like_story: form.get("per_day_like_story"),
    enabled_follow: form.get("enabled_follow") === "on",
    enabled_post_like: form.get("enabled_post_like") === "on",
    enabled_like_story: form.get("enabled_like_story") === "on",
    enabled_warmup: form.get("enabled_warmup") === "on",
  });
  if (!parsed.success) return invalid(parsed.error);
  return run(subId, async (token, sub) => {
    await updateConfig(token, sub, parsed.data);
    return "Daily limits saved.";
  });
}

// ---------- Cibles ----------

export async function addTargetAction(subId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = instagramUsername.safeParse(form.get("target_username") ?? "");
  if (!parsed.success) return invalid(parsed.error);
  return run(
    subId,
    async (token, sub) => {
      await addTarget(token, sub, parsed.data);
      return `@${parsed.data} added to your targets.`;
    },
    "This account is already in your targets.",
  );
}

export async function removeTargetAction(subId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = instagramUsername.safeParse(form.get("target_username") ?? "");
  if (!parsed.success) return invalid(parsed.error);
  return run(subId, async (token, sub) => {
    await removeTarget(token, sub, parsed.data);
    return `@${parsed.data} removed.`;
  });
}

// ---------- Identifiants ----------

export async function passwordAction(subId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z.string().min(1, "Enter the new password.").max(200).safeParse(form.get("password") ?? "");
  if (!parsed.success) return invalid(parsed.error);
  return run(subId, async (token, sub) => {
    await updatePassword(token, sub, parsed.data);
    return "Password updated. We'll log in again with it.";
  });
}

export async function totpKeyAction(subId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z
    .string()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^[A-Za-z2-7]{16,64}$/, "Enter the key shown by Instagram (letters and digits)."))
    .safeParse(form.get("twofa_key") ?? "");
  if (!parsed.success) return invalid(parsed.error);
  return run(subId, async (token, sub) => {
    await send2FAKey(token, sub, parsed.data);
    return "Authenticator key saved.";
  });
}

export async function backupCodesAction(subId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  // Accepte « 1234 5678 », « 12345678 », séparés par espaces, virgules ou retours à la ligne.
  const digits = String(form.get("codes") ?? "").replace(/\D/g, "");
  if (digits.length === 0 || digits.length % 8 !== 0)
    return { status: "error", message: "Each backup code has exactly 8 digits." };
  const codes = digits.match(/\d{8}/g) ?? [];
  return run(subId, async (token, sub) => {
    const res = await update2FACodes(token, sub, codes.slice(0, 5));
    const saved = res?.account?.codes_count ?? codes.length;
    return `${saved} backup code${saved > 1 ? "s" : ""} saved.`;
  });
}
