import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireCustomer } from "@/lib/customer";
import { AccountView, isSubId, parsePeriod } from "./account-view";

export const metadata: Metadata = { title: "Instagram account · Centurie Growth" };

type PageProps = { params: Promise<{ subId: string }>; searchParams: Promise<{ days?: string }> };

export default async function AccountPage({ params, searchParams }: PageProps) {
  const { subId } = await params;
  if (!isSubId(subId)) notFound();
  const days = parsePeriod((await searchParams).days);

  const { user, apiToken } = await requireCustomer(`/accounts/${subId}`);
  if (!apiToken) notFound();

  // Le token client ne voit que les comptes de ce client : tout autre sub_id donne une 404.
  return <AccountView subId={subId} days={days} token={apiToken} basePath="" email={user.email} />;
}
