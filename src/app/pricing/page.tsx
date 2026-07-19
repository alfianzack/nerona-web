import { PricingTiers } from "@/components/marketing/PricingTiers";
import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";

export default async function PricingPage() {
  const tiers = await metadataTiers();

  return (
    <main className="bg-navy-950">
      <div className="px-6 pt-16 text-center sm:pt-20">
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">Harga</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-navy-300">
          Semua produk Nerona punya paket Free — mulai tanpa pembayaran, upgrade kapan saja.
        </p>
      </div>
      <PricingTiers
        heading="Nerona Metadata"
        subheading="Metadata otomatis untuk kontributor stock."
        tiers={tiers}
      />
      <PricingTiers
        heading="Nerona Agent"
        subheading="Asisten AI WhatsApp untuk pemilik bisnis."
        tiers={agentTiers()}
      />
    </main>
  );
}
