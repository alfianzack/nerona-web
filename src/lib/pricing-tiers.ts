import { prisma } from "./prisma";
import { describeMarketplaces } from "./marketplaces";
import { AGENT_PLAN_LIMITS } from "./agent/limits";
import { normalizePlan, pointsForPlan, type PlanProduct } from "./plan-points";
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
 */
async function allowanceLabel(product: PlanProduct, planName: string): Promise<string> {
  const points = await pointsForPlan(product, planName);
  const suffix = normalizePlan(planName) === "free" ? "sekali per akun" : "per bulan";
  return `${points.toLocaleString("id-ID")} poin ${suffix}`;
}

export async function metadataTiers(): Promise<PricingTier[]> {
  const plans = await prisma.plan.findMany();
  const ordered = plans
    .filter((plan) => TIER_ORDER.includes(plan.name))
    .sort((a, b) => TIER_ORDER.indexOf(a.name) - TIER_ORDER.indexOf(b.name));

  return Promise.all(
    ordered.map(async (plan) => ({
      name: plan.name,
      icon: TIER_ICONS[plan.name] ?? "✨",
      tagline: METADATA_TAGLINES[plan.name] ?? "",
      priceLabel: plan.priceLabel ?? "Hubungi kami",
      features: [
        { label: describeMarketplaces(plan.marketplaces), included: true },
        { label: await allowanceLabel("metadata", plan.name), included: true },
        { label: "Analisis penolakan (reject analyzer)", included: plan.rejectAnalyzer },
      ],
      cta: ctaFor(plan.name),
      href: `/order?product=metadata&plan=${plan.name}`,
      featured: plan.name === "Pro",
    }))
  );
}

// Agent tiers have no DB rows yet — plan names/limits live in code
// (AGENT_PLAN_LIMITS) and prices are fixed here until agent billing gets its
// own admin-managed table.
const AGENT_PRICE_LABELS: Record<string, string> = {
  free: "Rp 0",
  pro: "Rp 49.000/bulan",
  business: "Rp 99.000/bulan",
};

const AGENT_TAGLINES: Record<string, string> = {
  free: "Cukup untuk coba-coba",
  pro: "Untuk toko yang mulai ramai",
  business: "Volume tinggi, banyak transaksi",
};

export async function agentTiers(): Promise<PricingTier[]> {
  return Promise.all(
    TIER_ORDER.map(async (name) => {
      const key = name.toLowerCase();
      // Unlike generationLimit, this cap IS enforced — hasExceededMonthlyLimit
      // in lib/agent/limits.ts counts inbound messages per month — so it stays
      // claimable alongside the point allowance.
      const limit = AGENT_PLAN_LIMITS[key];
      return {
        name,
        icon: TIER_ICONS[name] ?? "✨",
        tagline: AGENT_TAGLINES[key] ?? "",
        priceLabel: AGENT_PRICE_LABELS[key] ?? "Hubungi kami",
        features: [
          { label: await allowanceLabel("agent", key), included: true },
          {
            label: limit === null ? "Pesan tanpa batas" : `Maksimal ${limit} pesan/bulan`,
            included: true,
          },
          { label: "Memory & catatan bisnis", included: true },
          { label: "Terhubung ke nomor WhatsApp Anda", included: true },
        ],
        cta: ctaFor(name),
        href: `/order?product=agent&plan=${name}`,
        featured: name === "Pro",
      };
    })
  );
}
