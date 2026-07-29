import Link from "next/link";
import { AgentChatMockup } from "@/components/marketing/mockups/AgentChatMockup";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { agentTiers } from "@/lib/pricing-tiers";

const FEATURES = [
  {
    title: "Chat langsung di WhatsApp Anda.",
    body: "Satu nomor WhatsApp Nerona melayani semua pelanggan Nerona Agent. Hubungkan nomor Anda sekali, lalu mulai chat seperti biasa.",
  },
  {
    title: "Ingat percakapan dan bisnis Anda.",
    body: "Nerona Agent mengingat catatan dan fakta penting tentang bisnis Anda dari percakapan sebelumnya, jadi Anda tidak perlu mengulang.",
  },
];

export default function AgentMarketingPage() {
  return (
    <main>
      <section className="relative overflow-hidden bg-canvas px-6 pb-24 pt-20 text-center sm:pt-28">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gold-400 opacity-[0.08] blur-[110px]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-4xl">
          <p className="text-sm font-medium text-brand-blue">Nerona Agent</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-ink sm:text-7xl">
            Asisten AI yang{" "}
            <span className="bg-gradient-to-r from-brand-blue via-brand-orange to-brand-orange bg-clip-text text-transparent">
              chat langsung di WhatsApp.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted sm:text-xl">
            Nerona Agent membantu pemilik usaha kecil mencatat pesanan, mengingat percakapan, dan
            menjawab pelanggan — semua lewat WhatsApp yang sudah Anda pakai setiap hari.
          </p>
          <div className="mx-auto mt-16 max-w-lg">
            <AgentChatMockup />
          </div>
        </div>
      </section>

      <section className="bg-surface2 px-6 py-24 sm:py-32">
        <div className="mx-auto grid max-w-5xl gap-12 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                {feature.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <PricingTiers
        id="pricing"
        heading="Harga Nerona Agent"
        subheading="Mulai gratis, upgrade saat chat Anda makin ramai."
        tiers={agentTiers()}
      />

      <section className="bg-canvas px-6 py-16 text-center">
        <p className="text-sm text-muted">
          Sudah pelanggan?{" "}
          <Link href="/login" className="font-medium text-brand-blue hover:underline">
            Masuk ke akun Anda
          </Link>
        </p>
      </section>
    </main>
  );
}
