import { Hero } from "@/components/marketing/Hero";
import { TrustBar } from "@/components/marketing/TrustBar";
import { ContributorPainSection } from "@/components/marketing/ContributorPainSection";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { ProofSection } from "@/components/marketing/ProofSection";
import { ComparisonSection } from "@/components/marketing/ComparisonSection";
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
import { METADATA_FAQ } from "@/lib/marketing-faq";

const MARKETPLACE_NAMES = CLAIMABLE_MARKETPLACES.map((m) => m.label).join(", ");

/** Batas satu batch di ekstensi (BATCH_MAX_ITEMS di nerona_medata). */
const BATCH_MAX_ITEMS = 50;

/**
 * Beranda satu produk: halaman jualan Nerona Metadata.
 *
 * Susunannya ditulis ulang setelah audit menemukan halaman ini memakai DUA
 * bentuk bagian saja — empat pita dua-kolom bolak-balik, lalu lima tumpukan
 * rata tengah. Mata belajar polanya di bagian ketiga lalu berhenti melihat.
 * Itu penyakit yang sama dengan monokultur komponen yang sudah dibereskan,
 * hanya satu tingkat lebih tinggi.
 *
 * Empat bentuk baru menyisip di antara yang lama, masing-masing dengan
 * siluetnya sendiri:
 *
 * - TrustBar: strip tipis, bukan pita. Angkanya nyata dari basis data, dan
 *   seluruh barisnya tidak dirender kalau belum cukup besar.
 * - ProofSection: foto sungguhan bersanding dengan metadata yang benar-benar
 *   dihasilkan untuknya. Ini bagian terpenting di halaman — pembaca menilai
 *   mutu AI langsung dari kata kuncinya, bukan dari kalimat kita. Belum
 *   dirender sampai owner mengisi contohnya; sampai saat itu ia mengembalikan
 *   kosong, bukan bingkai gambar yang menganga.
 * - ComparisonSection: dua kolom berdampingan, memecah deretan empat
 *   FeatureSection jadi dua-dua.
 * - FaqSection: judul di samping, daftar di kanan.
 *
 * Latarnya juga berselang-seling sampai bawah sekarang. Sebelumnya pergantian
 * berhenti setelah bagian keenam dan menyisakan empat pita putih berturut-turut.
 */
export async function HomeMetadataOnly() {
  const tiers = await metadataTiers();

  /**
   * Poin Free yang BENAR-BENAR berlaku, bukan default kode.
   *
   * metadataTiers() sudah menyelesaikannya lewat rantai DB → env → default di
   * request yang sama, jadi membacanya dari sini berbiaya nol query tambahan.
   * Sebelumnya hero dan banner penutup sama-sama membaca konstanta kode, dan
   * keduanya diam-diam salah begitu owner menimpa nilainya di Pengaturan.
   */
  const freePoints =
    tiers.find((tier) => tier.name === "Free")?.poinAwal ?? DEFAULT_PLAN_POINTS.metadata.free;

  return (
    <main>
      <Hero freePoints={freePoints} />

      {/* Langsung menutup hero, bukan di dasar halaman.
          Nama-nama inilah yang paling cepat dikenali pengunjung, dan sebelumnya
          mereka baru muncul di layar keenam — jauh setelah orang memutuskan
          apakah halaman ini layak dibaca terus. */}
      <MarketplaceRow variant="strip" />

      {/* Mengembalikan kosong sampai angkanya melewati ambang — lihat sebabnya
          di lib/marketing-stats.ts. Menaruhnya di sini aman sejak hari pertama. */}
      <TrustBar />

      <ContributorPainSection />

      <FeatureSection
        id="fitur"
        title={`Satu klik. ${CLAIMABLE_MARKETPLACES.length} marketplace.`}
        body={`Bekerja langsung di formulir unggah ${MARKETPLACE_NAMES} — tanpa salin-tempel.`}
        mockup={<MarketplaceTabsMockup />}
        theme="dark"
        imageSide="left"
      />

      {/* Ditaruh tepat setelah klaim pertama, bukan di dasar halaman: klaim
          "metadata otomatis" paling murah dibuktikan persis setelah diucapkan. */}
      <ProofSection
        id="contoh"
        title="Ini hasilnya, apa adanya."
        body="Foto sungguhan, metadata yang benar-benar dihasilkan Nerona untuknya. Nilai sendiri kata kuncinya sebelum Anda mendaftar."
      />

      <FeatureSection
        title="Kata kunci yang konsisten."
        body="Puluhan kata kunci hasil AI — sebanyak yang marketplace tujuan izinkan — plus ruang untuk kata kunci Anda sendiri di setiap unggahan."
        mockup={<KeywordChipsMockup />}
        theme="dark"
        imageSide="right"
      />

      <ComparisonSection id="banding" />

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

      {/* Deretan marketplace yang dulu berdiri di sini sudah pindah ke bawah
          hero. Tidak digandakan: tujuh nama yang sama, dua kali di satu
          halaman, berhenti jadi bukti dan mulai jadi pengulangan — dan
          halaman ini sudah terlalu panjang. */}

      <StepsSection
        tone="sunken"
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

      {/* Daftarnya pindah ke lib/marketing-faq.ts: isinya tumbuh dari lima jadi
          sepuluh, dan tiap jawaban baru diturunkan dari kode yang benar-benar
          berjalan — sumbernya dicatat per pertanyaan di berkas itu. */}
      {/* Cekung, supaya pergantian latar benar-benar sampai ke bawah.
          Sebelumnya bagian harga dan bagian ini sama-sama putih — dua pita
          putih berturut-turut tepat sebelum banner penutup, persis cacat yang
          docblock di atas mengaku sudah dibereskan. Terhitung dari peramban,
          bukan dari membaca kode: keduanya rgb(255,255,255). */}
      <FaqSection id="faq" tone="sunken" items={METADATA_FAQ} />

      <CtaBanner
        title="Coba gratis hari ini"
        body={`Paket Free memberi ${freePoints} poin Metadata, sekali per akun. Poin terpakai setiap kali AI bekerja — cukup untuk menilai hasilnya sebelum Anda memutuskan.`}
        ctaLabel="Buat akun gratis"
        ctaHref="/register"
      />
    </main>
  );
}
