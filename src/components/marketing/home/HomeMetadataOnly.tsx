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
import { TopupSection } from "@/components/marketing/TopupSection";
import { metadataTiers } from "@/lib/pricing-tiers";
import { getTopupPackages } from "@/lib/topup";
import { rejectAnalyzerAvailability } from "@/lib/marketing-plans";
import { defaultModelPointsPerImage, gambarPerPoin } from "@/lib/marketing-points";
import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { DEFAULT_PLAN_POINTS } from "@/lib/plan-points";
import { metadataFaq } from "@/lib/marketing-faq";

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
  // Satu putaran, bukan lima `await` berturut-turut: bagian-bagian ini tidak
  // saling bergantung, dan beranda adalah halaman yang paling sering dibuka.
  const [tiers, topupPackages, reject, poinPerGambar] = await Promise.all([
    metadataTiers(),
    getTopupPackages(),
    rejectAnalyzerAvailability(),
    defaultModelPointsPerImage(),
  ]);

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

  /**
   * Patokan yang membuat setiap angka poin di tabel harga bisa ditimbang.
   *
   * Tanpa ini, "10 poin" dan "500 poin" tidak berarti apa-apa bagi orang yang
   * belum pernah memakai alatnya — ia tidak bisa menilai apakah paketnya murah,
   * jadi ia tidak bisa memutuskan. Audit halaman menemukan ini sebagai lubang
   * terbesar di bagian harga.
   *
   * Berdiri tepat di bawah ketiga kartu, bukan di dalam salah satunya: satu
   * kalimat menerangkan ketiga angka sekaligus.
   *
   * Hilang seluruhnya kalau tarifnya belum bisa dihitung. Menebaknya berarti
   * memasang angka yang berbeda dari yang dipotong dari saldo pembeli, dan
   * selisih semacam itu ditemukan justru setelah ia membayar.
   */
  const catatanPoin =
    poinPerGambar === null
      ? null
      : `Dengan model bawaan hari ini, satu gambar memakai sekitar ${poinPerGambar.toLocaleString("id-ID")} poin.`;

  /**
   * Berapa gambar yang benar-benar tercakup jatah gratis.
   *
   * Hanya disebut kalau hasilnya minimal satu gambar: "cukup untuk sekitar 0
   * gambar" adalah kalimat yang membunuh pendaftaran, dan kalau memang itu
   * jawabannya, yang perlu diperbaiki adalah jatahnya — bukan kalimatnya.
   */
  const gambarGratis = gambarPerPoin(freePoints, poinPerGambar);

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
      {/* "Karya", bukan "foto". Contoh yang terpasang hari ini adalah vektor,
          dan menjanjikan foto tepat di atas sebuah vektor adalah kontradiksi
          yang terbaca dalam satu tarikan mata — di bagian yang seluruh tugasnya
          adalah membangun kepercayaan. Kata ini juga tetap benar begitu contoh
          foto dan render 3D menyusul, jadi ia tidak perlu diubah lagi. */}
      <ProofSection
        id="contoh"
        title="Ini hasilnya, apa adanya."
        body="Karya sungguhan, metadata yang benar-benar dihasilkan Nerona untuknya. Nilai sendiri kata kuncinya sebelum Anda mendaftar."
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

      {/* Syarat paketnya DITURUNKAN dari baris Plan, tidak diketik — sebab
          lengkapnya di lib/marketing-plans.ts. Seluruh bagiannya hilang kalau
          tidak ada paket yang menawarkannya: satu pita penuh untuk fitur yang
          tidak bisa dibeli siapa pun lebih buruk daripada tidak ada bagiannya. */}
      {reject.plans.length > 0 && (
        <FeatureSection
          title="Ditolak? Cari tahu kenapa."
          body="Reject analyzer membaca gambar Anda bersama alasan penolakan marketplace, lalu menyebut apa yang sebenarnya perlu diperbaiki — supaya unggahan berikutnya tidak mengulang kesalahan yang sama."
          bullets={[
            "Menunjuk masalahnya, bukan menebak",
            "Memberi tahu juga apa yang sudah benar",
            ...(reject.note ? [reject.note] : []),
          ]}
          mockup={<RejectAnalysisMockup />}
          theme="navy"
          imageSide="right"
        />
      )}

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
            body: "Poin habis? Pilih paket, transfer sekali, dan akun aktif setelah verifikasi tim kami — tanpa tagihan bulanan.",
          },
        ]}
      />

      {/* Subjudul lamanya berbunyi "Upgrade untuk poin bulanan" sementara tiap
          kartu di bawahnya menulis "sekali bayar". Yang benar ada di kode:
          lisensi tanpa tanggal akhir, poin dikreditkan sekali per aktivasi. */}
      <PricingTiers
        id="pricing"
        heading="Harga Nerona Metadata"
        subheading="Paket Free memberi poin percobaan sekali per akun. Paket berbayar dibeli sekali — aksesnya berlaku selamanya."
        tiers={tiers}
        catatanPoin={catatanPoin}
      />

      {/* Sudah ada di /pricing sejak alur sekali bayar, tapi tidak pernah di
          beranda — padahal beranda punya tabel harganya sendiri, dan justru di
          sinilah pertanyaan "kalau poin habis, saya bayar apa lagi?" muncul.
          Bagian ini adalah jawabannya, dan tanpanya seluruh model harga baru
          hanya terjelaskan setengah. */}
      <TopupSection packages={topupPackages} />

      {/* Daftarnya pindah ke lib/marketing-faq.ts: isinya tumbuh dari lima jadi
          sepuluh, dan tiap jawaban baru diturunkan dari kode yang benar-benar
          berjalan — sumbernya dicatat per pertanyaan di berkas itu. */}
      {/* Cekung, supaya pergantian latar benar-benar sampai ke bawah.
          Sebelumnya bagian harga dan bagian ini sama-sama putih — dua pita
          putih berturut-turut tepat sebelum banner penutup, persis cacat yang
          docblock di atas mengaku sudah dibereskan. Terhitung dari peramban,
          bukan dari membaca kode: keduanya rgb(255,255,255). */}
      <FaqSection id="faq" tone="sunken" items={metadataFaq({ poinPerGambar })} />

      <CtaBanner
        title="Coba gratis hari ini"
        body={
          gambarGratis && gambarGratis > 0
            ? `Paket Free memberi ${freePoints} poin Metadata, sekali per akun — sekitar ${gambarGratis.toLocaleString("id-ID")} gambar. Cukup untuk menilai hasilnya sebelum Anda memutuskan.`
            : `Paket Free memberi ${freePoints} poin Metadata, sekali per akun. Poin terpakai setiap kali AI bekerja — cukup untuk menilai hasilnya sebelum Anda memutuskan.`
        }
        ctaLabel="Buat akun gratis"
        ctaHref="/register"
      />
    </main>
  );
}
