import Link from "next/link";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { ProductCards } from "@/components/marketing/ProductCards";
import { StepsSection } from "@/components/marketing/StepsSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { MetadataCardMockup } from "@/components/marketing/mockups/MetadataCardMockup";
import { AgentChatMockup } from "@/components/marketing/mockups/AgentChatMockup";

const HERO_FACTS = [
  "5+ marketplace didukung",
  "Chat langsung di WhatsApp",
  "Paket Free, tanpa kartu kredit",
];

const HOME_FAQ = [
  {
    question: "Apakah saya perlu kartu kredit untuk mulai?",
    answer: "Tidak. Paket Free aktif seketika setelah daftar, tanpa data pembayaran apa pun.",
  },
  {
    question: "Bagaimana cara pembayarannya?",
    answer:
      "Pembayaran lewat transfer bank. Pilih paket, kirim order, transfer sesuai nominal, lalu unggah bukti transfer — tim kami memverifikasi dan mengaktifkan akun Anda.",
  },
  {
    question: "Berapa lama akun saya aktif setelah transfer?",
    answer: "Biasanya di hari yang sama setelah bukti transfer kami terima dan verifikasi.",
  },
  {
    question: "Bisa ganti atau berhenti paket kapan saja?",
    answer:
      "Bisa. Upgrade kapan saja, dan paket berjalan sampai masa aktifnya berakhir — tanpa perpanjangan otomatis.",
  },
  {
    question: "Marketplace apa saja yang didukung Metadata?",
    answer: "Adobe Stock, Shutterstock, Vecteezy, Canva, dan Freepik — dan terus bertambah.",
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden bg-canvas px-6 pb-16 pt-20 text-center sm:pt-28">
        <div
          className="pointer-events-none absolute -top-24 left-1/3 h-96 w-96 rounded-full bg-gold-400 opacity-[0.09] blur-[110px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-brand-blue opacity-30 blur-[110px]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-blue/25 bg-brand-blue/10 px-3.5 py-1.5 text-xs font-semibold text-[#3B65C4]">
            <span className="h-2 w-2 rounded-full bg-brand-blue" aria-hidden="true" />
            AI untuk kreator &amp; UMKM Indonesia
          </span>
          <h1 className="mt-5 text-balance text-5xl font-semibold tracking-tight text-ink sm:text-7xl">
            Satu perusahaan,{" "}
            <span className="bg-gradient-to-r from-brand-blue via-brand-orange to-brand-orange bg-clip-text text-transparent">
              alat AI untuk kontributor dan pemilik bisnis.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted sm:text-xl">
            Dari metadata otomatis untuk kontributor stock, sampai asisten AI WhatsApp untuk
            pemilik usaha kecil — Nerona membangun alat yang bekerja untuk Anda.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/register"
              className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-6 py-2.5 text-sm font-semibold text-navy-900 shadow-lg shadow-gold-500/30 transition hover:brightness-110"
            >
              Mulai gratis
            </Link>
            <Link
              href="/pricing"
              className="rounded-full bg-surface px-6 py-2.5 text-sm font-medium text-ink ring-1 ring-navy-900/15 transition hover:bg-surface2"
            >
              Lihat harga
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[13px] text-muted">
            {HERO_FACTS.map((fact) => (
              <span key={fact} className="inline-flex items-center gap-1.5">
                <span className="font-bold text-emerald-600" aria-hidden="true">
                  ✓
                </span>
                {fact}
              </span>
            ))}
          </div>
        </div>
      </section>

      <ProductCards />

      <StepsSection
        title="Mulai dalam tiga langkah"
        subtitle="Tanpa kartu kredit, tanpa instalasi rumit."
        steps={[
          {
            title: "Daftar gratis",
            body: "Buat akun dengan email — paket Free langsung aktif untuk semua produk.",
          },
          {
            title: "Pakai alatnya",
            body: "Generate metadata dari ekstensi browser, atau hubungkan nomor WhatsApp toko Anda.",
          },
          {
            title: "Upgrade saat butuh",
            body: "Kuota habis? Pilih paket, transfer, dan akun aktif setelah verifikasi tim kami.",
          },
        ]}
      />

      <FeatureSection
        title="Nerona Metadata"
        body="Judul, deskripsi, dan kata kunci dibuat otomatis dengan AI, lalu diisi langsung ke formulir unggah marketplace favorit Anda."
        bullets={[
          "Isi otomatis di Adobe Stock, Shutterstock, Vecteezy, Canva, Freepik",
          "Kata kunci relevan dalam hitungan detik, bukan menit",
          "Reject analyzer: pelajari alasan penolakan dan perbaiki",
        ]}
        mockup={<MetadataCardMockup />}
        theme="light"
        imageSide="left"
      />
      <FeatureSection
        title="Nerona Agent"
        body="Asisten AI yang chat langsung di WhatsApp — tanpa aplikasi baru untuk dipelajari, untuk Anda maupun pelanggan Anda."
        bullets={[
          "Catat pesanan dan stok lewat percakapan biasa",
          "Ingat pelanggan dan riwayat belanja mereka",
          "Balas pertanyaan umum toko Anda, kapan pun",
        ]}
        mockup={<AgentChatMockup theme="dark" />}
        theme="navy"
        imageSide="right"
      />

      <FaqSection items={HOME_FAQ} />

      <CtaBanner
        title="Coba gratis hari ini"
        body="Paket Free untuk semua produk — rasakan dulu manfaatnya, upgrade hanya kalau memang butuh."
        ctaLabel="Buat akun gratis"
        ctaHref="/register"
      />
    </main>
  );
}
