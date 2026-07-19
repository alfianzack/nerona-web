import Link from "next/link";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { MetadataCardMockup } from "@/components/marketing/mockups/MetadataCardMockup";
import { AgentChatMockup } from "@/components/marketing/mockups/AgentChatMockup";

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden bg-navy-950 px-6 pb-24 pt-20 text-center sm:pt-28">
        <div
          className="pointer-events-none absolute -top-24 left-1/3 h-96 w-96 rounded-full bg-gold-400 opacity-[0.09] blur-[110px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-navy-500 opacity-30 blur-[110px]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-4xl">
          <p className="text-sm font-medium text-gold-400">Nerona</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-white sm:text-7xl">
            Satu perusahaan,{" "}
            <span className="bg-gradient-to-r from-gold-600 via-gold-400 to-gold-300 bg-clip-text text-transparent">
              alat AI untuk kontributor dan pemilik bisnis.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-navy-300 sm:text-xl">
            Dari metadata otomatis untuk kontributor stock, sampai asisten AI WhatsApp untuk
            pemilik usaha kecil — Nerona membangun alat yang bekerja untuk Anda.
          </p>
          <div className="mt-8 flex items-center justify-center gap-6">
            <Link
              href="/metadata"
              className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-6 py-2.5 text-sm font-semibold text-navy-900 transition hover:brightness-110"
            >
              Lihat Metadata
            </Link>
            <Link
              href="/agent"
              className="text-sm font-medium text-gold-400 transition hover:underline"
            >
              Lihat Agent <span aria-hidden="true">›</span>
            </Link>
          </div>
        </div>
      </section>

      <FeatureSection
        title="Nerona Metadata"
        body="Judul, deskripsi, dan kata kunci dibuat otomatis dengan AI, lalu diisi langsung ke formulir unggah Adobe Stock, Shutterstock, Vecteezy, Canva, dan lainnya."
        mockup={<MetadataCardMockup />}
        theme="light"
        imageSide="left"
      />
      <FeatureSection
        title="Nerona Agent"
        body="Asisten AI yang chat langsung di WhatsApp — catat pesanan, ingat percakapan, dan bantu jawab pelanggan, tanpa aplikasi baru untuk dipelajari."
        mockup={<AgentChatMockup />}
        theme="dark"
        imageSide="right"
      />
    </main>
  );
}
