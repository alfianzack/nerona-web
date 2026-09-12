import { cn } from "./cn";

export type BadgeTone =
  | "neutral"
  | "info"
  | "emphasis"
  | "success"
  | "warning"
  | "danger"
  | "points"
  | "points-navy";

/**
 * Menggantikan dua hal sekaligus.
 *
 * Pertama, peta chip khusus admin di admin/page.tsx yang menyimpan empat
 * pasangan warna sebagai hex lepas. Kedua — dan ini yang lebih besar — status
 * rose/emerald/amber yang tersebar di 40+ berkas tanpa token, sehingga langkah
 * warnanya melayang antara 400 sampai 800 tergantung siapa yang menulisnya.
 *
 * `points` memakai emas karena saldo poin adalah uang, dan itu satu-satunya
 * tempat emas muncul di luar tombol yang menggerakkan uang.
 *
 * `points-navy` adalah nada yang SAMA di atas permukaan gelap, dan ia ada
 * sebagai nada tersendiri karena `points` benar-benar tidak bisa dipakai di
 * sana: warna tulisannya `brand-gold-ink` (#9A6B08), coklat gelap yang dipilih
 * untuk berdiri di atas putih, dan di atas navy-900 ia tinggal sekitar 1,7:1 —
 * praktis hilang. Pembalikannya menukar peran emas: yang tadinya latar kini
 * jadi tulisan.
 *
 * Ini pasangan nada pertama yang begitu, jadi satu aturan supaya tidak
 * berkembang jadi kebiasaan: nada `-navy` hanya dibuat untuk hal yang memang
 * muncul di dua permukaan sekaligus. Saldo poin begitu — ia berdiri di sidebar
 * navy DAN di bar ponsel yang berlatar canvas putih. Status seperti `success`
 * atau `danger` tidak pernah, jadi jangan dibuatkan.
 */
const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-muted ring-1 ring-border",
  info: "bg-brand-blue/10 text-brand-blue-ink ring-1 ring-brand-blue/25",
  // Pasangan `info` untuk membedakan dua hal yang setara, bukan untuk
  // menandai keadaan. Dipakai chip produk: tanpa ini Metadata dan Agent
  // sama-sama biru-atau-abu dan bedanya nyaris tak terbaca.
  emphasis: "bg-brand-orange/10 text-brand-orange-ink ring-1 ring-brand-orange/25",
  success: "bg-success-bg text-success ring-1 ring-success/25",
  warning: "bg-warning-bg text-warning ring-1 ring-warning/25",
  danger: "bg-danger-bg text-danger ring-1 ring-danger/25",
  points: "bg-gold-400/20 text-brand-gold-ink ring-1 ring-gold-400/40",
  "points-navy": "bg-gold-400/15 text-gold-400 ring-1 ring-gold-400/30",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        // Sengaja TIDAK memaksa huruf besar. Badge dipakai untuk dua hal:
        // kata status ("Lunas", "Menunggu bayar") dan nilai ("1.250 poin").
        // Huruf besar paksa membuat yang kedua terbaca berteriak, dan satuannya
        // ikut jadi "POIN". Pemanggil yang memang mau huruf besar bisa
        // menambahkannya sendiri; kebalikannya tidak bisa dibatalkan.
        "inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 font-mono text-label font-semibold tabular-nums",
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
