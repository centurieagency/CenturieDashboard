import type { Metadata } from "next";
import Link from "next/link";

import { accreditationOf, requireAcademy } from "@/lib/academy/academy";
import { COMMISSION_CENTS, PLAN_LABEL, repLinks, repSales, type RepSales } from "@/lib/academy/partner";
import { AcademyShell } from "../academy-shell";
import styles from "../academy.module.css";
import { CopyButton } from "./copy-button";
import partner from "./partner.module.css";

export const metadata: Metadata = { title: "Espace partenaire · Centurie Growth" };

const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
const monthFr = (ym: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`));
const dateFr = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const PRICE = { essential: "650 $", growth: "1 000 $", signature: "1 350 $" } as const;

const STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: "Actif", tone: styles.badgeOk! },
  trialing: { label: "Actif", tone: styles.badgeOk! },
  past_due: { label: "Paiement en retard", tone: styles.badgeWarn! },
  unpaid: { label: "Impayé", tone: styles.badgeDanger! },
  canceled: { label: "Terminé", tone: "" },
  incomplete: { label: "Paiement incomplet", tone: styles.badgeWarn! },
  incomplete_expired: { label: "Paiement expiré", tone: "" },
  paused: { label: "En pause", tone: styles.badgeWarn! },
};

export default async function PartnerPage() {
  const viewer = await requireAcademy("/academy/partner");
  if (viewer.mode !== "sales") {
    return (
      <AcademyShell viewer={viewer} back={{ href: "/academy", label: "Academy" }}>
        <p className={styles.notice}>L&apos;espace partenaire est propre à chaque apporteur. Les commissions de tous sont visibles dans l&apos;admin Academy.</p>
      </AcademyShell>
    );
  }

  const accreditation = await accreditationOf(viewer.user.id);
  let links: Awaited<ReturnType<typeof repLinks>> = null;
  let sales: RepSales | null = null;
  let error = false;
  try {
    [links, sales] = await Promise.all([repLinks(viewer.user), repSales(viewer.user.id)]);
  } catch (e) {
    console.error("Partner space: Stripe read failed", e);
    error = true;
  }

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthCents = sales?.months.find((m) => m.month === thisMonth)?.cents ?? 0;
  const active = sales?.clients.filter((c) => c.status === "active" || c.status === "trialing" || c.status === "past_due").length ?? 0;
  const upcoming = sales?.clients.reduce((s, c) => s + c.remainingCents, 0) ?? 0;

  return (
    <AcademyShell viewer={viewer} back={{ href: "/academy", label: "Academy" }}>
      <header>
        <span className={styles.eyebrow}>Espace partenaire</span>
        <h1 className={styles.title}>Tes ventes et tes commissions</h1>
        <p className={styles.lead}>
          Chaque client qui paie avec tes liens est rattaché à toi automatiquement. Les commissions sont calculées sur les mois
          réellement payés, et versées par virement chaque mois.
        </p>
        {accreditation.status === "valid" && (
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <Link href="/academy/demo" className={styles.primary}>
              Lancer la démo client →
            </Link>
          </div>
        )}
      </header>

      {error && <p className={styles.error}>Les données de paiement sont indisponibles pour le moment. Réessaie dans un instant.</p>}

      <div className={partner.kpis}>
        <div className={partner.kpi}>
          <span>Clients actifs</span>
          <b>{active}</b>
        </div>
        <div className={partner.kpi}>
          <span>Commission ce mois-ci</span>
          <b>{usd(monthCents)}</b>
        </div>
        <div className={partner.kpi}>
          <span>Total gagné</span>
          <b>{usd(sales?.totalCents ?? 0)}</b>
        </div>
        <div className={partner.kpi}>
          <span>À venir sur tes clients actifs</span>
          <b>{usd(upcoming)}</b>
        </div>
      </div>

      <section className={styles.card} aria-labelledby="links-title">
        <h2 id="links-title" className={styles.cardTitle}>
          Tes liens de paiement
        </h2>
        {links ? (
          <>
            <p className={styles.cardText}>
              Envoie le lien de l&apos;offre choisie pendant l&apos;appel de closing. Un lien = un compte Instagram : un client avec deux
              comptes paie deux fois. Le client coche les conditions générales (engagement de 12 mois) avant de payer.
            </p>
            <div className={partner.links}>
              {links.map((l) => (
                <div key={l.plan} className={partner.link}>
                  <div>
                    <b>{PLAN_LABEL[l.plan]}</b>
                    <span>
                      {PRICE[l.plan]} / mois · ta commission {usd(COMMISSION_CENTS[l.plan].early)} puis {usd(COMMISSION_CENTS[l.plan].later)}
                    </span>
                  </div>
                  <code>{l.url}</code>
                  <CopyButton value={l.url} className={styles.ghost} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className={styles.cardText}>
            {accreditation.status === "expired"
              ? "Ton accréditation a expiré : tes liens sont désactivés. Repasse l'examen pour les réactiver."
              : accreditation.status === "revoked"
                ? "Ton accréditation a été retirée : tes liens sont désactivés. Contacte Centurie."
                : "Tes liens personnels apparaissent ici dès que tu as réussi l'examen."}{" "}
            {accreditation.status !== "revoked" && <Link href="/academy">Aller à l&apos;Academy</Link>}
          </p>
        )}
      </section>

      <section className={styles.card} aria-labelledby="clients-title">
        <h2 id="clients-title" className={styles.cardTitle}>
          Tes clients
        </h2>
        {!sales || sales.clients.length === 0 ? (
          <p className={styles.cardText}>Pas encore de client. Ils apparaîtront ici dès leur premier paiement.</p>
        ) : (
          <div className={partner.scroll}>
            <table className={partner.table}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Offre</th>
                  <th>Statut</th>
                  <th>Mois payés</th>
                  <th>Gagné</th>
                </tr>
              </thead>
              <tbody>
                {sales.clients.map((c) => {
                  const s = STATUS[c.status] ?? { label: c.status, tone: "" };
                  return (
                    <tr key={c.subId}>
                      <td>
                        <b>{c.customer}</b>
                        <small>
                          {c.instagram ? `@${c.instagram} · ` : ""}depuis le {dateFr.format(c.startedAt)}
                        </small>
                      </td>
                      <td>{PLAN_LABEL[c.plan]}</td>
                      <td>
                        <span className={`${styles.badge} ${s.tone}`}>{s.label}</span>
                      </td>
                      <td>{Math.min(c.paidMonths, 12)} / 12</td>
                      <td>
                        <b>{usd(c.earnedCents)}</b>
                        {c.remainingCents > 0 && <small>+ {usd(c.remainingCents)} à venir</small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {sales && sales.months.length > 0 && (
        <section className={styles.card} aria-labelledby="months-title">
          <h2 id="months-title" className={styles.cardTitle}>
            Commissions par mois
          </h2>
          <ul className={partner.months}>
            {sales.months.map((m) => (
              <li key={m.month}>
                <span>{monthFr(m.month)}</span>
                <b>{usd(m.cents)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AcademyShell>
  );
}
