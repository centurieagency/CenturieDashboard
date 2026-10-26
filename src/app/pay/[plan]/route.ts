import { NextResponse } from "next/server";

import { accreditationOf } from "@/lib/academy/academy";
import { createCheckoutUrl } from "@/lib/academy/partner";
import { db } from "@/db";
import { PLAN_IDS, type PlanId } from "@/lib/plans";

/**
 * Lien de paiement public : /pay/{offre}[?rep={id apporteur}].
 * Crée une page Stripe Checkout en dollars (sans conversion de devise) et y redirige.
 * Un lien d'apporteur ne marche que tant que son accréditation est valable.
 */
export async function GET(request: Request, { params }: { params: Promise<{ plan: string }> }) {
  const { plan } = await params;
  const origin = new URL(request.url).origin;
  if (!(PLAN_IDS as readonly string[]).includes(plan)) return NextResponse.redirect("https://www.centuriegrowth.com/#plans", 303);

  const repId = new URL(request.url).searchParams.get("rep");
  let rep: { id: string; email: string } | undefined;
  if (repId) {
    const user = /^[0-9a-f-]{36}$/.test(repId)
      ? await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, repId), columns: { id: true, email: true, role: true } })
      : undefined;
    if (!user || user.role !== "sales" || (await accreditationOf(user.id)).status !== "valid") {
      return NextResponse.redirect(`${origin}/pay/unavailable`, 303);
    }
    rep = { id: user.id, email: user.email };
  }

  try {
    return NextResponse.redirect(await createCheckoutUrl(plan as PlanId, origin, rep), 303);
  } catch (error) {
    console.error("Stripe Checkout creation failed", error);
    return NextResponse.redirect(`${origin}/pay/unavailable?error=1`, 303);
  }
}
