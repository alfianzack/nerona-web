import { Hero } from "@/components/marketing/Hero";
import { RuangKata } from "@/components/marketing/ruang/RuangKata";
import { Lapisan } from "@/components/marketing/ruang/Lapisan";
import { RUANG } from "@/lib/ruang";
import { ProofSection } from "@/components/marketing/ProofSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { metadataTiers } from "@/lib/pricing-tiers";
import { getTopupPackages, perPointLabel } from "@/lib/topup";
import { defaultModelPointsPerImage, gambarPerPoin } from "@/lib/marketing-points";
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
  const [tiers, topupPackages] = await Promise.all([
    metadataTiers(1, poinPerGambar),
    getTopupPackages(),
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
    ? `Poin habis? Isi ulang dari ${perPointLabel(termurah)}, tanpa langganan, dan poin yang belum terpakai tidak hangus.`
    : null;

  /**
   * Berapa gambar yang benar-benar tercakup jatah gratis.
   *
   * Hanya disebut kalau hasilnya minimal satu gambar: "cukup untuk sekitar 0
   * gambar" adalah kalimat yang membunuh pendaftaran, dan kalau memang itu
   * jawabannya, yang perlu diperbaiki adalah jatahnya — bukan kalimatnya.
   */
  const gambarGratis = gambarPerPoin(freePoints, poinPerGambar);

  // Lima lapisan pada kedalaman RUANG.LAPISAN_Z. `id` anchor dipegang
  // Lapisan, BUKAN seksi di dalamnya: dua elemen ber-id sama membuat nav dan
  // tombol hero mendarat di yang salah.
  const lapisan = [
    { z: RUANG.LAPISAN_Z[0], nama: "Beranda" },
    { z: RUANG.LAPISAN_Z[1], nama: "Contoh", id: "contoh" },
    { z: RUANG.LAPISAN_Z[2], nama: "Harga", id: "pricing" },
    { z: RUANG.LAPISAN_Z[3], nama: "FAQ", id: "faq" },
    { z: RUANG.LAPISAN_Z[4], nama: "Mulai" },
  ];

  return (
    <main>
      <RuangKata lapisan={lapisan}>
        <Lapisan {...lapisan[0]}>
          <Hero freePoints={freePoints} dalamRuang />
        </Lapisan>

        {/* Bagian terpenting di halaman: satu-satunya yang MEMPERLIHATKAN mutu
            AI alih-alih mengatakannya. */}
        <Lapisan {...lapisan[1]}>
          <ProofSection
            tone="ruang"
            title="Ini hasilnya, apa adanya"
            body="Karya sungguhan, metadata yang benar-benar dihasilkan Nerona untuknya."
          />
        </Lapisan>

        <Lapisan {...lapisan[2]}>
          <PricingTiers
            tone="ruang"
            heading="Harga Nerona Metadata"
            subheading="Paket Free memberi poin percobaan sekali per akun. Paket berbayar dibeli sekali, aksesnya berlaku selamanya."
            tiers={tiers}
            catatanPoin={catatanPoin}
            catatanIsiUlang={catatanIsiUlang}
          />
        </Lapisan>

        {/* Enam pertanyaan, bukan sebelas; sisanya di /faq. */}
        <Lapisan {...lapisan[3]}>
          <FaqSection tone="ruang" items={metadataFaqBeranda({ poinPerGambar })} semuaHref="/faq" />
        </Lapisan>

        <Lapisan {...lapisan[4]}>
          <CtaBanner
            tone="ruang"
            title="Coba gratis hari ini"
            body={
              gambarGratis && gambarGratis > 0
                ? `${freePoints} poin, sekitar ${gambarGratis.toLocaleString("id-ID")} gambar: cukup untuk menilai hasilnya.`
                : `${freePoints} poin percobaan, cukup untuk menilai hasilnya.`
            }
            ctaLabel="Coba gratis"
            ctaHref="/register"
          />
        </Lapisan>
      </RuangKata>
    </main>
  );
}
