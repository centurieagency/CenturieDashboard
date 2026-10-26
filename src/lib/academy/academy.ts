import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { academyProgress, accreditations, examAttempts, salesInvites, users, type User } from "@/db/schema";
import { isAdminSession } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { findUserByEmail } from "@/lib/users";
import { getCourse, getExamBank, publicQuestion, type PublicQuestion } from "./content";

// ---------- Règles ----------

export const EXAM_SIZE = 25;
export const PASS_RATIO = 0.8;
export const RETRY_HOURS = 24;
/** Au-delà, une tentative ouverte et non remise compte comme un échec (pas de « coup d'œil » gratuit). */
export const EXAM_TIME_LIMIT_MINUTES = 60;
export const ACCREDITATION_MONTHS = 12;
export const INVITE_DAYS = 14;

const HOUR = 3_600_000;

// ---------- Accès ----------

export type AcademyViewer =
  | { mode: "sales"; user: User }
  /** L'admin peut parcourir le cours (relecture), sans progression ni examen. */
  | { mode: "preview"; email: string };

/** Garde des pages Academy : apporteurs d'affaires, ou l'admin en lecture. Les clients sont renvoyés chez eux. */
export const requireAcademy = cache(async (callbackUrl = "/academy"): Promise<AcademyViewer> => {
  const session = await auth();
  if (!session?.user.email) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  if (isAdminSession(session)) return { mode: "preview", email: session.user.email };
  const user = await findUserByEmail(session.user.email);
  if (user?.role !== "sales") redirect("/");
  return { mode: "sales", user };
});

// ---------- Progression ----------

export async function completedModules(userId: string): Promise<Set<string>> {
  const rows = await db.select({ module: academyProgress.module }).from(academyProgress).where(eq(academyProgress.userId, userId));
  return new Set(rows.map((r) => r.module));
}

export async function markModuleDone(userId: string, slug: string) {
  if (!getCourse().modules.some((m) => m.slug === slug)) throw new Error("Unknown module");
  await db.insert(academyProgress).values({ userId, module: slug }).onConflictDoNothing();
}

// ---------- Accréditation ----------

export type AccreditationState =
  | { status: "none" }
  | { status: "valid"; certificateNumber: string; issuedAt: Date; expiresAt: Date }
  | { status: "expired"; certificateNumber: string; expiresAt: Date }
  | { status: "revoked"; certificateNumber: string; revokedAt: Date };

export async function accreditationOf(userId: string, now = new Date()): Promise<AccreditationState> {
  const [last] = await db
    .select()
    .from(accreditations)
    .where(eq(accreditations.userId, userId))
    .orderBy(desc(accreditations.issuedAt))
    .limit(1);
  if (!last) return { status: "none" };
  if (last.revokedAt) return { status: "revoked", certificateNumber: last.certificateNumber, revokedAt: last.revokedAt };
  if (last.expiresAt <= now) return { status: "expired", certificateNumber: last.certificateNumber, expiresAt: last.expiresAt };
  return { status: "valid", certificateNumber: last.certificateNumber, issuedAt: last.issuedAt, expiresAt: last.expiresAt };
}

function certificateNumber(now: Date) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `CGA-${now.getUTCFullYear()}-${code}`;
}

// ---------- Examen ----------

export type ExamState =
  | { status: "locked"; reason: "modules"; remaining: number }
  | { status: "accredited" }
  | { status: "cooldown"; retryAt: Date }
  | { status: "ready" }
  | { status: "in_progress"; attemptId: string; deadline: Date; questions: PublicQuestion[] };

/** Ferme les tentatives ouvertes depuis trop longtemps : elles comptent comme un échec. */
async function closeStaleAttempts(userId: string, now: Date) {
  const open = await db
    .select()
    .from(examAttempts)
    .where(and(eq(examAttempts.userId, userId), isNull(examAttempts.submittedAt)));
  for (const a of open) {
    if (now.getTime() - a.startedAt.getTime() > EXAM_TIME_LIMIT_MINUTES * 60_000) {
      await db
        .update(examAttempts)
        .set({ submittedAt: now, answers: a.answers ?? {}, score: 0, total: a.questionIds.length, criticalFailed: false, passed: false })
        .where(eq(examAttempts.id, a.id));
    }
  }
}

export async function examState(userId: string, now = new Date()): Promise<ExamState> {
  const done = await completedModules(userId);
  const remaining = getCourse().modules.filter((m) => !done.has(m.slug)).length;
  if (remaining > 0) return { status: "locked", reason: "modules", remaining };
  if ((await accreditationOf(userId, now)).status === "valid") return { status: "accredited" };

  await closeStaleAttempts(userId, now);
  const [last] = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.userId, userId))
    .orderBy(desc(examAttempts.startedAt))
    .limit(1);

  if (last && !last.submittedAt) {
    const bank = new Map(getExamBank().map((q) => [q.id, q]));
    return {
      status: "in_progress",
      attemptId: last.id,
      deadline: new Date(last.startedAt.getTime() + EXAM_TIME_LIMIT_MINUTES * 60_000),
      questions: last.questionIds.flatMap((id) => (bank.has(id) ? [publicQuestion(bank.get(id)!)] : [])),
    };
  }
  if (last && last.passed === false && last.submittedAt) {
    const retryAt = new Date(last.submittedAt.getTime() + RETRY_HOURS * HOUR);
    if (retryAt > now) return { status: "cooldown", retryAt };
  }
  return { status: "ready" };
}

