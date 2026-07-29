import Link from "next/link";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { ProductCards } from "@/components/marketing/ProductCards";
import { StepsSection } from "@/components/marketing/StepsSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { MetadataCardMockup } from "@/components/marketing/mockups/MetadataCardMockup";
import { AgentChatMockup } from "@/components/marketing/mockups/AgentChatMockup";
import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { DEFAULT_PLAN_POINTS } from "@/lib/plan-points";

const MARKETPLACE_NAMES = CLAIMABLE_MARKETPLACES.map((m) => m.label).join(", ");

/**
 * The Free allowance, stated as points because "how many images that buys" is
 * derived from admin-editable rates and is one Pengaturan edit away from being
 * wrong. These are the code defaults; an owner who overrides them in Pengaturan
 * must update this copy too — the alternative was a DB read on a page that
 * otherwise renders without one.
 */
const FREE_METADATA_POINTS = DEFAULT_PLAN_POINTS.metadata.free;
const FREE_AGENT_POINTS = DEFAULT_PLAN_POINTS.agent.free;

const HERO_FACTS = [
  `${CLAIMABLE_MARKETPLACES.length} marketplace didukung`,
  "Chat langsung di WhatsApp",
  "Poin gratis untuk mencoba, tanpa kartu kredit",
];

const HOME_FAQ = [
  {
    question: "Apakah saya perlu kartu kredit untuk mulai?",
    answer:
      "Tidak. Paket Free aktif seketika setelah daftar, tanpa data pembayaran apa pun. Free adalah poin percobaan sekali per akun, bukan kuota bulanan.",
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
      "Bisa. Upgrade kapan saja, dan paket berjalan sampai masa aktifnya berakhir — tanpa tagihan otomatis, karena setiap perpanjangan menunggu transfer Anda.",
  },
  {
    question: "Marketplace apa saja yang didukung Metadata?",
    answer: `${MARKETPLACE_NAMES}.`,
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
        subtitle="Tanpa kartu kredit."
        steps={[
          {
            title: "Daftar gratis",
            body: "Buat akun dengan email — paket Free langsung aktif untuk semua produk.",
          },
          {
            title: "Pasang ekstensi Chrome",
            body: "Unduh folder ekstensi Nerona Metadata, lalu muat lewat Chrome — kami memandu langkahnya. Untuk Agent cukup hubungkan nomor WhatsApp toko Anda.",
          },
          {
            title: "Upgrade saat butuh",
            body: "Poin habis? Pilih paket, transfer, dan akun aktif setelah verifikasi tim kami.",
          },
        ]}
      />

      <FeatureSection
        title="Nerona Metadata"
        body="Judul, deskripsi, dan kata kunci dibuat otomatis dengan AI, lalu diisi langsung ke formulir unggah marketplace favorit Anda."
        bullets={[
          `Isi otomatis di ${MARKETPLACE_NAMES}`,
          "Kata kunci relevan dalam hitungan detik, bukan menit",
          "Reject analyzer: pelajari alasan penolakan dan perbaiki",
        ]}
        mockup={<MetadataCardMockup />}
        theme="light"
        imageSide="left"
      />
      <FeatureSection
        title="Nerona Agent"
        body="Asisten pribadi Anda sebagai pemilik usaha, chat langsung di WhatsApp — tanpa aplikasi baru untuk dipelajari. Agent hanya melayani nomor Anda sendiri, bukan nomor pembeli."
        bullets={[
          "Catat penjualan dan tambah produk lewat percakapan biasa",
          "Tanya omzet harian, mingguan, atau bulanan kapan saja",
          "Ingat catatan penting tentang bisnis Anda antar percakapan",
        ]}
        mockup={<AgentChatMockup theme="dark" />}
        theme="navy"
        imageSide="right"
      />

      <FaqSection items={HOME_FAQ} />

      <CtaBanner
        title="Coba gratis hari ini"
        body={`Paket Free memberi ${FREE_METADATA_POINTS} poin Metadata dan ${FREE_AGENT_POINTS} poin Agent, sekali per akun. Poin terpakai setiap kali AI bekerja — cukup untuk mencoba sebelum Anda memutuskan.`}
        ctaLabel="Buat akun gratis"
        ctaHref="/register"
      />
    </main>
  );
}
