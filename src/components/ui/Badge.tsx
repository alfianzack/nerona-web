import { cn } from "./cn";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "points";

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
 */
const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-muted ring-1 ring-border",
  info: "bg-brand-blue/10 text-brand-blue-ink ring-1 ring-brand-blue/25",
  success: "bg-success-bg text-success ring-1 ring-success/25",
  warning: "bg-warning-bg text-warning ring-1 ring-warning/25",
  danger: "bg-danger-bg text-danger ring-1 ring-danger/25",
  points: "bg-gold-400/20 text-brand-gold-ink ring-1 ring-gold-400/40",
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
