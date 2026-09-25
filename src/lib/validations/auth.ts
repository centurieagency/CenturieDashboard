import { z } from "zod";

import { PLAN_IDS } from "@/lib/plans";

export const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100, "Use 100 characters or fewer."),
  businessName: z.string().trim().min(1, "Enter your business name.").max(120, "Use 120 characters or fewer."),
  instagramHandle: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, ""))
    .pipe(z.string().regex(/^[A-Za-z0-9._]{1,30}$/, "Enter a valid Instagram username.")),
  email: z.email("Enter a valid email address.").max(254, "Enter a valid email address."),
  // bcrypt ne prend en compte que les 72 premiers octets.
  password: z.string().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer."),
  plan: z.enum(PLAN_IDS, "Choose a plan."),
  terms: z.literal(true, "You need to accept the Terms and Privacy Policy."),
});

export type SignupInput = z.input<typeof signupSchema>;
export type SignupField = keyof SignupInput;
