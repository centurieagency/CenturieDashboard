import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string; stripeCustomerId?: string };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    stripeCustomerId?: string;
  }
}
