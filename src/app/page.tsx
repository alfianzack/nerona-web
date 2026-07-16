import { Hero } from "@/components/marketing/Hero";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { MetadataCardMockup } from "@/components/marketing/mockups/MetadataCardMockup";
import { MarketplaceTabsMockup } from "@/components/marketing/mockups/MarketplaceTabsMockup";
import { KeywordChipsMockup } from "@/components/marketing/mockups/KeywordChipsMockup";
import { BatchProgressMockup } from "@/components/marketing/mockups/BatchProgressMockup";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <FeatureSection
        title="Write once, skip the typing."
        body="AI drafts a title, description, and 30 keywords for every image you upload."
        mockup={<MetadataCardMockup />}
        theme="light"
        imageSide="right"
      />
      <FeatureSection
        title="One click. Every marketplace."
        body="Works directly on Adobe Stock, Freepik, Vecteezy, and Shutterstock's own upload forms — no copy-paste."
        mockup={<MarketplaceTabsMockup />}
        theme="dark"
        imageSide="left"
      />
      <FeatureSection
        title="Keywords that keep pace."
        body="30 AI-generated keywords plus room for your own, kept consistent across every upload."
        mockup={<KeywordChipsMockup />}
        theme="light"
        imageSide="right"
      />
      <FeatureSection
        title="Built for batches."
        body="Pick multiple images, watch progress per image, and apply across every open marketplace tab at once."
        mockup={<BatchProgressMockup />}
        theme="dark"
        imageSide="left"
      />
    </main>
  );
}
