import { SubscriptionsView, type ListParams } from "@/components/dashboard/subscriptions-view";
import styles from "@/components/dashboard/subscriptions.module.css";
import { SiteHeader } from "@/components/site-header";
import { requireCustomer } from "@/lib/customer";
import { loadCustomerAccounts, loadCustomerSubscriptions } from "@/lib/dashboard-data";

type HomeProps = { searchParams: Promise<ListParams> };

export default async function HomePage({ searchParams }: HomeProps) {
  const params = await searchParams;
  const { user, customerId, apiToken } = await requireCustomer("/");
  const [subscriptions, accounts] = customerId
    ? await Promise.all([loadCustomerSubscriptions(customerId), loadCustomerAccounts(apiToken)])
    : [{ ok: false as const }, null];

  return (
    <div className={styles.page}>
      <SiteHeader email={user.email ?? user.name} />
      <SubscriptionsView
        subscriptions={subscriptions}
        accounts={accounts}
        params={params}
        basePath=""
        filters={false}
        readOnly
        head={
          <div className={styles.head}>
            <span className={styles.eyebrow}>Client space</span>
            <h1 className={styles.title}>Your subscriptions</h1>
            <dl className={styles.meta}>
              <dt>Customer ID</dt>
              <dd>
                <code className={styles.code}>{customerId ?? "Not available"}</code>
              </dd>
            </dl>
          </div>
        }
      />
    </div>
  );
}
