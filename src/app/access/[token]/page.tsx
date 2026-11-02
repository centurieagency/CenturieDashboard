import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/app/academy/academy.module.css";
import { setPasswordAction } from "@/app/pay/actions";
import { PayPage } from "@/app/pay/pay-page";
import { PasswordForm } from "@/app/pay/password-form";
import { findUsableAccessLink } from "@/lib/access";

export const metadata: Metadata = { title: "Set your password · Centurie Growth", robots: { index: false } };

type PageProps = { params: Promise<{ token: string }> };

/** Lien personnel envoyé par l'équipe : définir (ou redéfinir) son mot de passe du dashboard. */
export default async function AccessPage({ params }: PageProps) {
  const { token } = await params;
  const found = await findUsableAccessLink(token);

  return (
    <PayPage title={found ? "Set your password" : "This link is no longer valid"}>
      {found ? (
        <>
          <p className={styles.cardText}>Choose a password to access your Centurie Growth client space.</p>
          <PasswordForm
            email={found.user.email}
            name={found.user.name}
            action={setPasswordAction.bind(null, token)}
            submitLabel="Save and open my client space"
          />
        </>
      ) : (
        <>
          <p className={styles.cardText}>
            This link has expired or was already used. Ask your account manager for a new one, or log in if you already set your
            password.
          </p>
          <Link href="/login" className={styles.primary}>
            Log in
          </Link>
        </>
      )}
    </PayPage>
  );
}
