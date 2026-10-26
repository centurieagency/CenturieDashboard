"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import {
  findUsableInvite,
  markInviteUsed,
  markModuleDone,
  requireAcademy,
  startExam,
  submitExam,
  type ExamResult,
} from "@/lib/academy/academy";
import { ADMIN_EMAIL } from "@/lib/admin-email";
import { findUserByEmail, PASSWORD_HASH_ROUNDS } from "@/lib/users";

/** Module terminé, puis direction le module suivant (l'admin en relecture ne laisse aucune trace). */
export async function completeModuleAction(slug: string, nextHref: string) {
  const viewer = await requireAcademy();
  if (viewer.mode === "sales") {
    await markModuleDone(viewer.user.id, slug);
    revalidatePath("/academy", "layout");
  }
  // Redirection interne uniquement.
  redirect(/^\/academy(\/[a-z0-9-]+)?$/.test(nextHref) ? nextHref : "/academy");
}

export async function startExamAction() {
  const viewer = await requireAcademy("/academy/exam");
  if (viewer.mode !== "sales") return;
  await startExam(viewer.user.id);
  revalidatePath("/academy", "layout");
}

const answersSchema = z.record(z.string().regex(/^[A-Z]\d{1,3}$/), z.string().regex(/^[a-d]$/));

export async function submitExamAction(
  attemptId: string,
  answers: Record<string, string>,
): Promise<{ ok: true; result: ExamResult } | { ok: false; error: string }> {
  const viewer = await requireAcademy("/academy/exam");
  if (viewer.mode !== "sales") return { ok: false, error: "Preview mode: the exam is for sales partners only." };
  const parsed = answersSchema.safeParse(answers);
  if (!parsed.success || !z.uuid().safeParse(attemptId).success) return { ok: false, error: "Invalid answers." };
  try {
    const result = await submitExam(viewer.user.id, attemptId, parsed.data);
    revalidatePath("/academy", "layout");
    return { ok: true, result };
  } catch (error) {
    console.error("Exam submission failed", error);
    return { ok: false, error: "This exam can no longer be submitted. Reload the page." };
  }
}

// ---------- Inscription par invitation ----------

const joinSchema = z.object({
  token: z.string().min(20).max(64),
  name: z.string().trim().min(2, "Indique ton nom complet.").max(100),
  // bcrypt ne prend en compte que les 72 premiers octets.
  password: z.string().min(8, "8 caractères minimum.").max(72, "72 caractères maximum."),
});

export type JoinState = { error?: string; done?: boolean; email?: string };

export async function joinAcademyAction(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const parsed = joinSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const invite = await findUsableInvite(parsed.data.token);
  if (!invite) return { error: "Cette invitation n'est plus valable. Demande un nouveau lien à Centurie." };
  if (invite.email === ADMIN_EMAIL) return { error: "Cette adresse ne peut pas être utilisée ici." };

  const existing = await findUserByEmail(invite.email);
  if (existing) {
    return {
      error:
        existing.role === "sales"
          ? "Tu as déjà un compte : connecte-toi avec ton email et ton mot de passe."
          : "Cette adresse est déjà utilisée par un compte client. Contacte Centurie.",
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, PASSWORD_HASH_ROUNDS);
  await db.insert(users).values({ email: invite.email, name: parsed.data.name, passwordHash, role: "sales" });
  await markInviteUsed(invite.id);
  // Le formulaire connecte ensuite l'apporteur avec ces identifiants (côté navigateur, via next-auth).
  return { done: true, email: invite.email };
}
