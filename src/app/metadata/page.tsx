import { Hero } from "@/components/marketing/Hero";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { MarketplaceTabsMockup } from "@/components/marketing/mockups/MarketplaceTabsMockup";
import { KeywordChipsMockup } from "@/components/marketing/mockups/KeywordChipsMockup";
import { BatchProgressMockup } from "@/components/marketing/mockups/BatchProgressMockup";
import { MarketplaceRow } from "@/components/marketing/MarketplaceRow";
import { PricingTeaser } from "@/components/marketing/PricingTeaser";

export default function MetadataPage() {
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
      <PricingTeaser />
    </main>
  );
}
