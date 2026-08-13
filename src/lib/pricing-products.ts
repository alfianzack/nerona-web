import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";
import { getDurationDiscounts, PLAN_DURATIONS } from "@/lib/plan-duration";
import { AGENT_ENABLED } from "@/lib/features";
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
 *
 * `agentEnabled` diambil dari AGENT_ENABLED secara default; parameternya ada
 * supaya tes bisa menguji kedua keadaan. Saat agent disembunyikan, tier-nya
 * tidak dihitung sama sekali — bukan dihitung lalu dibuang.
 */
export async function pricingProducts(agentEnabled: boolean = AGENT_ENABLED): Promise<{
  products: PricingProduct[];
  discounts: Record<number, number>;
}> {
  const [discounts, metadataSets, agentSets] = await Promise.all([
    getDurationDiscounts(),
    Promise.all(PLAN_DURATIONS.map((months) => metadataTiers(months))),
    agentEnabled
      ? Promise.all(PLAN_DURATIONS.map((months) => agentTiers(months)))
      : Promise.resolve(null),
  ]);

  const byDuration = (sets: Awaited<ReturnType<typeof metadataTiers>>[]) =>
    Object.fromEntries(PLAN_DURATIONS.map((months, i) => [months, sets[i]]));

  const products: PricingProduct[] = [
    {
      key: "metadata",
      // Tanpa emoji. Label ini dirender apa adanya sebagai isi tab di
      // PricingSwitcher, dan emoji di sana dirender oleh sistem operasi —
      // bentuk, bobot, dan warnanya berbeda di tiap mesin. Ikon produknya
      // hidup di sisi tampilan, tempat ia bisa mengikuti warna teks.
      label: "Metadata",
      subheading: "Metadata otomatis untuk kontributor stock.",
      tiersByDuration: byDuration(metadataSets),
    },
  ];

  if (agentSets) {
    products.push({
      key: "agent",
      label: "Agent",
      subheading: "Asisten AI WhatsApp untuk pemilik bisnis.",
      tiersByDuration: byDuration(agentSets),
    });
  }

  return { discounts, products };
}
