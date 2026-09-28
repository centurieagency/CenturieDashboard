import type { Metadata } from "next";

import { SubscriptionsView, type ListParams } from "@/components/dashboard/subscriptions-view";
import styles from "@/components/dashboard/subscriptions.module.css";
import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/admin";
import { loadAllAccounts, loadAllSubscriptions } from "@/lib/dashboard-data";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Admin · Centurie Growth" };

type AdminProps = { searchParams: Promise<ListParams & { deleted?: string }> };

export default async function AdminPage({ searchParams }: AdminProps) {
  const session = await requireAdmin("/admin");
  const params = await searchParams;
  // Confirmation après suppression (texte affiché tel quel, jamais interprété comme HTML).
  const deleted = params.deleted?.slice(0, 80);
  const [subscriptions, accounts] = await Promise.all([
    loadAllSubscriptions(),
    loadAllAccounts(env.CENTURIE_API_TOKEN),
  ]);

  const clients = subscriptions.ok ? new Set(subscriptions.data.map((s) => s.customer?.id)).size : 0;
  const linked = accounts ? [...accounts.values()].filter((a) => a.account.username).length : 0;

  return (
    <div className={styles.page}>
      <SiteHeader email={session.user.email} admin />
      <SubscriptionsView
        subscriptions={subscriptions}
        accounts={accounts}
        params={params}
        basePath="/admin"
        showCustomer
        notice={deleted ? `${deleted} was deleted and its Stripe subscription cancelled.` : undefined}
        head={
          <div className={styles.head}>
            <span className={styles.eyebrow}>Admin</span>
            <h1 className={styles.title}>All subscriptions</h1>
            <dl className={styles.meta}>
              <dt>Clients</dt>
              <dd>
                <strong>{clients}</strong>
              </dd>
              <dt>Subscriptions</dt>
              <dd>
                <strong>{subscriptions.ok ? subscriptions.data.length : "–"}</strong>
              </dd>
              <dt>Instagram accounts</dt>
              <dd>
                <strong>{accounts ? linked : "–"}</strong>
              </dd>
            </dl>
          </div>
        }
      />
    </div>
  );
}
