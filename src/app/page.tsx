import Link from "next/link";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { MetadataCardMockup } from "@/components/marketing/mockups/MetadataCardMockup";
import { AgentChatMockup } from "@/components/marketing/mockups/AgentChatMockup";

export default function HomePage() {
  return (
    <main>
      <section className="bg-white px-6 pb-24 pt-20 text-center dark:bg-black sm:pt-28">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Nerona</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-7xl">
            Satu perusahaan,{" "}
            <span className="bg-gradient-to-r from-blue-600 to-sky-400 bg-clip-text text-transparent">
              alat AI untuk kontributor dan pemilik bisnis.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500 dark:text-gray-400 sm:text-xl">
            Dari metadata otomatis untuk kontributor stock, sampai asisten AI WhatsApp untuk
            pemilik usaha kecil — Nerona membangun alat yang bekerja untuk Anda.
          </p>
          <div className="mt-8 flex items-center justify-center gap-6">
            <Link
              href="/metadata"
              className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              Lihat Metadata
            </Link>
            <Link
              href="/agent"
              className="text-sm font-medium text-blue-600 transition hover:underline dark:text-blue-400"
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
        theme="dark"
        imageSide="left"
      />
      <FeatureSection
        title="Nerona Agent"
        body="Asisten AI yang chat langsung di WhatsApp — catat pesanan, ingat percakapan, dan bantu jawab pelanggan, tanpa aplikasi baru untuk dipelajari."
        mockup={<AgentChatMockup />}
        theme="light"
        imageSide="right"
      />
    </main>
  );
}
