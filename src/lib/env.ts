import "server-only";

import { z } from "zod";

const envSchema = z.object({
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.url().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  DATABASE_URL: z.url(),
  CENTURIE_API_TOKEN: z.string().startsWith("CENTURIE-ADMIN-"),
  STRIPE_SECRET_KEY: z.string().regex(/^(sk|rk)_(test|live)_/),
});

export const env = envSchema.parse(process.env);
