import { Band } from "@/components/ui/Band";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icons";

export interface PricingTierFeature {
  label: string;
  included: boolean;
}

export interface PricingTier {
  name: string;
  tagline: string;
  priceLabel: string;
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

export function PricingTierGrid({ tiers }: { tiers: PricingTier[] }) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-3">
      {tiers.map((tier) => {
        // Varian accent, bukan default plus cincin dari luar: menimpa cincin
        // lewat className gagal secara diam-diam. Sebabnya ditulis di Card.tsx.
        return (
          <Card
            key={tier.name}
            variant={tier.featured ? "accent" : "default"}
            padding="lg"
            className="relative flex flex-col"
          >
            {/* Aksen, bukan emas: halaman publik hanya punya satu warna aksen,
                dan emas disimpan untuk aksi yang menggerakkan uang di dalam
                aplikasi. */}
            {tier.featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-chip bg-accent px-3 py-1 font-mono text-label font-semibold uppercase text-white">
                PALING POPULER
              </span>
            )}

            <h3 className="text-title-2 text-ink">{tier.name}</h3>
            <p className="mt-1 text-caption text-muted">{tier.tagline}</p>
            <p className="mt-5 text-title-1 tabular-nums text-ink">{tier.priceLabel}</p>
            {tier.savingsLabel && (
              <p className="mt-1.5 text-caption text-success">{tier.savingsLabel}</p>
            )}

            <div className="my-6 h-px bg-divider" />

            <ul className="flex-1 space-y-3 text-body text-ink">
              {tier.features.map((feature) => (
                <li key={feature.label} className="flex items-start gap-2.5">
                  <FeatureIcon included={feature.included} />
                  <span className={feature.included ? "" : "text-muted line-through"}>
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
}: {
  id?: string;
  heading: string;
  subheading: string;
  tiers: PricingTier[];
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

      <p className="mx-auto mt-10 max-w-[64ch] text-caption text-muted">
        Pembayaran diatur langsung dengan tim Nerona — pilih paket, kirim order, selesaikan
        pembayaran, dan akun Anda diaktifkan. Paket Free aktif seketika tanpa pembayaran.
      </p>
    </Band>
  );
}
