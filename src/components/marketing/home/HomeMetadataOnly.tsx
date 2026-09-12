import { Hero } from "@/components/marketing/Hero";
import { TrustBar } from "@/components/marketing/TrustBar";
import { DemoBand } from "@/components/marketing/DemoBand";
import { ProofSection } from "@/components/marketing/ProofSection";
import { MarketplaceRow } from "@/components/marketing/MarketplaceRow";
import { FaqSection } from "@/components/marketing/FaqSection";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { metadataTiers } from "@/lib/pricing-tiers";
import { getTopupPackages, perPointLabel } from "@/lib/topup";
import { defaultModelPointsPerImage, gambarPerPoin } from "@/lib/marketing-points";
import { demoVideoUrl } from "@/lib/marketing-demo";
import { DEFAULT_PLAN_POINTS } from "@/lib/plan-points";
import { metadataFaqBeranda } from "@/lib/marketing-faq";

/**
 * Beranda satu produk: halaman jualan Nerona Metadata.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LIMA SEKSI, BUKAN DELAPAN
 * ─────────────────────────────────────────────────────────────────────────
 * Tiga seksi lagi dibuang 2026-09-12 atas permintaan owner ("kurang menarik"):
 * baris tiga angka (KeyNumbersSection), keluhan kontributor
 * (ContributorPainSection), dan pita batch + analisis penolakan
 * (BatchDanRejectSection). Komponennya tetap ada di repo, seperti
 * ComparisonSection sebelumnya. Yang tersisa: hero, contoh hasil, harga, FAQ,
 * penutup — plus dua rak tipis di bawah hero.
 *
 * Yang IKUT hilang: anchor `#fitur`. Tautan "Fitur" di bilah atas sempat
 * dibiarkan menunjuk ke tujuan yang tidak ada, lalu DIHAPUS dari
 * marketingNav() hari yang sama: tautan nav tanpa tujuan adalah cacat, bukan
 * cadangan (antislop R-24). Kalau seksi fitur kembali, kembalikan tautannya
 * bersama seksinya, bukan sebaliknya.
 *
 * Riwayat pemangkasan sebelumnya (sebelas → delapan) tetap di bawah, karena
 * alasan tiap potongannya masih berlaku.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Susunan sebelumnya sudah memecah monokultur BENTUK — empat bentuk seksi
 * berbeda menyisip di antara pita dua-kolom. Yang belum dipecah adalah
 * monokultur BOBOT: setiap seksi, bentuk apa pun, membawa judul + subjudul +
 * paragraf + bullet + kartu, dan menjelaskan hal yang sama tiga kali padahal
 * mockup di sebelahnya sudah membuktikannya sendiri.
 *
 * Yang dipotong, dan ke mana:
 *
 * - "Pekerjaan yang sama, dari dua sisi" (ComparisonSection) — dihapus dari
 *   beranda. Keempat barisnya mengulang seksi lain satu per satu, dan ini
 *   pemotongan terbesar sekaligus paling aman di halaman. Komponennya tetap
 *   ada di repo.
 * - "Satu klik. N marketplace." — jadi satu angka di KeyNumbersSection.
 * - "Kata kunci yang konsisten." — lebur ke ProofSection, yang memang
 *   memperlihatkan kata kuncinya, bukan menjanjikannya.
 * - "Mulai dalam tiga langkah" (StepsSection) — perannya diambil band demo:
 *   satu rekaman layar membuktikan alurnya lebih cepat daripada tiga kartu
 *   yang menjelaskannya.
 * - "Kehabisan poin? Isi ulang." (TopupSection) — jadi SATU baris di bawah
 *   kartu harga, tempat pertanyaannya benar-benar muncul.
 * - "Ditolak? Cari tahu kenapa" — bergabung dengan seksi batch jadi satu pita
 *   dua kolom.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IRAMA LATAR
 * ─────────────────────────────────────────────────────────────────────────
 * Navy hanya di pembuka, band demo, dan penutup. Kalau seluruh halaman navy,
 * kesan monoton tidak hilang seberapa pun warnanya ditambah — dan pergantian
 * latar inilah alat ritme utamanya: itu yang membuat mata tahu seksi baru
 * dimulai, tanpa perlu memperbesar judulnya.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DUA RAK YANG TETAP TINGGAL
 * ─────────────────────────────────────────────────────────────────────────
 * MarketplaceRow dan TrustBar bukan seksi — keduanya rak tipis dengan garis
 * rambut dan tanpa irama pita (lihat docblock masing-masing), jadi keduanya
 * tidak masuk hitungan delapan. TrustBar juga satu-satunya bukti sosial di
 * halaman ini, dan ia sudah mengembalikan null sendiri selama angkanya belum
 * melewati ambang.
 */
