import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      stripeCustomerId?: string;
      /** Fournisseur de la connexion en cours ("google" | "credentials"). */
      provider?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    stripeCustomerId?: string;
    provider?: string;
  }
}
