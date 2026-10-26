import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { completedModules, requireAcademy } from "@/lib/academy/academy";
import { getCourse, getModule } from "@/lib/academy/content";
import { completeModuleAction } from "../actions";
import { AcademyShell } from "../academy-shell";
import styles from "../academy.module.css";

type PageProps = { params: Promise<{ module: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const mod = getModule((await params).module);
  return { title: mod ? `${mod.title} · Academy · Centurie Growth` : "Academy · Centurie Growth" };
}

export default async function ModulePage({ params }: PageProps) {
  const { module: slug } = await params;
  const viewer = await requireAcademy(`/academy/${slug}`);
  const mod = getModule(slug);
  if (!mod) notFound();

  const { modules } = getCourse();
  const index = modules.findIndex((m) => m.slug === slug);
  const prev = modules[index - 1];
  const next = modules[index + 1];
  const done = viewer.mode === "sales" ? (await completedModules(viewer.user.id)).has(slug) : false;
  const nextHref = next ? `/academy/${next.slug}` : "/academy";

  return (
    <AcademyShell viewer={viewer} back={{ href: "/academy", label: "Academy" }}>
      <header>
        <span className={styles.eyebrow}>
          Module {mod.number} sur {modules.length}
        </span>
        <h1 className={styles.title}>{mod.title}</h1>
      </header>

      <article className={`${styles.card} ${styles.prose}`} dangerouslySetInnerHTML={{ __html: mod.html }} />

      {mod.quiz.length > 0 && (
        <section className={styles.card} aria-labelledby="quiz-title">
          <h2 id="quiz-title" className={styles.cardTitle}>
            Vérifie que c&apos;est acquis
          </h2>
          <p className={styles.cardText}>Réponds dans ta tête, puis ouvre la question pour comparer.</p>
          <div className={styles.quiz}>
            {mod.quiz.map((q, i) => (
              <details key={i} className={styles.quizItem}>
                <summary>
                  {i + 1}. {q.question}
                  <span>Voir la réponse</span>
                </summary>
                <p>{q.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <form action={completeModuleAction.bind(null, slug, nextHref)} className={styles.actions}>
        <button type="submit" className={styles.primary}>
          {done ? (next ? "Module suivant →" : "Retour à l'Academy") : next ? "J'ai compris, module suivant →" : "J'ai compris, terminer le cours"}
        </button>
        {done && <span className={`${styles.badge} ${styles.badgeOk}`}>Module terminé</span>}
      </form>

      <nav className={styles.pager} aria-label="Modules">
        {prev ? (
          <Link href={`/academy/${prev.slug}`} className={styles.ghost}>
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/academy/${next.slug}`} className={styles.ghost}>
            {next.title} →
          </Link>
        )}
      </nav>
    </AcademyShell>
  );
}
