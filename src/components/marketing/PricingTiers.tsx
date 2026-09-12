import { Band } from "@/components/ui/Band";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { CardRibbon } from "@/components/marketing/CardRibbon";
import { cn } from "@/components/ui/cn";
import { TextLink } from "@/components/ui/TextLink";
import { Icon } from "@/components/ui/icons";

export interface PricingTierFeature {
  label: string;
  included: boolean;
}

export interface PricingTier {
  name: string;
  tagline: string;
  /** Angkanya saja — "Rp 89.000", "Gratis". Keterangannya di `priceNote`. */
  priceLabel: string;
  /**
   * Baris kecil di bawah angka: "sekali bayar", "selamanya".
   *
   * Terpisah dari angkanya karena disatukan ia mengalir ke baris kedua di
   * ukuran judul — dan begitu satu kartu setinggi dua baris sementara yang lain
   * satu baris, seluruh isi ketiga kartu berhenti sebaris.
   */
  priceNote?: string | null;
  /**
   * Sisa dari alur berdurasi. Sejak pembelian jadi sekali bayar tidak ada lagi
   * penghematan durasi untuk ditampilkan, jadi nilainya selalu kosong — kolomnya
   * dipertahankan supaya pemanggil lama tidak patah.
   */
  savingsLabel?: string | null;
  /** Poin yang ikut di pembelian pertama. */
  poinAwal?: number | null;
  features: PricingTierFeature[];
  cta: string;
  href: string;
  featured?: boolean;
}

/**
 * Harga utuh dalam satu baris, untuk tempat yang bukan kartu harga: ringkasan
 * checkout dan halaman order. Di sana tidak ada tiga kartu yang perlu sebaris,
 * jadi angka dan keterangannya justru harus menyatu.
 */
export function fullPriceLabel(tier: Pick<PricingTier, "priceLabel" | "priceNote">): string {
  return tier.priceNote ? `${tier.priceLabel} ${tier.priceNote}` : tier.priceLabel;
}

/**
 * Centang memakai satu-satunya warna aksen halaman, dan tanda silang justru
 * turun jadi abu-abu.
 *
 * Merah di sebelah fitur yang memang tidak termasuk paket terbaca seperti
 * kesalahan, padahal itu cuma ketiadaan. Sebelumnya keduanya ditulis sebagai
 * lingkaran berlatar emerald/rose dengan glyph ✓ dan ✕ — dua warna status
 * tambahan di kartu yang sudah punya biru, emas, dan hijau sekaligus.
 */
function FeatureIcon({ included, ringkas = false }: { included: boolean; ringkas?: boolean }) {
  return (
    <Icon
      name={included ? "check" : "close"}
      className={cn(
        "flex-none",
        ringkas ? "mt-0.5 h-3.5 w-3.5" : "mt-1 h-4 w-4",
        included ? "text-accent" : "text-muted",
      )}
    />
  );
}

/**
 * Tiga kartu yang benar-benar sebaris.
 *
 * Empat hal menjaganya, dan ketiganya pernah bocor sekaligus:
 *
 * 1. Kartunya setinggi kartu tertinggi (`items-stretch`, bukan `items-start`).
 *    Dengan `items-start` setiap kartu setinggi isinya sendiri, jadi tombol
 *    "Mulai Gratis" berhenti 34px di atas dua tombol tetangganya.
 * 2. Angka harga dan keterangannya dua baris terpisah — lihat `priceNote`.
 * 3. Tagline memesan tinggi dua baris, jadi harga di ketiga kartu mulai di garis
 *    yang sama walau satu tagline mengalir dan yang lain tidak.
 * 4. Daftar fitur yang memanjang (`flex-1`) mendorong tombol ke dasar kartu,
 *    jadi jumlah fitur yang berbeda tidak lagi menggeser tombolnya.
 */
