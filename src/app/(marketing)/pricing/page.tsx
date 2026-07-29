import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PricingSwitcher } from "@/components/marketing/PricingSwitcher";
import { StepsSection } from "@/components/marketing/StepsSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";

const PRICING_FAQ = [
  {
    question: "Apakah paket diperpanjang otomatis?",
    answer:
      "Tidak. Paket berjalan sampai masa aktifnya berakhir. Perpanjang hanya kalau Anda mau.",
  },
  {
    question: "Bagaimana kalau kuota bulanan habis?",
    answer:
      "Alat berhenti sementara sampai kuota di-reset bulan berikutnya, atau upgrade paket untuk kuota lebih besar.",
  },
  {
    question: "Apakah bisa pindah paket di tengah jalan?",
    answer:
      "Bisa — kirim order upgrade kapan saja, tim kami bantu sesuaikan sisa masa aktif Anda.",
  },
];

export default async function PricingPage() {
  // /pricing is the one dual-audience page: marketing copy for visitors, a
  // purchase surface for tenants. A tenant buying points should have the app
  // sidebar, and one path cannot live in two route groups — so they get /paket
  // instead. Deliberately NOT applied to /, /agent, or /metadata: those are
  // pure marketing and are fine to read while signed in.
  //
  // The sidebar links straight to /paket, so this only catches stale entry
  // points: the footer, bookmarks, search results, and the in-page links in
  // (marketing)/page.tsx and (app)/order/page.tsx.
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/paket");
  }

  const tiers = await metadataTiers();

  return (
    <main className="bg-canvas">
      <section className="relative overflow-hidden px-6 pb-20 pt-16 sm:pt-20">
        <div
          className="pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full bg-gold-400 opacity-[0.12] blur-[100px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-brand-blue opacity-30 blur-[100px]"
          aria-hidden="true"
        />
        <div className="relative">
          <h1 className="text-balance text-center text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
            Harga sederhana,{" "}
            <span className="bg-gradient-to-r from-brand-blue via-brand-orange to-brand-orange bg-clip-text text-transparent">
              mulai dari gratis.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-muted">
            Semua produk Nerona punya paket Free — mulai tanpa pembayaran, upgrade kapan saja.
          </p>
          <div className="mt-9">
            <PricingSwitcher
              products={[
                {
                  key: "metadata",
                  label: "🖼️ Metadata",
                  subheading: "Metadata otomatis untuk kontributor stock.",
                  tiers,
                },
                {
                  key: "agent",
                  label: "💬 Agent",
                  subheading: "Asisten AI WhatsApp untuk pemilik bisnis.",
                  tiers: agentTiers(),
                },
              ]}
            />
          </div>
        </div>
      </section>

      <StepsSection
        title="Cara pembayaran"
        subtitle="Tanpa perpanjangan otomatis — Anda selalu pegang kendali."
        variant="cards"
        steps={[
          {
            title: "Pilih paket & kirim order",
            body: "Klik paket yang Anda mau — order tercatat dan detail rekening tujuan langsung muncul.",
          },
          {
            title: "Transfer & unggah bukti",
            body: "Transfer sesuai nominal, lalu unggah foto bukti transfer di halaman order Anda.",
          },
          {
            title: "Aktif setelah verifikasi",
            body: "Tim kami memverifikasi pembayaran dan paket Anda aktif — biasanya di hari yang sama.",
          },
        ]}
      />

      <FaqSection items={PRICING_FAQ} className="bg-canvas" />

      <CtaBanner
        title="Masih ragu? Mulai dari yang gratis."
        body="Tidak perlu kartu kredit, tidak ada perpanjangan otomatis. Upgrade hanya saat Anda siap."
        ctaLabel="Buat akun gratis"
        ctaHref="/register"
      />
    </main>
  );
}
