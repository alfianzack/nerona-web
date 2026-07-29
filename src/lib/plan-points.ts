import { prisma } from "@/lib/prisma";

export type PlanProduct = "metadata" | "agent";

/**
 * Points granted when a plan is activated or renewed. Set by the owner.
 *
 * Free is a LIFETIME trial, not a monthly allowance: an account receives it
 * once and never again — see hasEverReceivedPlanGrant and the free activation
 * paths in orders.ts. When it runs out the user upgrades. Paid plans are the
 * opposite: credited on every activation and every renewal.
 *
 * Free is deliberately far below Pro. It has to be — a Free allowance that
 * matches or beats Pro makes paying pointless, which is what the earlier
 * figures did once these paid numbers were chosen.
 *
 * These are defaults only. The owner overrides them per plan in Pengaturan;
 * see pointsForPlan for the resolution order.
 */
export const DEFAULT_PLAN_POINTS: Record<PlanProduct, Record<string, number>> = {
  metadata: { free: 10, pro: 500, business: 1_000 },
  agent: { free: 15, pro: 600, business: 1_500 },
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

const PRODUCT_LABELS: Record<PlanProduct, string> = {
  metadata: "Metadata",
  agent: "Agent",
};

/**
 * Metadata plans live in the Plan table capitalised ("Pro"); agent plans are
 * stored lowercase. Every allowance lookup goes through here — a raw "Pro"
 * would resolve to no allowance and grant nothing, silently.
 */
export function normalizePlan(name: string): string {
  return name.trim().toLowerCase();
}

/** One flat Setting key per product and plan, matching the ai_* key style. */
export function settingKey(product: PlanProduct, plan: string): string {
  return `points_plan_${product}_${normalizePlan(plan)}`;
}

function envKey(product: PlanProduct, plan: string): string {
  return `POINTS_PLAN_${product.toUpperCase()}_${normalizePlan(plan).toUpperCase()}`;
}

/**
 * An allowance counts only when it is a finite integer >= 0 — the same rule
 * ai-settings.ts applies to rates. Blank, negative, and non-numeric are treated
 * as unset so the next source in the chain applies.
 *
 * Zero is legitimate: a plan that grants nothing. It must not read as unset.
 */
function parseAllowance(raw: string | undefined): number | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

/** DB → env → code default. 0 for an unknown plan — never guess an allowance. */
export async function pointsForPlan(product: PlanProduct, plan: string): Promise<number> {
  const key = normalizePlan(plan);
  const fallback = DEFAULT_PLAN_POINTS[product]?.[key];
  // An unknown plan has no allowance to configure, so there is nothing to read.
  if (fallback === undefined) return 0;

  const row = await prisma.setting.findUnique({ where: { key: settingKey(product, key) } });
  return (
    parseAllowance(row?.value) ?? parseAllowance(process.env[envKey(product, key)]) ?? fallback
  );
}

/**
 * Credits a plan's allowance to the tenant's wallet. Additive on purpose: the
 * ledger is append-only, unused points carry over, and points the tenant bought
 * separately are never destroyed.
 *
 * Returns the amount credited (0 when the plan has no allowance).
 */
export async function creditPlanPoints(params: {
  userId: string;
  product: PlanProduct;
  plan: string;
  createdById?: string | null;
  isRenewal?: boolean;
}): Promise<number> {
  const plan = normalizePlan(params.plan);
  const amount = await pointsForPlan(params.product, plan);
  if (amount <= 0) return 0;

  // The product belongs in the note: both products have a Free, Pro, and
  // Business, so "Bonus paket Pro" alone does not say which wallet grew.
  const label = `${PRODUCT_LABELS[params.product]} ${PLAN_LABELS[plan] ?? plan}`;
  await prisma.pointTransaction.create({
    data: {
      userId: params.userId,
      delta: amount,
      reason: "plan_grant",
      note: `${params.isRenewal ? "Perpanjangan" : "Bonus"} paket ${label}`,
      createdById: params.createdById ?? null,
    },
  });

  return amount;
}

/**
 * Prisma filter matching every plan grant for one product — initial and renewal
 * alike, since both notes contain "paket <Product>".
 *
 * This is the ONE place that depends on the note wording built in
 * creditPlanPoints a few lines above. The lifetime guard in orders.ts and
 * scripts/backfill-metadata-plan-points.ts both go through here, so changing
 * that wording means changing this and nothing else. Get it wrong and the
 * lifetime guard stops recognising past grants, handing Free points a second
 * time to accounts that already spent theirs.
 */
export function planGrantFilter(product: PlanProduct): {
  reason: string;
  note: { contains: string };
} {
  return { reason: "plan_grant", note: { contains: `paket ${PRODUCT_LABELS[product]}` } };
}

/**
 * Has this account ever been credited for this product? Backs the lifetime Free
 * allowance: "already active" only stops a repeat submit, not revoke-then-
 * reactivate, so the ledger is the only honest source for "ever".
 */
export async function hasEverReceivedPlanGrant(
  userId: string,
  product: PlanProduct
): Promise<boolean> {
  const row = await prisma.pointTransaction.findFirst({
    where: { userId, ...planGrantFilter(product) },
    select: { id: true },
  });
  return row !== null;
}

export interface PlanPointsRow {
  product: PlanProduct;
  plan: string;
  /** Display label, e.g. "Pro". */
  label: string;
  /** Raw stored value — "" when unset, so the panel can show a placeholder. */
  stored: string;
  /** What is actually in force after DB → env → default. */
  effective: number;
}

/** Every (product, plan) pair that has an allowance, in display order. */
function allPairs(): Array<{ product: PlanProduct; plan: string }> {
  const products: PlanProduct[] = ["metadata", "agent"];
  return products.flatMap((product) =>
    Object.keys(DEFAULT_PLAN_POINTS[product]).map((plan) => ({ product, plan }))
  );
}

export async function getPlanPointsView(): Promise<PlanPointsRow[]> {
  const pairs = allPairs();
  const rows = await prisma.setting.findMany({
    where: { key: { in: pairs.map((p) => settingKey(p.product, p.plan)) } },
  });
  const stored = new Map(rows.map((r) => [r.key, r.value]));

  return pairs.map(({ product, plan }) => {
    const raw = stored.get(settingKey(product, plan)) ?? "";
    const effective =
      parseAllowance(raw) ??
      parseAllowance(process.env[envKey(product, plan)]) ??
      DEFAULT_PLAN_POINTS[product][plan];
    return { product, plan, label: PLAN_LABELS[plan] ?? plan, stored: raw.trim(), effective };
  });
}

export async function updatePlanPoints(
  values: Array<{ product: PlanProduct; plan: string; value: string }>
): Promise<void> {
  const ops = [];
  for (const { product, plan, value } of values) {
    // Silently skip anything with no allowance to configure — a caller cannot
    // invent a plan by POSTing one.
    if (DEFAULT_PLAN_POINTS[product]?.[normalizePlan(plan)] === undefined) continue;
    const key = settingKey(product, plan);
    const trimmed = value.trim();
    ops.push(
      prisma.setting.upsert({
        where: { key },
        create: { key, value: trimmed },
        update: { value: trimmed },
      })
    );
  }
  if (ops.length === 0) return;
  await prisma.$transaction(ops);
}
