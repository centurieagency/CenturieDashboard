import type { Metadata } from "next";

import styles from "@/app/academy/academy.module.css";
import { PayPage } from "../pay-page";

export const metadata: Metadata = { title: "Welcome · Centurie Growth", robots: { index: false } };

export default function PaySuccessPage() {
  return (
    <PayPage title="Welcome to Centurie Growth">
      <p className={styles.cardText}>
        Your payment went through and your subscription is active. Our team will contact you shortly to securely connect your
        Instagram account. Growth starts within a day of the connection.
      </p>
      <p className={styles.cardText}>A receipt has been sent to your email address.</p>
    </PayPage>
  );
}
