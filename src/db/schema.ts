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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
