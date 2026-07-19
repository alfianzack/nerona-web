import { prisma } from "./prisma";
import { describeMarketplaces } from "./marketplaces";
import { AGENT_PLAN_LIMITS } from "./agent/limits";
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

export async function metadataTiers(): Promise<PricingTier[]> {
  const plans = await prisma.plan.findMany();
  return plans
    .filter((plan) => TIER_ORDER.includes(plan.name))
    .sort((a, b) => TIER_ORDER.indexOf(a.name) - TIER_ORDER.indexOf(b.name))
    .map((plan) => ({
      name: plan.name,
      icon: TIER_ICONS[plan.name] ?? "✨",
      tagline: METADATA_TAGLINES[plan.name] ?? "",
      priceLabel: plan.priceLabel ?? "Hubungi kami",
      features: [
        { label: describeMarketplaces(plan.marketplaces), included: true },
        {
          label:
            plan.generationLimit === null
              ? "Generate tanpa batas"
              : `${plan.generationLimit} generate/bulan`,
          included: true,
        },
        { label: "Analisis penolakan (reject analyzer)", included: plan.rejectAnalyzer },
      ],
      cta: ctaFor(plan.name),
      href: `/order?product=metadata&plan=${plan.name}`,
      featured: plan.name === "Pro",
    }));
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
  business: "Volume tinggi, banyak pelanggan",
};

export function agentTiers(): PricingTier[] {
  return TIER_ORDER.map((name) => {
    const key = name.toLowerCase();
    const limit = AGENT_PLAN_LIMITS[key];
    return {
      name,
      icon: TIER_ICONS[name] ?? "✨",
      tagline: AGENT_TAGLINES[key] ?? "",
      priceLabel: AGENT_PRICE_LABELS[key] ?? "Hubungi kami",
      features: [
        {
          label: limit === null ? "Pesan tanpa batas" : `${limit} pesan/bulan`,
          included: true,
        },
        { label: "Memory & catatan bisnis", included: true },
        { label: "Terhubung ke nomor WhatsApp Anda", included: true },
      ],
      cta: ctaFor(name),
      href: `/order?product=agent&plan=${name}`,
      featured: name === "Pro",
    };
  });
}