export function PricingTierGrid({
  tiers,
  ringkas = false,
}: {
  tiers: PricingTier[];
  /**
   * Versi ringkas untuk Ruang Kata.
   *
   * Di dalam ruang, lapisan yang lebih tinggi dari panggungnya diskalakan
   * supaya muat saat fokus, dan tabel harga penuh (±940px) turun ke 0,66 pada
   * 1280×720 — huruf 9–10px. Alih-alih mengecilkan seluruhnya, kartunya yang
   * dirapatkan: padding md, harga title-2, fitur caption, tagline satu baris.
   * Isinya (nama, harga, empat fitur, tombol) sama persis; yang berubah hanya
   * napasnya. /pricing tetap memakai versi penuh.
   */
  ringkas?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-3", ringkas ? "gap-4" : "gap-6")}>
      {tiers.map((tier) => {
        // Varian accent, bukan default plus cincin dari luar: menimpa cincin
        // lewat className gagal secara diam-diam. Sebabnya ditulis di Card.tsx.
        return (
          <Card
            key={tier.name}
            variant={tier.featured ? "unggulan" : "default"}
            padding={ringkas ? "md" : "lg"}
            className="relative flex h-full flex-col"
          >
            {/* Aksen, bukan emas: halaman publik hanya punya satu warna aksen,
                dan emas disimpan untuk aksi yang menggerakkan uang di dalam
                aplikasi. */}
            {/* Pitanya MENGAMBANG di tepi atas, tidak ikut aliran kartu.
                Pil sejajar isi akan mendorong seluruh isi kartu unggulan turun
                relatif terhadap dua tetangganya, dan tiga kartu yang harganya
                tidak sebaris adalah cacat yang docblock di atas sudah
                menghabiskan empat poin untuk mencegahnya. */}
            {tier.featured && <CardRibbon nada="amber">Paling populer</CardRibbon>}

            <h3 className="text-title-2 text-ink">{tier.name}</h3>
            {/* Dua baris dipesan di sini, bukan disamakan belakangan: caption
                12px × line-height 1.5 = 18px per baris. */}
            <p className={cn("mt-1 text-caption text-muted", ringkas ? "truncate" : "min-h-[2.25rem]")}>
              {tier.tagline}
            </p>

            {/* Harga kartu unggulan ber-amber-gelap (`emphasis`), bukan
                amber mentah: angka sebesar ini di atas putih adalah tempat
                kontras paling mudah gagal, dan `--action` memang dipilih untuk
                jadi LATAR tombol, bukan warna teks. */}
            <p
              className={cn(
                "tabular-nums",
                ringkas ? "mt-3 text-title-2" : "mt-4 text-title-1",
                tier.featured ? "text-emphasis" : "text-ink",
              )}
            >
              {tier.priceLabel}
            </p>
            {/* Barisnya tetap ada walau kosong — kalau tidak, kartu "Hubungi
                kami" naik 18px sendirian. */}
            <p className="mt-1.5 text-caption text-muted">{tier.priceNote || " "}</p>
            {tier.savingsLabel && (
              <p className="mt-1.5 text-caption text-success">{tier.savingsLabel}</p>
            )}

            <div className={cn("h-px bg-divider", ringkas ? "my-4" : "my-6")} />

            <ul className={cn("flex-1 text-ink", ringkas ? "space-y-2 text-caption" : "space-y-3 text-body")}>
              {tier.features.map((feature) => (
                <li key={feature.label} className="flex items-start gap-2.5">
                  <FeatureIcon included={feature.included} ringkas={ringkas} />
                  <span className={feature.included ? "" : "text-muted line-through decoration-1"}>
                    {/* Satu-satunya penanda "tidak termasuk" di baris ini
                        dulunya adalah coretan CSS dan sebuah glyph di dalam
                        <svg> tanpa nama. Keduanya tidak terbaca pembaca layar:
                        fitur yang TIDAK didapat diumumkan persis sama dengan
                        yang didapat, jadi pengguna tunanetra mendengar paket
                        Free menawarkan reject analyzer dan Nerona Hub.
                        Itu bukan soal gaya — itu tabel harga yang berbohong
                        kepada sebagian pembacanya.

                        Audit halaman menemukan versi terlihatnya dari cacat
                        yang sama: keempat baris tampak seragam di ketiga kartu,
                        dan coretan tipis berwarna abu di antara teks abu
                        terbaca sebagai daftar centang. */}
                    <span className="sr-only">
                      {feature.included ? "Termasuk: " : "Tidak termasuk: "}
                    </span>
                    {feature.label}
                  </span>
                </li>
              ))}
            </ul>

            {/* Ketiga tombol setingkat. Yang membedakan paket unggulan adalah
                cincin dan pitanya — bukan tombolnya, karena tombol emas di
                sebelah tombol abu-abu membuat paket lain terlihat seperti
                pilihan yang salah. */}
            <ButtonLink href={tier.href} full className={ringkas ? "mt-5" : "mt-7"}>
              {tier.cta}
            </ButtonLink>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Pita harga, arah Bening.
 *
 * Yang dibuang: dua blob kabur 320px (emas di kiri atas, biru di kanan bawah)
 * yang tidak menandai apa pun dan menjadi satu-satunya alasan bagian ini butuh
 * pemotongan luapan, bayangan terbesar di setiap kartu, gradien putih menuju
 * #F4F8FD yang tidak mengerjakan apa pun, dan angkatan ke atas pada kartu
 * unggulan.
 *
 * Nama kelas sengaja tidak ditulis di komentar ini: pemindai Tailwind ikut
 * membaca komentar, jadi menyebut kelas yang baru saja dibuang justru
 * menghidupkannya kembali di bundel CSS.
 *
 * Yang naik: `heading` berhenti jadi label kecil huruf besar dan menjadi judul
 * bagian sungguhan, `subheading` naik dari 14px ke text-lead. Selama ini kedua
 * baris itu ditulis lebih kecil daripada isi kartunya sendiri.
 */
export function PricingTiers({
  id,
  tone,
  heading,
  subheading,
  tiers,
  catatanPoin,
  catatanIsiUlang,
  ringkas = false,
}: {
  id?: string;
  /** Nada pita, supaya irama latar halaman bisa diatur dari pemanggilnya. */
  tone?: "plain" | "sunken" | "ruang";
  /** Kartu & catatan versi ringkas; lihat PricingTierGrid. */
  ringkas?: boolean;
  heading: string;
  subheading: string;
  tiers: PricingTier[];
  /**
   * Patokan "satu gambar ≈ N poin", dihitung pemanggil dari tarif yang sedang
   * berlaku (lib/marketing-points.ts). Opsional, dan sengaja BOLEH null:
   * setiap kartu di atasnya menyebut jatah dalam poin, dan tanpa patokan
   * angka-angka itu tidak bisa ditimbang pengunjung yang belum pernah memakai
   * alatnya. Kalau tarifnya belum bisa dihitung, kalimatnya hilang — halaman
   * ini tidak menebak angka.
   */
  catatanPoin?: string | null;
  /**
   * Satu baris yang menggantikan SELURUH seksi "Kehabisan poin? Isi ulang."
   *
   * Seksi itu menjawab pertanyaan yang muncul tepat setelah orang melihat
   * ketiga kartu — "kalau poin habis, saya bayar apa lagi?" — tapi ia berdiri
   * satu pita di bawahnya, dengan judul sebesar judul harga. Pertanyaan
   * sepenting itu memang harus dijawab; ia tidak butuh satu layar penuh.
   *
   * Null berarti tidak ada paket isi ulang yang bisa dibeli, dan barisnya
   * hilang seluruhnya — sama seperti TopupSection dulu mengembalikan null.
   */
  catatanIsiUlang?: string | null;
}) {
  return (
    <Band id={id} tone={tone} align="center" reveal>
      <h2 className="text-balance text-display-2 text-ink">{heading}</h2>
      <p
        className={cn(
          "mx-auto max-w-[46ch] text-balance text-muted",
          ringkas ? "mt-3 text-body-lg" : "mt-5 text-lead",
        )}
      >
        {subheading}
      </p>

      {/* Yang rata tengah cuma judul pitanya; isi kartu tetap rata kiri supaya
          daftar fiturnya bisa dibaca menurun. */}
      <div className={cn("text-left", ringkas ? "mt-8" : "mt-14")}>
        <PricingTierGrid tiers={tiers} ringkas={ringkas} />
      </div>

      {/* Di atas catatan pembayaran, bukan di bawahnya: yang dibaca orang tepat
          setelah melihat tiga angka poin adalah "berapa gambar itu?", bukan
          "bagaimana cara transfernya". */}
      {catatanPoin && (
        <p className={cn("mx-auto max-w-[64ch] text-caption text-muted", ringkas ? "mt-6" : "mt-10")}>
          {catatanPoin}
        </p>
      )}

      {/* Isi ulang, satu baris. Berdiri di ukuran body, bukan caption: ini
          jawaban atas keberatan yang sungguhan, bukan catatan kaki. */}
      {catatanIsiUlang && (
        <p className={cn("mx-auto max-w-[64ch] text-muted", ringkas ? "mt-2 text-caption" : "mt-6 text-body")}>
          {catatanIsiUlang}{" "}
          <TextLink href="/finance" className="font-semibold">
            Isi ulang di halaman Keuangan
          </TextLink>
        </p>
      )}

      {/* Di versi ringkas paragraf tata cara bayar tidak ikut: jawabannya sudah
          ada di FAQ satu lapisan di bawahnya ("Bagaimana cara pembayarannya?")
          dan di /pricing, dan tiga barisnya sendirian memakan ±60px dari
          anggaran tinggi lapisan. */}
      {!ringkas && (
      <p className={cn("mx-auto max-w-[64ch] text-caption text-muted", catatanPoin ? "mt-3" : "mt-10")}>
        Paket dibeli sekali dan aksesnya berlaku selamanya: tidak ada tagihan bulanan dan tidak ada
        perpanjangan. Pembayaran diatur langsung dengan tim Nerona: pilih paket, kirim order,
        selesaikan pembayaran, dan akun Anda diaktifkan. Paket Free aktif seketika tanpa pembayaran.
      </p>
      )}
    </Band>
  );
}
