import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/app/academy/academy.module.css";
import { SiteHeader } from "@/components/site-header";
import { listSalesOverview } from "@/lib/academy/academy";
import { repSales } from "@/lib/academy/partner";
import { requireAdmin } from "@/lib/admin";
import { revokeAccreditationAction, revokeInviteAction } from "./actions";
import { InviteForm } from "./invite-form";
import table from "./table.module.css";

export const metadata: Metadata = { title: "Academy · Admin · Centurie Growth" };

const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
const monthEn = (ym: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`));

export default async function AdminAcademyPage() {
  const session = await requireAdmin("/admin/academy");
  const { rows, invites } = await listSalesOverview();
  const accredited = rows.filter((r) => r.accreditation.status === "valid").length;

  // Commissions : uniquement les mois réellement payés (Stripe), rattachés par le lien personnel de l'apporteur.
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const commissions = await Promise.all(
    rows.map(async (r) => {
      try {
        const s = await repSales(r.id);
        const pick = (m: string) => s.months.find((x) => x.month === m)?.cents ?? 0;
        const active = s.clients.filter((c) => ["active", "trialing", "past_due"].includes(c.status)).length;
        return { id: r.id, name: r.name ?? r.email, active, clients: s.clients.length, thisMonth: pick(thisMonth), lastMonth: pick(lastMonth), total: s.totalCents };
      } catch (error) {
        console.error("Rep sales lookup failed", error);
        return { id: r.id, name: r.name ?? r.email, active: 0, clients: 0, thisMonth: 0, lastMonth: 0, total: 0, error: true };
      }
    }),
  );
  const sum = (k: "thisMonth" | "lastMonth" | "total") => commissions.reduce((s, c) => s + c[k], 0);

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
            {rows.length} partner{rows.length === 1 ? "" : "s"}, {accredited} accredited.
          </p>
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <Link href="/academy/demo" className={styles.primary}>
              Launch a closing demo →
            </Link>
            <Link href="/academy" className={styles.ghost}>
              Preview the course
            </Link>
          </div>
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

        {rows.length > 0 && (
          <section className={styles.card} aria-labelledby="commissions-title">
            <h2 id="commissions-title" className={styles.cardTitle}>
              Commissions to pay
            </h2>
            <p className={styles.cardText}>
              Based on invoices actually paid by each partner&apos;s clients: one transfer per partner per month.
            </p>
            <div className={table.scroll}>
              <table className={table.table}>
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Clients</th>
                    <th>{monthEn(lastMonth)}</th>
                    <th>{monthEn(thisMonth)} (so far)</th>
                    <th>Total paid out</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <b>{c.name}</b>
                        {"error" in c && <small>Stripe data unavailable</small>}
                      </td>
                      <td>
                        {c.active} active
                        <small>{c.clients} in total</small>
                      </td>
                      <td>
                        <b>{usd(c.lastMonth)}</b>
                      </td>
                      <td>{usd(c.thisMonth)}</td>
                      <td>{usd(c.total)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <b>Total</b>
                    </td>
                    <td />
                    <td>
                      <b>{usd(sum("lastMonth"))}</b>
                    </td>
                    <td>{usd(sum("thisMonth"))}</td>
                    <td>{usd(sum("total"))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
