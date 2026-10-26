import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/app/academy/academy.module.css";
import { SiteHeader } from "@/components/site-header";
import { listSalesOverview } from "@/lib/academy/academy";
import { requireAdmin } from "@/lib/admin";
import { revokeAccreditationAction, revokeInviteAction } from "./actions";
import { InviteForm } from "./invite-form";
import table from "./table.module.css";

export const metadata: Metadata = { title: "Academy · Admin · Centurie Growth" };

const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function AdminAcademyPage() {
  const session = await requireAdmin("/admin/academy");
  const { rows, invites } = await listSalesOverview();
  const accredited = rows.filter((r) => r.accreditation.status === "valid").length;

  return (
    <div className={styles.page}>
      <SiteHeader email={session.user.email} admin />
      <main className={styles.main} style={{ maxWidth: 1180 }}>
        <Link href="/admin" className={styles.back}>
          ← All subscriptions
        </Link>
        <header>
          <span className={styles.eyebrow}>Admin · Academy</span>
          <h1 className={styles.title}>Sales partners</h1>
          <p className={styles.lead}>
            {rows.length} partner{rows.length === 1 ? "" : "s"}, {accredited} accredited.{" "}
            <Link href="/academy">Preview the course</Link>.
          </p>
        </header>

        <section className={styles.card} aria-labelledby="invite-title">
          <h2 id="invite-title" className={styles.cardTitle}>
            Invite a partner
          </h2>
          <p className={styles.cardText}>
            Partners can only create an account through a personal invitation link. Their account gives access to the Academy
            only, never to client data.
          </p>
          <InviteForm />
        </section>

        {invites.length > 0 && (
          <section className={styles.card} aria-labelledby="pending-title">
            <h2 id="pending-title" className={styles.cardTitle}>
              Pending invitations
            </h2>
            <ul className={table.list}>
              {invites.map((i) => (
                <li key={i.id} className={table.row}>
                  <span>
                    <b>{i.name ?? i.email}</b>
                    {i.name && <small>{i.email}</small>}
                  </span>
                  <span className={table.muted}>Expires {date.format(i.expiresAt)}</span>
                  <form action={revokeInviteAction.bind(null, i.id)}>
                    <button type="submit" className={styles.ghost}>
                      Cancel
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.card} aria-labelledby="partners-title">
          <h2 id="partners-title" className={styles.cardTitle}>
            Partners
          </h2>
          {rows.length === 0 ? (
            <p className={styles.cardText}>No partner yet. Invite one above.</p>
          ) : (
            <div className={table.scroll}>
              <table className={table.table}>
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Course</th>
                    <th>Last exam</th>
                    <th>Accreditation</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <b>{r.name ?? r.email}</b>
                        <small>{r.email}</small>
                      </td>
                      <td>
                        {r.modulesDone}/{r.moduleCount} modules
                      </td>
                      <td>
                        {r.result ? (
                          <>
                            {r.result.score}/{r.result.total}{" "}
                            <span className={`${styles.badge} ${r.result.passed ? styles.badgeOk : styles.badgeDanger}`}>
                              {r.result.passed ? "Passed" : r.result.criticalFailed ? "Critical error" : "Failed"}
                            </span>
                            <small>
                              {r.attempts} attempt{r.attempts === 1 ? "" : "s"}
                            </small>
                          </>
                        ) : (
                          <span className={table.muted}>Not taken</span>
                        )}
                      </td>
                      <td>
                        {r.accreditation.status === "valid" ? (
                          <>
                            <span className={`${styles.badge} ${styles.badgeOk}`}>Valid</span>
                            <small>
                              {r.accreditation.certificateNumber} · until {date.format(r.accreditation.expiresAt)}
                            </small>
                          </>
                        ) : r.accreditation.status === "expired" ? (
                          <span className={`${styles.badge} ${styles.badgeWarn}`}>Expired</span>
                        ) : r.accreditation.status === "revoked" ? (
                          <span className={`${styles.badge} ${styles.badgeDanger}`}>Revoked</span>
                        ) : (
                          <span className={table.muted}>Not accredited</span>
                        )}
                      </td>
                      <td>
                        {r.accreditation.status === "valid" && (
                          <form action={revokeAccreditationAction.bind(null, r.id)}>
                            <button type="submit" className={styles.ghost}>
                              Revoke
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
