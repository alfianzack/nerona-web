import { prisma } from "./prisma";
import { describeMarketplaces } from "./marketplaces";
import { AGENT_PLAN_LIMITS } from "./agent/limits";
import { normalizePlan, pointsForPlan, type PlanProduct } from "./plan-points";
import { agentMonthlyPrice, DEFAULT_AGENT_MONTHLY_PRICES } from "./agent-pricing";
import {
  coerceDuration,
  getDurationDiscounts,
  priceLabelFor,
  savingsLabelFor,
  DURATION_LABELS,
} from "./plan-duration";
import type { PricingTier } from "@/components/marketing/PricingTiers";

const TIER_ORDER = ["Free", "Pro", "Business"];
const TIER_ICONS: Record<string, string> = { Free: "🆓", Pro: "⚡", Business: "👑" };

const METADATA_TAGLINES: Record<string, string> = {
  Free: "Coba dulu, tanpa kartu kredit",
  Pro: "Untuk kontributor aktif",
  Business: "Volume tinggi, tim, agensi",
};

function ctaFor(name: string): string {
  return name === "Free" ? "Mulai Gratis" : `Upgrade ke ${name}`;
}

/**
 * The allowance row, stated in points.
 *
 * Never a generate/message count: what a point buys is derived from
 * admin-editable rates (see the marketing honesty spec — the spread between two
 * plausible rate configs was 24×), so any figure here would be one Pengaturan
 * edit away from lying. `Plan.generationLimit` is deliberately not used — it is
 * enforced nowhere in the codebase, so displaying it promised a limit that does
 * not exist.
 *
 * Free is a lifetime allowance, paid plans are credited on every activation and
 * renewal; the wording has to distinguish them or Free reads as recurring.
 *
 * Paket berdurasi panjang dikredit sekaligus di muka, jadi angkanya dikalikan
 * durasi — kalau tidak, membeli 6 bulan terlihat memberi poin sebanyak 1 bulan.
 */
async function allowanceLabel(
  product: PlanProduct,
  planName: string,
  months: number
): Promise<string> {
  const monthly = await pointsForPlan(product, planName);
  if (normalizePlan(planName) === "free") {
    return `${monthly.toLocaleString("id-ID")} poin sekali per akun`;
  }
  const total = monthly * months;
  const suffix = months === 1 ? "per bulan" : `untuk ${DURATION_LABELS[months] ?? `${months} bulan`}`;
  return `${total.toLocaleString("id-ID")} poin ${suffix}`;
}

/** Paket gratis tidak punya durasi — memaksanya ke 1 bulan menghindari "Rp 0/6 bulan". */
function durationForPlan(planName: string, months: number): number {
  return normalizePlan(planName) === "free" ? 1 : months;
}

export async function metadataTiers(monthsInput: number = 1): Promise<PricingTier[]> {
  const months = coerceDuration(monthsInput);
  const [plans, discounts] = await Promise.all([prisma.plan.findMany(), getDurationDiscounts()]);
  const ordered = plans
    .filter((plan) => TIER_ORDER.includes(plan.name))
    .sort((a, b) => TIER_ORDER.indexOf(a.name) - TIER_ORDER.indexOf(b.name));

  return Promise.all(
    ordered.map(async (plan) => {
      const planMonths = durationForPlan(plan.name, months);
      const discount = discounts[planMonths] ?? 0;
      return {
        name: plan.name,
        icon: TIER_ICONS[plan.name] ?? "✨",
        tagline: METADATA_TAGLINES[plan.name] ?? "",
        priceLabel: priceLabelFor(plan.priceMonthly, planMonths, discount),
        savingsLabel: savingsLabelFor(plan.priceMonthly, planMonths, discount),
        features: [
          { label: describeMarketplaces(plan.marketplaces), included: true },
          { label: await allowanceLabel("metadata", plan.name, planMonths), included: true },
          { label: "Analisis penolakan (reject analyzer)", included: plan.rejectAnalyzer },
        ],
        cta: ctaFor(plan.name),
        href: `/order?product=metadata&plan=${plan.name}&months=${planMonths}`,
        featured: plan.name === "Pro",
      };
    })
  );
}

// Agent tiers have no DB rows — plan names and limits live in code
// (AGENT_PLAN_LIMITS). Prices come from Setting via agentMonthlyPrice, so the
// owner edits them in Pengaturan exactly like the metadata prices.
const AGENT_TAGLINES: Record<string, string> = {
  free: "Cukup untuk coba-coba",
  pro: "Untuk toko yang mulai ramai",
  business: "Volume tinggi, banyak transaksi",
};

export async function agentTiers(monthsInput: number = 1): Promise<PricingTier[]> {
  const months = coerceDuration(monthsInput);
  const discounts = await getDurationDiscounts();

  return Promise.all(
    TIER_ORDER.map(async (name) => {
      const key = name.toLowerCase();
      const planMonths = durationForPlan(key, months);
      const discount = discounts[planMonths] ?? 0;
      const monthly = await agentMonthlyPrice(key);
      // Unlike generationLimit, this cap IS enforced — hasExceededMonthlyLimit
      // in lib/agent/limits.ts counts inbound messages per month — so it stays
      // claimable alongside the point allowance.
      const limit = AGENT_PLAN_LIMITS[key];
      return {
        name,
        icon: TIER_ICONS[name] ?? "✨",
        tagline: AGENT_TAGLINES[key] ?? "",
        priceLabel: priceLabelFor(monthly, planMonths, discount),
        savingsLabel: savingsLabelFor(monthly, planMonths, discount),
        features: [
          { label: await allowanceLabel("agent", key, planMonths), included: true },
          {
            label: limit === null ? "Pesan tanpa batas" : `Maksimal ${limit} pesan/bulan`,
            included: true,
          },
          { label: "Memory & catatan bisnis", included: true },
          { label: "Terhubung ke nomor WhatsApp Anda", included: true },
        ],
        cta: ctaFor(name),
        href: `/order?product=agent&plan=${name}&months=${planMonths}`,
        featured: name === "Pro",
      };
    })
  );
}

export { DEFAULT_AGENT_MONTHLY_PRICES };
