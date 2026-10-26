import type { Metadata } from "next";
import Link from "next/link";

import {
  accreditationOf,
  completedModules,
  EXAM_SIZE,
  examState,
  lastResult,
  PASS_RATIO,
  requireAcademy,
} from "@/lib/academy/academy";
import { getCourse } from "@/lib/academy/content";
import { AcademyShell } from "./academy-shell";
import styles from "./academy.module.css";

export const metadata: Metadata = { title: "Academy · Centurie Growth" };

const dateFr = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default async function AcademyHome() {
  const viewer = await requireAcademy();
  const course = getCourse();
  const userId = viewer.mode === "sales" ? viewer.user.id : null;

  const [done, exam, accreditation, result] = userId
    ? await Promise.all([completedModules(userId), examState(userId), accreditationOf(userId), lastResult(userId)])
    : [new Set<string>(), null, null, null];
  const doneCount = course.modules.filter((m) => done.has(m.slug)).length;
  const next = course.modules.find((m) => !done.has(m.slug)) ?? course.modules[0]!;

  return (
    <AcademyShell viewer={viewer}>
      <header>
        <span className={styles.eyebrow}>Centurie Growth Academy</span>
        <h1 className={styles.title}>
          {viewer.mode === "sales" && viewer.user.name ? `Bienvenue, ${viewer.user.name.split(" ")[0]}` : "Bienvenue dans l'Academy"}
        </h1>
        <p className={styles.lead}>
          9 modules pour comprendre le produit, ses limites et la bonne façon d&apos;en parler, puis un examen en anglais.
          Réussi, il te donne l&apos;accréditation pour vendre Centurie Growth.
        </p>
      </header>

      <section className={styles.card} aria-label="Progression">
        <div className={styles.progressHead}>
          <span>Ta progression</span>
          <span>
            <b>{doneCount}</b> / {course.modules.length} modules
          </span>
        </div>
        <div className={styles.track} aria-hidden="true">
          <span style={{ width: `${(doneCount / course.modules.length) * 100}%` }} />
        </div>
        <div className={styles.actions} style={{ marginTop: 18 }}>
          <Link href={`/academy/${next.slug}`} className={styles.primary}>
            {doneCount === 0 ? "Commencer le cours" : doneCount < course.modules.length ? "Continuer" : "Revoir le cours"} →
          </Link>
        </div>
      </section>

      <div className={styles.prose} dangerouslySetInnerHTML={{ __html: course.introHtml }} />

      <section aria-labelledby="modules-title">
        <h2 id="modules-title" className={styles.cardTitle} style={{ marginBottom: 14 }}>
          Les modules
        </h2>
        <ol className={styles.modules}>
          {course.modules.map((m) => {
            const isDone = done.has(m.slug);
            return (
              <li key={m.slug}>
                <Link href={`/academy/${m.slug}`} className={`${styles.moduleLink} ${isDone ? styles.moduleDone : ""}`}>
                  <span className={styles.moduleNum}>{isDone ? "✓" : m.number}</span>
                  <span>
                    <span className={styles.moduleTitle}>{m.title}</span>
                    <span className={styles.moduleMeta}>{m.quiz.length} questions de vérification</span>
                  </span>
                  {isDone ? <span className={`${styles.badge} ${styles.badgeOk}`}>Terminé</span> : <span className={styles.badge}>À faire</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <div className={styles.grid2}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>L&apos;examen</h2>
          <p className={styles.cardText}>
            {EXAM_SIZE} questions en anglais, {Math.round(PASS_RATIO * 100)} % pour réussir, et aucune erreur éliminatoire.
            {exam?.status === "locked" && ` Termine encore ${exam.remaining} module${exam.remaining > 1 ? "s" : ""} pour le débloquer.`}
            {exam?.status === "cooldown" && ` Nouvelle tentative possible le ${dateFr.format(exam.retryAt)} à ${exam.retryAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`}
          </p>
          {result && (
            <p className={styles.cardText}>
              Dernière tentative : <b>{result.score}/{result.total}</b>{" "}
              {result.passed ? (
                <span className={`${styles.badge} ${styles.badgeOk}`}>Réussi</span>
              ) : (
                <span className={`${styles.badge} ${styles.badgeDanger}`}>{result.criticalFailed ? "Erreur éliminatoire" : "Non réussi"}</span>
              )}
            </p>
          )}
          <Link href="/academy/exam" className={exam?.status === "ready" || exam?.status === "in_progress" ? styles.primary : styles.ghost}>
            {exam?.status === "in_progress" ? "Reprendre l'examen" : "Voir l'examen"}
          </Link>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Ton accréditation</h2>
          {accreditation?.status === "valid" ? (
            <>
              <p className={styles.cardText}>
                <span className={`${styles.badge} ${styles.badgeOk}`}>Accrédité</span> jusqu&apos;au {dateFr.format(accreditation.expiresAt)}.
                Numéro {accreditation.certificateNumber}.
              </p>
              <Link href="/academy/certificate" className={styles.primary}>
                Voir mon certificat
              </Link>
            </>
          ) : (
            <p className={styles.cardText}>
              {accreditation?.status === "expired"
                ? `Ton accréditation a expiré le ${dateFr.format(accreditation.expiresAt)}. Repasse l'examen pour la renouveler.`
                : accreditation?.status === "revoked"
                  ? "Ton accréditation a été retirée. Contacte Centurie."
                  : "Tu n'es pas encore accrédité. Termine les modules et réussis l'examen : tu pourras alors vendre pour Centurie."}
            </p>
          )}
        </section>
      </div>
    </AcademyShell>
  );
}
