import { boolean, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const planInterest = pgEnum("plan_interest", ["essential", "growth", "signature"]);

/** client : espace abonnements · sales : apporteur d'affaires, n'a accès qu'à l'Academy (jamais de client Stripe). */
export const userRole = pgEnum("user_role", ["client", "sales"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Toujours stocké en minuscules. */
  email: text("email").notNull().unique(),
  name: text("name"),
  businessName: text("business_name"),
  instagramHandle: text("instagram_handle"),
  planInterest: planInterest("plan_interest"),
  role: userRole("role").notNull().default("client"),
  /** Null pour les comptes créés via Google. */
  passwordHash: text("password_hash"),
  stripeCustomerId: text("stripe_customer_id"),
  /** Token client `cbk_` de l'API Centurie (secret, serveur uniquement). */
  centurieToken: text("centurie_token"),
  /** Client Stripe pour lequel `centurieToken` a été émis : s'il diffère de `stripeCustomerId`, on le régénère. */
  centurieTokenCustomerId: text("centurie_token_customer_id"),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Abonnements retirés du dashboard par l'admin. Stripe ne permet pas de supprimer un abonnement résilié :
 * on le masque ici, sans rien toucher dans Stripe (réversible en supprimant la ligne).
 */
export const hiddenSubscriptions = pgTable("hidden_subscriptions", {
  subId: text("sub_id").primaryKey(),
  hiddenBy: text("hidden_by").notNull(),
  hiddenAt: timestamp("hidden_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Academy (apporteurs d'affaires) ----------

/**
 * Invitations créées par l'admin. Le lien contient un jeton secret ; seul son hash SHA-256 est stocké.
 * C'est la possession du lien qui prouve l'identité (l'inscription par formulaire ne vérifie pas l'email).
 */
export const salesInvites = pgTable("sales_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

/** Modules du cours terminés par un apporteur. */
export const academyProgress = pgTable(
  "academy_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    module: text("module").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.module] })],
);

/** Tentatives d'examen : questions tirées au début, réponses et note à la remise (corrigées côté serveur). */
export const examAttempts = pgTable("exam_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  questionIds: jsonb("question_ids").$type<string[]>().notNull(),
  answers: jsonb("answers").$type<Record<string, string>>(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  score: integer("score"),
  total: integer("total"),
  criticalFailed: boolean("critical_failed"),
  passed: boolean("passed"),
});

/** Accréditations délivrées après un examen réussi (valables 12 mois, révocables par l'admin). */
export const accreditations = pgTable("accreditations", {
  id: uuid("id").primaryKey().defaultRandom(),
  certificateNumber: text("certificate_number").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  attemptId: uuid("attempt_id").references(() => examAttempts.id, { onDelete: "set null" }),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
