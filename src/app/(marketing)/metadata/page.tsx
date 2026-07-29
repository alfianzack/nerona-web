import { Hero } from "@/components/marketing/Hero";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { MarketplaceTabsMockup } from "@/components/marketing/mockups/MarketplaceTabsMockup";
import { KeywordChipsMockup } from "@/components/marketing/mockups/KeywordChipsMockup";
import { BatchProgressMockup } from "@/components/marketing/mockups/BatchProgressMockup";
import { MarketplaceRow } from "@/components/marketing/MarketplaceRow";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { metadataTiers } from "@/lib/pricing-tiers";

export default async function MetadataPage() {
  const tiers = await metadataTiers();

  return (
    <main>
      <Hero />
      <FeatureSection
        title="Satu klik. Semua marketplace."
        body="Bekerja langsung di formulir unggah Adobe Stock, Shutterstock, Vecteezy, Canva, dan lainnya — tanpa salin-tempel."
        mockup={<MarketplaceTabsMockup />}
        theme="dark"
        imageSide="left"
      />
      <FeatureSection
        title="Kata kunci yang konsisten."
        body="30 kata kunci hasil AI plus ruang untuk kata kunci Anda sendiri, konsisten di setiap unggahan."
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
        subheading="Mulai gratis, upgrade saat volume unggahan Anda naik."
        tiers={tiers}
      />
    </main>
  );
}
