import { Band } from "@/components/ui/Band";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TextLink } from "@/components/ui/TextLink";
import { Icon } from "@/components/ui/icons";
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

/**
 * Beranda dua produk — dipakai saat AGENT_ENABLED true.
 *
 * Disimpan, bukan dihapus: kalau ini dihapus, menyalakan kembali
 * AGENT_ENABLED akan memulihkan nav dan route tapi meninggalkan beranda
 * satu-produk, dan saklarnya jadi berbohong. Isi dan urutan bagiannya tetap
 * seperti saat dipindah dari app/(marketing)/page.tsx — yang berubah hanya
 * lapisan visualnya, supaya halaman ini tidak lahir sebagai layar lama begitu
 * saklarnya dinyalakan lagi.
 */
export function HomeMultiProduct() {
  return (
    <main>
      {/* Susunannya sengaja dibuat sama persis dengan Hero.tsx: eyebrow, judul
          satu warna, sub-judul text-lead, satu pil plus satu tautan teks, lalu
          baris fakta. Dua blob kabur di belakang judul dibuang — keduanya tidak
          menandai apa pun dan hanya itu alasan bagian ini butuh
          `overflow-hidden`. */}
      <Band align="center">
        <p className="text-body-lg font-semibold text-accent">
          AI untuk kreator &amp; UMKM Indonesia
        </p>

        <h1 className="mx-auto mt-3 max-w-[18ch] text-balance text-display-1 text-ink">
          Satu perusahaan, alat AI untuk kontributor dan pemilik bisnis.
        </h1>

        <p className="mx-auto mt-5 max-w-[40ch] text-balance text-lead text-muted">
          Dari metadata otomatis untuk kontributor stock, sampai asisten AI WhatsApp untuk pemilik
          usaha kecil — Nerona membangun alat yang bekerja untuk Anda.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
          <ButtonLink href="/register" size="lg">
            Mulai gratis
          </ButtonLink>
          <TextLink href="/pricing" className="text-body-lg">
            Lihat harga
          </TextLink>
        </div>

        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-caption text-muted">
          {HERO_FACTS.map((fact) => (
            <li key={fact} className="inline-flex items-center gap-2">
              <Icon name="check" className="h-3.5 w-3.5 flex-none text-accent" />
              {fact}
            </li>
          ))}
        </ul>
      </Band>

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
