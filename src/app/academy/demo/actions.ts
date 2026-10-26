"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/app/accounts/[subId]/actions";
import { accreditationOf, requireAcademy } from "@/lib/academy/academy";
import { DEFAULT_LIMITS, NICHE_IDS, newDemoState, readDemoState, writeDemoState, type DemoState } from "@/lib/academy/demo";
import { PLAN_IDS } from "@/lib/plans";

/** Démo réservée aux apporteurs accrédités (et à l'admin). Ne touche jamais l'API Centurie ni Stripe. */
async function requireDemo() {
  const viewer = await requireAcademy("/academy/demo");
  if (viewer.mode === "sales" && (await accreditationOf(viewer.user.id)).status !== "valid") redirect("/academy/demo");
}

const handle = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, ""))
  .pipe(z.string().regex(/^[A-Za-z0-9._]{1,30}$/, "Indique un nom d'utilisateur Instagram valide."));

const setupSchema = z.object({
  handle,
  name: z.string().trim().max(60).default(""),
  niche: z.enum(NICHE_IDS),
  followers: z.coerce.number().int().min(0, "Nombre de followers invalide.").max(5_000_000),
  posts: z.coerce.number().int().min(0).max(100_000),
  plan: z.enum(PLAN_IDS),
});

export type SetupState = { error?: string };

export async function setupDemoAction(_prev: SetupState, form: FormData): Promise<SetupState> {
  await requireDemo();
  const parsed = setupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  await writeDemoState(newDemoState(parsed.data));
  redirect("/academy/demo");
}

/** Même prospect, réglages d'origine (cibles, limites, croissance active). */
export async function resetDemoAction() {
  await requireDemo();
  const state = await readDemoState();
  if (state) await writeDemoState(newDemoState(state));
  redirect("/academy/demo");
}

export async function newProspectAction() {
  await requireDemo();
  await writeDemoState(null);
  redirect("/academy/demo");
}

// ---------- Actions du faux compte (mêmes formulaires que le vrai dashboard) ----------

async function update(change: (s: DemoState) => DemoState | string): Promise<ActionState> {
  await requireDemo();
  const state = await readDemoState();
  if (!state) return { status: "error", message: "The demo has expired. Start it again." };
  const next = change(state);
  if (typeof next === "string") return { status: "error", message: next };
  await writeDemoState(next);
  revalidatePath("/academy/demo");
  return { status: "success" };
}

const username = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, "").toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9._]{1,30}$/));

export async function demoAddTarget(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = username.safeParse(form.get("target_username") ?? "");
  if (!parsed.success) return { status: "error", message: "Enter a valid Instagram username." };
  const res = await update((s) =>
    s.targets.includes(parsed.data)
      ? "This account is already in your targets."
      : s.targets.length >= 60
        ? "Maximum 60 targets in the demo."
        : { ...s, targets: [parsed.data, ...s.targets] },
  );
  return res.status === "success" ? { status: "success", message: `@${parsed.data} added to your targets.` } : res;
}

export async function demoAddTargets(_prev: ActionState, form: FormData): Promise<ActionState> {
  const names = String(form.get("usernames") ?? "")
    .split(/[\s,;]+/)
    .map((n) => username.safeParse(n))
    .filter((p) => p.success)
    .map((p) => p.data!);
  if (!names.length) return { status: "error", message: "Enter at least one valid username." };
  let added = 0;
  const res = await update((s) => {
    const fresh = [...new Set(names)].filter((n) => !s.targets.includes(n)).slice(0, 60 - s.targets.length);
    added = fresh.length;
    return { ...s, targets: [...fresh, ...s.targets] };
  });
  return res.status === "success" ? { status: "success", message: `${added} account${added === 1 ? "" : "s"} added.` } : res;
}

export async function demoRemoveTarget(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = username.safeParse(form.get("target_username") ?? "");
  if (!parsed.success) return { status: "error", message: "Invalid target." };
  return update((s) => ({ ...s, targets: s.targets.filter((t) => t !== parsed.data) }));
}

export async function demoSetActive(_prev: ActionState, form: FormData): Promise<ActionState> {
  const active = form.get("is_active") === "true";
  const res = await update((s) => ({ ...s, paused: !active }));
  return res.status === "success" ? { status: "success", message: active ? "Growth resumed." : "Growth paused." } : res;
}

const quota = (max: number) => z.coerce.number().int().min(1).max(max);

export async function demoSaveConfig(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z
    .object({ follow: quota(70), post: quota(250), story: quota(250) })
    .safeParse({ follow: form.get("per_day_follow"), post: form.get("per_day_like_post"), story: form.get("per_day_like_story") });
  if (!parsed.success) return { status: "error", message: "Limits: 1–70 follows, 1–250 post likes, 1–250 story likes." };
  const res = await update((s) => ({
    ...s,
    limits: {
      ...DEFAULT_LIMITS,
      ...parsed.data,
      followOn: form.get("enabled_follow") === "on",
      postOn: form.get("enabled_post_like") === "on",
      storyOn: form.get("enabled_like_story") === "on",
      warmup: form.get("enabled_warmup") === "on",
    },
  }));
  return res.status === "success" ? { status: "success", message: "Daily limits saved." } : res;
}
