import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";
import { getDurationDiscounts, PLAN_DURATIONS } from "@/lib/plan-duration";
import type { PricingProduct } from "@/components/marketing/PricingSwitcher";

/**
 * Semua tier untuk setiap durasi, dihitung sekali di server.
 *
 * Dikirim sekaligus, bukan diambil ulang saat user mengganti durasi: PricingSwitcher
 * adalah komponen client, dan memuat ulang tiap klik berarti halaman harga berkedip
 * untuk data yang jumlahnya cuma segini.
 *
 * Dipakai /pricing (publik) dan /paket (tenant) supaya keduanya tidak pernah
 * memperlihatkan harga yang berbeda.
 */
export async function pricingProducts(): Promise<{
  products: PricingProduct[];
  discounts: Record<number, number>;
}> {
  const [discounts, metadataSets, agentSets] = await Promise.all([
    getDurationDiscounts(),
    Promise.all(PLAN_DURATIONS.map((months) => metadataTiers(months))),
    Promise.all(PLAN_DURATIONS.map((months) => agentTiers(months))),
  ]);

  const byDuration = (sets: Awaited<ReturnType<typeof metadataTiers>>[]) =>
    Object.fromEntries(PLAN_DURATIONS.map((months, i) => [months, sets[i]]));

  return {
    discounts,
    products: [
      {
        key: "metadata",
        label: "🖼️ Metadata",
        subheading: "Metadata otomatis untuk kontributor stock.",
        tiersByDuration: byDuration(metadataSets),
      },
      {
        key: "agent",
        label: "💬 Agent",
        subheading: "Asisten AI WhatsApp untuk pemilik bisnis.",
        tiersByDuration: byDuration(agentSets),
      },
    ],
  };
}
