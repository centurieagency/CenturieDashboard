import bcrypt from "bcryptjs";
import type { NextAuthOptions, User } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { env } from "@/lib/env";
import {
  ensureCenturieToken,
  ensureStripeCustomer,
  findUserByEmail,
  PASSWORD_HASH_ROUNDS,
  upsertOAuthUser,
} from "@/lib/users";
import { credentialsSchema, type CredentialsInput } from "@/lib/validations/auth";

// Hash factice : on compare quand même quand l'email est inconnu, pour ne pas révéler son existence par le temps de réponse.
let dummyHash: Promise<string> | undefined;

async function verifyCredentials({ email, password }: CredentialsInput): Promise<User | null> {
  const user = await findUserByEmail(email);
  dummyHash ??= bcrypt.hash("not-a-real-password", PASSWORD_HASH_ROUNDS);
  const valid = await bcrypt.compare(password, user?.passwordHash ?? (await dummyHash));
  if (!user?.passwordHash || !valid) return null;
  return { id: user.id, email: user.email, name: user.name };
}

export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        return verifyCredentials(parsed.data);
      },
    }),
  ],
  callbacks: {
    signIn({ account, profile }) {
      // On relie le compte à Stripe par email : il doit donc être vérifié par Google.
      if (account?.provider === "google") {
        return (profile as { email_verified?: boolean } | undefined)?.email_verified === true;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user?.email) {
        const dbUser =
          account?.provider === "google"
            ? await upsertOAuthUser({ email: user.email, name: user.name })
            : await findUserByEmail(user.email);
        if (!dbUser) throw new Error("Signed-in user not found");
        token.id = dbUser.id;
        // À la connexion : on retrouve le client Stripe existant, sinon on le crée.
        try {
          token.stripeCustomerId = await ensureStripeCustomer(dbUser);
          // Token client de l'API Centurie pour ce client Stripe (stocké en base, jamais dans la session).
          await ensureCenturieToken(dbUser);
        } catch (error) {
          console.error("Stripe customer / Centurie token setup failed", error);
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.stripeCustomerId = token.stripeCustomerId;
      }
      return session;
    },
  },
};

export const auth = () => getServerSession(authOptions);
