"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { accreditations, salesInvites } from "@/db/schema";
import { createInvite } from "@/lib/academy/academy";
import { ADMIN_EMAIL } from "@/lib/admin-email";
import { isAdminSession } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { findUserByEmail } from "@/lib/users";

const NOT_ALLOWED = "Not allowed.";

async function assertAdmin() {
  if (!isAdminSession(await auth())) throw new Error(NOT_ALLOWED);
}

const inviteSchema = z.object({
  email: z.email("Enter a valid email.").max(254),
  name: z.string().trim().max(100).optional(),
});

export type InviteState = { error?: string; link?: string; email?: string };

/** Crée une invitation et renvoie le lien à transmettre (affiché une seule fois). */
export async function createInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await assertAdmin();
  const parsed = inviteSchema.safeParse({ email: formData.get("email"), name: formData.get("name") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid form." };
  const email = parsed.data.email.toLowerCase();
  if (email === ADMIN_EMAIL) return { error: "This is the admin address." };
  const existing = await findUserByEmail(email);
  if (existing) {
    return {
      error: existing.role === "sales" ? "This partner already has an account." : "This email belongs to a client account.",
    };
  }

  const token = await createInvite(email, parsed.data.name || null);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  revalidatePath("/admin/academy");
  return { link: `${proto}://${host}/academy/join/${token}`, email };
}

export async function revokeInviteAction(inviteId: string) {
  await assertAdmin();
  if (!z.uuid().safeParse(inviteId).success) return;
  await db.update(salesInvites).set({ revokedAt: new Date() }).where(eq(salesInvites.id, inviteId));
  revalidatePath("/admin/academy");
}

/** Retire l'accréditation en cours d'un apporteur (il devra repasser l'examen). */
export async function revokeAccreditationAction(userId: string) {
  await assertAdmin();
  if (!z.uuid().safeParse(userId).success) return;
  await db
    .update(accreditations)
    .set({ revokedAt: new Date() })
    .where(and(eq(accreditations.userId, userId), isNull(accreditations.revokedAt)));
  revalidatePath("/admin/academy");
}
