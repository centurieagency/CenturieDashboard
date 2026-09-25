export const PLANS = [
  { id: "essential", name: "Essential", price: "$650/mo" },
  { id: "growth", name: "Growth", price: "$1,000/mo" },
  { id: "signature", name: "Signature", price: "From $1,350/mo" },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];

export const PLAN_IDS = PLANS.map((p) => p.id) as [PlanId, ...PlanId[]];
