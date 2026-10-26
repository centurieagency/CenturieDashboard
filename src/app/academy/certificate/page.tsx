import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { accreditationOf, requireAcademy } from "@/lib/academy/academy";
import { AcademyShell } from "../academy-shell";
import styles from "../academy.module.css";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Certificate · Academy · Centurie Growth" };

const dateEn = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default async function CertificatePage() {
  const viewer = await requireAcademy("/academy/certificate");
  const accreditation = viewer.mode === "sales" ? await accreditationOf(viewer.user.id) : null;

  return (
    <AcademyShell viewer={viewer} back={{ href: "/academy", label: "Academy" }}>
      {accreditation?.status === "valid" && viewer.mode === "sales" ? (
        <>
          <section className={styles.certificate}>
            <Image src="/brand/centurie-mark-white.png" alt="" width={70} height={60} style={{ display: "block", margin: "0 auto 14px" }} />
            <span className={styles.eyebrow}>Centurie Growth Academy</span>
            <h1>Certificate of accreditation</h1>
            <p className={styles.lead} style={{ margin: "8px auto 0" }}>
              This certifies that
            </p>
            <p className={styles.certName}>{viewer.user.name ?? viewer.user.email}</p>
            <p className={styles.lead} style={{ margin: "0 auto" }}>
              passed the Centurie Growth partner exam and is accredited to sell Centurie Growth.
            </p>
            <div className={styles.certMeta}>
              <span>
                Certificate number<b>{accreditation.certificateNumber}</b>
              </span>
              <span>
                Issued<b>{dateEn.format(accreditation.issuedAt)}</b>
              </span>
              <span>
                Valid until<b>{dateEn.format(accreditation.expiresAt)}</b>
              </span>
            </div>
          </section>
          <div className={`${styles.actions} ${styles.noPrint}`}>
            <PrintButton className={styles.ghost} />
          </div>
        </>
      ) : (
        <section className={styles.card}>
          <p className={styles.cardText}>No valid accreditation yet.</p>
          <Link href="/academy" className={styles.primary}>
            Back to the Academy
          </Link>
        </section>
      )}
    </AcademyShell>
  );
}
