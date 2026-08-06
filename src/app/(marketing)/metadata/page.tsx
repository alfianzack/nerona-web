import { redirect } from "next/navigation";
import { AGENT_ENABLED } from "@/lib/features";
import { Hero } from "@/components/marketing/Hero";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { MarketplaceTabsMockup } from "@/components/marketing/mockups/MarketplaceTabsMockup";
import { KeywordChipsMockup } from "@/components/marketing/mockups/KeywordChipsMockup";
import { BatchProgressMockup } from "@/components/marketing/mockups/BatchProgressMockup";
import { MarketplaceRow } from "@/components/marketing/MarketplaceRow";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { metadataTiers } from "@/lib/pricing-tiers";
import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";

export default async function MetadataPage() {
  // Isi halaman ini sekarang ada di beranda (HomeMetadataOnly menyerapnya),
  // jadi tautan lama tetap mendarat di tempat yang benar alih-alih menampilkan
  // halaman kedua yang bercerita sama.
  if (!AGENT_ENABLED) redirect("/");

  const tiers = await metadataTiers();

  return (
    <main>
      <Hero />
      <FeatureSection
        title={`Satu klik. ${CLAIMABLE_MARKETPLACES.length} marketplace.`}
        body={`Bekerja langsung di formulir unggah ${CLAIMABLE_MARKETPLACES.map((m) => m.label).join(", ")} — tanpa salin-tempel.`}
        mockup={<MarketplaceTabsMockup />}
        theme="dark"
        imageSide="left"
      />
      <FeatureSection
        title="Kata kunci yang konsisten."
        body="Puluhan kata kunci hasil AI — sebanyak yang marketplace tujuan izinkan — plus ruang untuk kata kunci Anda sendiri di setiap unggahan."
        mockup={<KeywordChipsMockup />}
        theme="light"
        imageSide="right"
      />
      <FeatureSection
        title="Dibuat untuk unggahan massal."
        body="Pilih banyak gambar sekaligus, pantau progres per gambar, dan terapkan ke semua tab marketplace yang terbuka."
        mockup={<BatchProgressMockup />}
        theme="dark"
        imageSide="left"
      />
      <MarketplaceRow />
      <PricingTiers
        id="pricing"
        heading="Harga Nerona Metadata"
        subheading="Paket Free memberi poin percobaan sekali per akun. Upgrade untuk poin bulanan."
        tiers={tiers}
      />
    </main>
  );
}
