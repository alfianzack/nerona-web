/**
 * One-off: grant metadata point allowances to tenants who activated before
 * allowances existed for metadata at all.
 *
 * Before this, fulfillOrderRequest credited points only for agent orders, so a
 * metadata tenant ended up with an active license and an empty wallet while
 * api/extension/generate spends points on every call.
 *
 * Idempotent by construction: a metadata plan_grant row is the marker, so a
 * second run credits nobody. Safe to re-run.
 *
 *   npm run backfill:metadata-points             # dry run, reports only
 *   npm run backfill:metadata-points -- --write  # applies
 */
import { prisma } from "../src/lib/prisma";
import { creditPlanPoints, normalizePlan, planGrantFilter } from "../src/lib/plan-points";

const WRITE = process.argv.includes("--write");

async function main() {
  const licenses = await prisma.license.findMany({
    where: { status: { in: ["active", "comp"] } },
    orderBy: { createdAt: "desc" },
    select: {
      userId: true,
      plan: { select: { name: true } },
      user: { select: { email: true } },
    },
  });

  // One license per user is the shape the app assumes elsewhere; if a user has
  // several, the most recent active one wins (hence the ordering above).
  const byUser = new Map<string, { plan: string; email: string }>();
  for (const license of licenses) {
    if (!license.plan?.name) continue;
    if (byUser.has(license.userId)) continue;
    byUser.set(license.userId, {
      plan: license.plan.name,
      email: license.user?.email ?? license.userId,
    });
  }

  if (byUser.size === 0) {
    console.log("No tenants hold an active or comp license. Nothing to do.");
    return;
  }

  // planGrantFilter is shared with the lifetime guard in orders.ts, so the
  // dependency on note wording lives in one place. It matches renewals too,
  // which is the correct reading of "has this account ever been granted" — the
  // earlier startsWith("Bonus …") missed an account whose only grant was a
  // renewal and would have credited it again.
  const alreadyGranted = await prisma.pointTransaction.findMany({
    where: { userId: { in: [...byUser.keys()] }, ...planGrantFilter("metadata") },
    select: { userId: true },
  });
  const skip = new Set(alreadyGranted.map((row) => row.userId));

  let credited = 0;
  let skipped = 0;

  for (const [userId, { plan, email }] of byUser) {
    if (skip.has(userId)) {
      skipped += 1;
      continue;
    }
    if (!WRITE) {
      console.log(`would credit ${email} — metadata ${normalizePlan(plan)}`);
      credited += 1;
      continue;
    }
    const amount = await creditPlanPoints({ userId, product: "metadata", plan });
    console.log(`credited ${email} — metadata ${normalizePlan(plan)} — ${amount} poin`);
    if (amount > 0) credited += 1;
  }

  console.log(
    `\n${WRITE ? "Credited" : "Would credit"}: ${credited}. Already had a grant: ${skipped}.`
  );
  if (!WRITE) console.log("Dry run — re-run with --write to apply.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
