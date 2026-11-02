import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/app/academy/academy.module.css";
import { checkoutClaim, saveInstagramFromCheckout } from "@/lib/access";
import { claimAccountAction } from "../actions";
import { PayPage } from "../pay-page";
import { PasswordForm } from "../password-form";

export const metadata: Metadata = { title: "Welcome · Centurie Growth", robots: { index: false } };

type PageProps = { searchParams: Promise<{ session_id?: string }> };

/** Après paiement : confirmation, puis création du compte client relié à ce paiement. */
export default async function PaySuccessPage({ searchParams }: PageProps) {
  const { session_id: sessionId } = await searchParams;
  const claim = sessionId ? await checkoutClaim(sessionId) : ({ status: "invalid" } as const);
  if ("session" in claim && claim.session) await saveInstagramFromCheckout(claim.session);

  return (
    <PayPage title="Welcome to Centurie Growth">
      <p className={styles.cardText}>
        Your payment went through and your subscription is active. A receipt has been sent to your email address.
      </p>

      {claim.status === "claimable" && (
        <>
          <p className={styles.cardText}>
            <b>Last step: create your client space.</b> That&apos;s where you connect your Instagram account securely and follow
            your growth.
          </p>
          <PasswordForm
            email={claim.email}
            name={claim.name}
            action={claimAccountAction.bind(null, sessionId!)}
            submitLabel="Create my client space"
          />
        </>
      )}

      {claim.status === "existing" && (
        <>
          <p className={styles.cardText}>
            You already have a client space with {claim.email}. Log in to connect your Instagram account and follow your growth.
          </p>
          <Link href="/login" className={styles.primary}>
            Log in
          </Link>
        </>
      )}

      {claim.status === "conflict" && (
        <p className={styles.cardText}>
          An account already exists with {claim.email}. Our team will add this subscription to it and contact you shortly.
        </p>
      )}

      {claim.status === "invalid" && (
        <p className={styles.cardText}>
          Our team will contact you shortly to set up your client space and connect your Instagram account.
        </p>
      )}
    </PayPage>
  );
}
