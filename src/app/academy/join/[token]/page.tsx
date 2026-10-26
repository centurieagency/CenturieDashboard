import type { Metadata } from "next";
import Link from "next/link";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { findUsableInvite } from "@/lib/academy/academy";
import styles from "../../academy.module.css";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Rejoindre l'Academy · Centurie Growth", robots: { index: false } };

type PageProps = { params: Promise<{ token: string }> };

/** Page publique : seul le lien d'invitation (jeton secret) permet de créer un compte apporteur. */
export default async function JoinPage({ params }: PageProps) {
  const { token } = await params;
  const invite = await findUsableInvite(token);

  return (
    <div className={styles.page}>
      <main className={styles.main} style={{ maxWidth: 520 }}>
        <BrandLockup tone="dark" size="lg" />
        {invite ? (
          <>
            <header>
              <span className={styles.eyebrow}>Centurie Growth Academy</span>
              <h1 className={styles.title}>Rejoins le réseau de partenaires</h1>
              <p className={styles.lead}>
                Crée ton compte pour suivre la formation. Une fois l&apos;examen réussi, tu seras accrédité pour vendre Centurie
                Growth.
              </p>
            </header>
            <section className={styles.card}>
              <JoinForm token={token} email={invite.email} name={invite.name} />
            </section>
          </>
        ) : (
          <section className={styles.card}>
            <h1 className={styles.cardTitle}>Invitation non valable</h1>
            <p className={styles.cardText}>
              Ce lien a expiré, a déjà été utilisé ou a été retiré. Demande un nouveau lien à Centurie. Si tu as déjà un compte,
              connecte-toi.
            </p>
            <Link href="/login?callbackUrl=/academy" className={styles.primary}>
              Se connecter
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
