import { Band } from "@/components/ui/Band";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { CardRibbon } from "@/components/marketing/CardRibbon";
import { cn } from "@/components/ui/cn";
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
function FeatureIcon({ included }: { included: boolean }) {
  return (
    <Icon
      name={included ? "check" : "close"}
      className={cn("mt-1 h-4 w-4 flex-none", included ? "text-accent" : "text-muted")}
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
export function PricingTierGrid({ tiers }: { tiers: PricingTier[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {tiers.map((tier) => {
        // Varian accent, bukan default plus cincin dari luar: menimpa cincin
        // lewat className gagal secara diam-diam. Sebabnya ditulis di Card.tsx.
        return (
          <Card
            key={tier.name}
            variant={tier.featured ? "accent" : "default"}
            padding="lg"
            className="relative flex h-full flex-col"
          >
            {/* Aksen, bukan emas: halaman publik hanya punya satu warna aksen,
                dan emas disimpan untuk aksi yang menggerakkan uang di dalam
                aplikasi. */}
            {tier.featured && <CardRibbon>Paling populer</CardRibbon>}

            <h3 className="text-title-2 text-ink">{tier.name}</h3>
            {/* Dua baris dipesan di sini, bukan disamakan belakangan: caption
                12px × line-height 1.5 = 18px per baris. */}
            <p className="mt-1 min-h-[2.25rem] text-caption text-muted">{tier.tagline}</p>

            <p className="mt-4 text-title-1 tabular-nums text-ink">{tier.priceLabel}</p>
            {/* Barisnya tetap ada walau kosong — kalau tidak, kartu "Hubungi
                kami" naik 18px sendirian. */}
            <p className="mt-1.5 text-caption text-muted">{tier.priceNote || " "}</p>
            {tier.savingsLabel && (
              <p className="mt-1.5 text-caption text-success">{tier.savingsLabel}</p>
            )}

            <div className="my-6 h-px bg-divider" />

            <ul className="flex-1 space-y-3 text-body text-ink">
              {tier.features.map((feature) => (
                <li key={feature.label} className="flex items-start gap-2.5">
                  <FeatureIcon included={feature.included} />
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
            <ButtonLink href={tier.href} full className="mt-7">
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
  heading,
  subheading,
  tiers,
  catatanPoin,
}: {
  id?: string;
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
}) {
  return (
    <Band id={id} align="center">
      <h2 className="text-balance text-display-2 text-ink">{heading}</h2>
      <p className="mx-auto mt-5 max-w-[46ch] text-balance text-lead text-muted">{subheading}</p>

      {/* Yang rata tengah cuma judul pitanya; isi kartu tetap rata kiri supaya
          daftar fiturnya bisa dibaca menurun. */}
      <div className="mt-14 text-left">
        <PricingTierGrid tiers={tiers} />
      </div>

      {/* Di atas catatan pembayaran, bukan di bawahnya: yang dibaca orang tepat
          setelah melihat tiga angka poin adalah "berapa gambar itu?", bukan
          "bagaimana cara transfernya". */}
      {catatanPoin && (
        <p className="mx-auto mt-10 max-w-[64ch] text-caption text-muted">{catatanPoin}</p>
      )}

      <p className={cn("mx-auto max-w-[64ch] text-caption text-muted", catatanPoin ? "mt-3" : "mt-10")}>
        Paket dibeli sekali dan aksesnya berlaku selamanya — tidak ada tagihan bulanan dan tidak ada
        perpanjangan. Pembayaran diatur langsung dengan tim Nerona: pilih paket, kirim order,
        selesaikan pembayaran, dan akun Anda diaktifkan. Paket Free aktif seketika tanpa pembayaran.
      </p>
    </Band>
  );
}
