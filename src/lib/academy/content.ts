import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { marked } from "marked";

/**
 * Contenu de l'Academy, lu depuis content/academy/ (source unique, relue par Centurie) :
 * - cours-fr.md : intro, puis un module par titre « ## Module N : … », puis « ## L'examen final » ;
 * - exam-en.md : banque de questions (bonne réponse ✅, réponse interdite ⛔ sur les questions CRITICAL).
 * Les bonnes réponses ne quittent jamais le serveur : voir publicQuestion().
 */

const DIR = path.join(process.cwd(), "content", "academy");

export type MiniQuiz = { question: string; answer: string }[];

export type CourseModule = {
  slug: string;
  number: number;
  title: string;
  /** HTML du module, sans le mini-quiz. */
  html: string;
  quiz: MiniQuiz;
};

export type Course = { introHtml: string; modules: CourseModule[]; examHtml: string };

export type ExamOption = { key: string; text: string; correct: boolean; forbidden: boolean };
export type ExamQuestion = { id: string; section: string; text: string; critical: boolean; options: ExamOption[] };

/** Question telle qu'envoyée au navigateur : sans aucune indication de bonne ou de mauvaise réponse. */
export type PublicQuestion = { id: string; text: string; options: { key: string; text: string }[] };

const toHtml = (md: string) => marked.parse(md.trim(), { async: false, gfm: true });

function parseQuiz(md: string): MiniQuiz {
  const quiz: MiniQuiz = [];
  for (const line of md.split("\n")) {
    const m = line.match(/^\d+\.\s+(.*?)\s*\*\((.*)\)\*\s*$/);
    if (m) quiz.push({ question: m[1]!, answer: m[2]! });
  }
  return quiz;
}

function parseCourse(md: string): Course {
  const parts = md.replace(/\r\n/g, "\n").split(/\n(?=## )/);
  // Intro : tout avant le premier « ## », sans le titre principal ni les séparateurs.
  const intro = parts[0]!.replace(/^# .*\n/, "").replace(/\n---\s*$/gm, "");
  const modules: CourseModule[] = [];
  let examHtml = "";
  for (const part of parts.slice(1)) {
    const [heading, ...rest] = part.split("\n");
    const body = rest.join("\n").replace(/\n---\s*$/, "");
    const mod = heading!.match(/^## Module (\d+)\s*:\s*(.*)$/);
    if (mod) {
      const [content, quizMd = ""] = body.split(/\n### Mini-quiz\s*\n/);
      modules.push({
        slug: `module-${mod[1]}`,
        number: Number(mod[1]),
        title: mod[2]!.trim(),
        html: toHtml(content!),
        quiz: parseQuiz(quizMd),
      });
    } else if (/examen/i.test(heading!)) {
      examHtml = toHtml(body);
    }
  }
  return { introHtml: toHtml(intro), modules, examHtml };
}

function parseExam(md: string): ExamQuestion[] {
  const questions: ExamQuestion[] = [];
  let section = "";
  let current: ExamQuestion | null = null;
  for (const raw of md.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const sec = line.match(/^## [A-Z]\.\s+(.*)$/);
    if (sec) {
      section = sec[1]!;
      continue;
    }
    const q = line.match(/^\*\*([A-Z]\d+)\.\*\*\s+(.*)$/);
    if (q) {
      const critical = /\(\*\*CRITICAL\*\*\)/.test(q[2]!);
      current = { id: q[1]!, section, critical, text: q[2]!.replace(/\(\*\*CRITICAL\*\*\)\s*/, "").trim(), options: [] };
      questions.push(current);
      continue;
    }
    const o = line.match(/^-\s+(✅|⛔)?\s*([a-d])\)\s+(.*)$/u);
    if (o && current) current.options.push({ key: o[2]!, text: o[3]!, correct: o[1] === "✅", forbidden: o[1] === "⛔" });
  }
  // Garde-fou : une question mal écrite (zéro ou plusieurs bonnes réponses) ne doit jamais partir à l'examen.
  return questions.filter((q) => q.options.length >= 2 && q.options.filter((o) => o.correct).length === 1);
}

let cached: { course: Course; exam: ExamQuestion[] } | null = null;

function load() {
  // En dev, on relit à chaque fois pour voir les corrections du contenu sans redémarrer.
  if (cached && process.env.NODE_ENV === "production") return cached;
  cached = {
    course: parseCourse(readFileSync(path.join(DIR, "cours-fr.md"), "utf8")),
    exam: parseExam(readFileSync(path.join(DIR, "exam-en.md"), "utf8")),
  };
  return cached;
}

export const getCourse = () => load().course;
export const getModule = (slug: string) => load().course.modules.find((m) => m.slug === slug);
export const getExamBank = () => load().exam;

export const publicQuestion = (q: ExamQuestion): PublicQuestion => ({
  id: q.id,
  text: q.text,
  options: q.options.map((o) => ({ key: o.key, text: o.text })),
});
