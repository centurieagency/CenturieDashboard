import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccountView, isSubId, parsePeriod } from "@/app/accounts/[subId]/account-view";
import { requireAdmin } from "@/lib/admin";
import { env } from "@/lib/env";
import { getSubscriptionCustomer } from "@/lib/stripe";

export const metadata: Metadata = { title: "Instagram account · Admin · Centurie Growth" };

type PageProps = { params: Promise<{ subId: string }>; searchParams: Promise<{ days?: string }> };

export default async function AdminAccountPage({ params, searchParams }: PageProps) {
  const { subId } = await params;
  const session = await requireAdmin(`/admin/accounts/${subId}`);
  if (!isSubId(subId)) notFound();
  const days = parsePeriod((await searchParams).days);

  const customer = await getSubscriptionCustomer(subId).catch((error: unknown) => {
    console.error("Stripe subscription customer lookup failed", error);
    return null;
  });

  return (
    <AccountView
      subId={subId}
      days={days}
      token={env.CENTURIE_API_TOKEN}
      basePath="/admin"
      email={session.user.email}
      customer={customer}
    />
  );
}
