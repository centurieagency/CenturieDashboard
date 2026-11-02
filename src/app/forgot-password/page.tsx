import type { Metadata } from "next";

import styles from "@/app/academy/academy.module.css";
import { PayPage } from "@/app/pay/pay-page";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password · Centurie Growth", robots: { index: false } };

export default function ForgotPage() {
  return (
    <PayPage title="Forgot your password?">
      <p className={styles.cardText}>Enter the email of your client space. If it exists, we&apos;ll send you a link to choose a new password.</p>
      <ForgotForm />
    </PayPage>
  );
}
