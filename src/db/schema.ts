import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const planInterest = pgEnum("plan_interest", ["essential", "growth", "signature"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Toujours stocké en minuscules. */
  email: text("email").notNull().unique(),
  name: text("name"),
  businessName: text("business_name"),
  instagramHandle: text("instagram_handle"),
  planInterest: planInterest("plan_interest"),
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