/** Tire les questions au hasard (Fisher-Yates avec le générateur crypto). */
function drawQuestions(size: number): string[] {
  const ids = getExamBank().map((q) => q.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  return ids.slice(0, Math.min(size, ids.length));
}

export async function startExam(userId: string) {
  const state = await examState(userId);
  if (state.status === "in_progress") return;
  if (state.status !== "ready") throw new Error(`Exam not available: ${state.status}`);
  await db.insert(examAttempts).values({ userId, questionIds: drawQuestions(EXAM_SIZE) });
}

export type ExamResult = {
  score: number;
  total: number;
  passed: boolean;
  criticalFailed: boolean;
  /** Sections où il y a eu des erreurs (sans donner les bonnes réponses : la banque reste secrète). */
  weakSections: string[];
  certificateNumber?: string;
};

export async function submitExam(userId: string, attemptId: string, answers: Record<string, string>): Promise<ExamResult> {
  const now = new Date();
  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, userId)))
    .limit(1);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.submittedAt) throw new Error("Attempt already submitted");

  const bank = new Map(getExamBank().map((q) => [q.id, q]));
  const lateBy = now.getTime() - attempt.startedAt.getTime() - EXAM_TIME_LIMIT_MINUTES * 60_000;
  // Petite marge pour la remise au moment exact de la fin du temps.
  const late = lateBy > 2 * 60_000;

  let score = 0;
  let criticalFailed = false;
  const weak = new Set<string>();
  const kept: Record<string, string> = {};
  for (const id of attempt.questionIds) {
    const q = bank.get(id);
    if (!q) continue;
    const key = answers[id];
    if (typeof key === "string" && q.options.some((o) => o.key === key)) kept[id] = key;
    const chosen = q.options.find((o) => o.key === key);
    if (chosen?.correct) score++;
    else weak.add(q.section);
    if (q.critical && chosen?.forbidden) criticalFailed = true;
  }
  const total = attempt.questionIds.length;
  const passed = !late && !criticalFailed && score >= Math.ceil(total * PASS_RATIO);

  await db
    .update(examAttempts)
    .set({ submittedAt: now, answers: kept, score: late ? 0 : score, total, criticalFailed, passed })
    .where(eq(examAttempts.id, attempt.id));

  let number: string | undefined;
  if (passed) {
    number = certificateNumber(now);
    const expiresAt = new Date(now);
    expiresAt.setUTCMonth(expiresAt.getUTCMonth() + ACCREDITATION_MONTHS);
    await db.insert(accreditations).values({ certificateNumber: number, userId, attemptId: attempt.id, issuedAt: now, expiresAt });
  }
  return { score: late ? 0 : score, total, passed, criticalFailed, weakSections: [...weak], certificateNumber: number };
}

export async function lastResult(userId: string) {
  const [last] = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.userId, userId))
    .orderBy(desc(examAttempts.startedAt))
    .limit(1);
  return last?.submittedAt ? last : null;
}

// ---------- Invitations ----------

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Crée une invitation et renvoie le jeton en clair (affiché une seule fois à l'admin, jamais stocké). */
export async function createInvite(email: string, name: string | null) {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * HOUR);
  await db.insert(salesInvites).values({ tokenHash: hashToken(token), email: email.toLowerCase(), name, expiresAt });
  return token;
}

export async function findUsableInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const invite = await db.query.salesInvites.findFirst({ where: eq(salesInvites.tokenHash, hashToken(token)) });
  if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= new Date()) return null;
  return invite;
}

export async function markInviteUsed(id: string) {
  await db.update(salesInvites).set({ usedAt: new Date() }).where(eq(salesInvites.id, id));
}

// ---------- Vue admin ----------

export async function listSalesOverview() {
  const now = new Date();
  const reps = await db.select().from(users).where(eq(users.role, "sales")).orderBy(desc(users.createdAt));
  const moduleCount = getCourse().modules.length;
  const rows = await Promise.all(
    reps.map(async (u) => {
      const [done, accreditation, result, attempts] = await Promise.all([
        completedModules(u.id),
        accreditationOf(u.id, now),
        lastResult(u.id),
        db.$count(examAttempts, eq(examAttempts.userId, u.id)),
      ]);
      return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt, modulesDone: done.size, moduleCount, accreditation, result, attempts };
    }),
  );
  const invites = await db
    .select()
    .from(salesInvites)
    .where(and(isNull(salesInvites.usedAt), isNull(salesInvites.revokedAt)))
    .orderBy(desc(salesInvites.createdAt));
  return { rows, invites: invites.filter((i) => i.expiresAt > now) };
}