export async function HomeMetadataOnly() {
  /**
   * Dihitung lebih dulu, DI LUAR Promise.all, karena tabel harga ikut
   * memakainya.
   *
   * Menaruhnya di dalam Promise.all berarti memanggilnya dua kali — sekali
   * untuk kalimat patokan, sekali lagi di dalam argumen metadataTiers — dan
   * dua kueri untuk satu angka yang sama.
   */
  const poinPerGambar = await defaultModelPointsPerImage();

  // Satu putaran untuk sisanya: bagian-bagian ini tidak saling bergantung, dan
  // beranda adalah halaman yang paling sering dibuka.
  const [tiers, topupPackages, demoUrl] = await Promise.all([
    metadataTiers(1, poinPerGambar),
    getTopupPackages(),
    demoVideoUrl(),
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
   * Sejak perkiraan "≈ N gambar" masuk ke baris jatah di setiap kartu, kalimat
   * ini berhenti jadi satu-satunya penerjemah dan turun jadi keterangan
   * tarifnya. Ia tetap ada karena angka di kartu adalah pembulatan ke bawah,
   * dan orang yang menghitung sendiri berhak tahu angka aslinya.
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
   * Satu baris pengganti seluruh seksi isi ulang.
   *
   * Harga per poin diambil dari paket TERMURAH per poin, sama seperti yang
   * ditandai "Paling hemat" di seksi lamanya — bukan dari paket pertama, yang
   * kebetulan urutannya saja. Null kalau tidak ada paket sama sekali, dan
   * barisnya hilang.
   */
  const termurah = topupPackages.length
    ? topupPackages.reduce((a, b) => (b.price / b.points < a.price / a.points ? b : a))
    : null;
  const catatanIsiUlang = termurah
    ? `Poin habis? Isi ulang dari ${perPointLabel(termurah)} — tanpa langganan, dan poin yang belum terpakai tidak hangus.`
    : null;

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

      {/* Mengembalikan kosong sampai URL videonya diisi owner — lihat
          lib/marketing-demo.ts. Sampai saat itu, halaman melompat langsung ke
          contoh hasil, dan tidak ada satu pun bingkai kosong yang tertinggal. */}
      <DemoBand url={demoUrl} />

      {/* Bagian terpenting di halaman: satu-satunya yang MEMPERLIHATKAN mutu
          AI alih-alih mengatakannya. Judul dan kalimatnya dipangkas jadi dua
          baris — kata kuncinya sendiri yang harus dibaca, bukan pengantarnya. */}
      <ProofSection
        id="contoh"
        title="Ini hasilnya, apa adanya"
        body="Karya sungguhan, metadata yang benar-benar dihasilkan Nerona untuknya."
      />

      {/* POLOS, karena contoh hasil di atasnya sudah cekung.
          Sebelum tiga seksi dipangkas, di antara keduanya ada dua pita polos,
          jadi harga yang cekung memang bergantian. Sekarang mereka
          bersebelahan, dan dua pita cekung berturut-turut menghapus satu-satunya
          tanda "seksi baru dimulai" di sini. Iramanya kini: cekung (contoh),
          polos (harga), cekung (FAQ), navy (penutup). */}
      <PricingTiers
        tone="plain"
        id="pricing"
        heading="Harga Nerona Metadata"
        subheading="Paket Free memberi poin percobaan sekali per akun. Paket berbayar dibeli sekali — aksesnya berlaku selamanya."
        tiers={tiers}
        catatanPoin={catatanPoin}
        catatanIsiUlang={catatanIsiUlang}
      />

      {/* Enam pertanyaan, bukan sebelas — sisanya di /faq, dan FaqSection
          sendiri yang menautkannya. Cekung, mengapit harga yang polos; lihat
          komentar di atas PricingTiers. */}
      <FaqSection
        id="faq"
        tone="sunken"
        items={metadataFaqBeranda({ poinPerGambar })}
        semuaHref="/faq"
      />

      <CtaBanner
        title="Coba gratis hari ini"
        body={
          gambarGratis && gambarGratis > 0
            ? `${freePoints} poin, sekitar ${gambarGratis.toLocaleString("id-ID")} gambar — cukup untuk menilai hasilnya.`
            : `${freePoints} poin percobaan, cukup untuk menilai hasilnya.`
        }
        ctaLabel="Coba gratis"
        ctaHref="/register"
      />
    </main>
  );
}
