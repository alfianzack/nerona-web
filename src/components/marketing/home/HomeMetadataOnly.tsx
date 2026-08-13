import { Hero } from "@/components/marketing/Hero";
import { ContributorPainSection } from "@/components/marketing/ContributorPainSection";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { MarketplaceRow } from "@/components/marketing/MarketplaceRow";
import { StepsSection } from "@/components/marketing/StepsSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { MarketplaceTabsMockup } from "@/components/marketing/mockups/MarketplaceTabsMockup";
import { KeywordChipsMockup } from "@/components/marketing/mockups/KeywordChipsMockup";
import { BatchProgressMockup } from "@/components/marketing/mockups/BatchProgressMockup";
import { RejectAnalysisMockup } from "@/components/marketing/mockups/RejectAnalysisMockup";
import { metadataTiers } from "@/lib/pricing-tiers";
import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { DEFAULT_PLAN_POINTS } from "@/lib/plan-points";

const MARKETPLACE_NAMES = CLAIMABLE_MARKETPLACES.map((m) => m.label).join(", ");

/**
 * Angka poin Free diambil dari default kode. Owner bisa menimpanya di
 * Pengaturan; kalau itu terjadi, kalimat di bawah harus ikut diperbarui.
 * Alternatifnya satu query DB di halaman yang selain ini tidak butuh apa pun.
 */
const FREE_METADATA_POINTS = DEFAULT_PLAN_POINTS.metadata.free;

/** Batas satu batch di ekstensi (BATCH_MAX_ITEMS di nerona_medata). */
const BATCH_MAX_ITEMS = 50;

const METADATA_FAQ = [
  {
    question: "Apakah saya perlu kartu kredit untuk mulai?",
    answer:
      "Tidak. Paket Free aktif seketika setelah daftar, tanpa data pembayaran apa pun. Free adalah poin percobaan sekali per akun, bukan kuota bulanan.",
  },
  {
    question: "Marketplace apa saja yang didukung?",
    answer: `${MARKETPLACE_NAMES}.`,
  },
  {
    question: "Apa itu poin, dan bagaimana kalau habis?",
    answer:
      "Poin terpakai setiap kali AI bekerja — besarnya tergantung gambar dan panjang teks yang diproses. Alat berhenti sementara kalau poin habis; mengaktifkan atau memperpanjang paket menambahkan poin baru. Poin yang belum terpakai tidak hangus.",
  },
  {
    question: "Bagaimana cara memasang ekstensinya?",
    answer:
      "Unduh folder ekstensi dari halaman Profile Anda, lalu muat lewat Chrome dengan Load unpacked. Belum melalui Chrome Web Store, jadi pembaruan kami beritahukan dari dalam aplikasi.",
  },
  {
    question: "Bagaimana cara pembayarannya?",
    answer:
      "Lewat transfer bank. Pilih paket, kirim order, transfer sesuai nominal, lalu unggah bukti transfer — tim kami memverifikasi dan mengaktifkan akun Anda, biasanya di hari yang sama.",
  },
];

/**
 * Beranda satu produk: halaman jualan Nerona Metadata.
 *
 * Isinya menyerap halaman /metadata yang lama (yang sekarang mengalihkan ke
 * sini) plus dua bagian baru: keluhan kontributor dan reject analyzer. Band
 * navy pada reject analyzer menggantikan satu-satunya bagian gelap di
 * beranda, yang dulu milik Agent — tanpa itu, sebelas bagian terang
 * berturut-turut.
 */
export async function HomeMetadataOnly() {
  const tiers = await metadataTiers();

  return (
    <main>
      <Hero />

      <ContributorPainSection />

      <FeatureSection
        id="fitur"
        title={`Satu klik. ${CLAIMABLE_MARKETPLACES.length} marketplace.`}
        body={`Bekerja langsung di formulir unggah ${MARKETPLACE_NAMES} — tanpa salin-tempel.`}
        mockup={<MarketplaceTabsMockup />}
        theme="dark"
        imageSide="left"
      />
      <FeatureSection
        title="Kata kunci yang konsisten."
        body="Puluhan kata kunci hasil AI — sebanyak yang marketplace tujuan izinkan — plus ruang untuk kata kunci Anda sendiri di setiap unggahan."
        mockup={<KeywordChipsMockup />}
        theme="light"
        imageSide="right"
      />
      <FeatureSection
        title="Dibuat untuk unggahan massal."
        body="Pilih banyak gambar sekaligus, pantau progres per gambar, dan terapkan ke semua tab marketplace yang terbuka."
        bullets={[
          `Sampai ${BATCH_MAX_ITEMS} gambar dalam satu batch`,
          "Progres per gambar, bukan satu bar buta",
          "Berhenti kapan saja tanpa kehilangan yang sudah jadi",
        ]}
        mockup={<BatchProgressMockup />}
        theme="dark"
        imageSide="left"
      />
      <FeatureSection
        title="Ditolak? Cari tahu kenapa."
        body="Reject analyzer membaca gambar Anda bersama alasan penolakan marketplace, lalu menyebut apa yang sebenarnya perlu diperbaiki — supaya unggahan berikutnya tidak mengulang kesalahan yang sama."
        bullets={[
          "Menunjuk masalahnya, bukan menebak",
          "Memberi tahu juga apa yang sudah benar",
          "Tersedia di paket Business",
        ]}
        mockup={<RejectAnalysisMockup />}
        theme="navy"
        imageSide="right"
      />

      <MarketplaceRow />

      <StepsSection
        title="Mulai dalam tiga langkah"
        subtitle="Tanpa kartu kredit."
        steps={[
          {
            title: "Daftar gratis",
            body: "Buat akun dengan email — paket Free langsung aktif, tanpa data pembayaran.",
          },
          {
            title: "Pasang ekstensi Chrome",
            body: "Unduh folder ekstensi Nerona Metadata, lalu muat lewat Chrome — kami memandu langkahnya.",
          },
          {
            title: "Upgrade saat butuh",
            body: "Poin habis? Pilih paket, transfer, dan akun aktif setelah verifikasi tim kami.",
          },
        ]}
      />

      <PricingTiers
        id="pricing"
        heading="Harga Nerona Metadata"
        subheading="Paket Free memberi poin percobaan sekali per akun. Upgrade untuk poin bulanan."
        tiers={tiers}
      />

      {/* Nada pitanya diserahkan ke FaqSection sendiri — nilai yang dulu
          dioper di sini persis sama dengan default komponennya. */}
      <FaqSection id="faq" items={METADATA_FAQ} />

      <CtaBanner
        title="Coba gratis hari ini"
        body={`Paket Free memberi ${FREE_METADATA_POINTS} poin Metadata, sekali per akun. Poin terpakai setiap kali AI bekerja — cukup untuk menilai hasilnya sebelum Anda memutuskan.`}
        ctaLabel="Buat akun gratis"
        ctaHref="/register"
      />
    </main>
  );
}
