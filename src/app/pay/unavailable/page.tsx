import type { Metadata } from "next";

import styles from "@/app/academy/academy.module.css";
import { PayPage } from "../pay-page";

export const metadata: Metadata = { title: "Payment link unavailable · Centurie Growth", robots: { index: false } };

type PageProps = { searchParams: Promise<{ error?: string }> };

export default async function PayUnavailablePage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  return (
    <PayPage title={error ? "Payment page unavailable" : "This payment link is no longer valid"}>
      <p className={styles.cardText}>
        {error
          ? "We couldn't open the payment page right now. Please try again in a moment."
          : "Please ask your Centurie Growth contact for a new link, or contact us at centurie.agency@gmail.com."}
      </p>
    </PayPage>
  );
}
