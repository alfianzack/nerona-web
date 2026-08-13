import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "money" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Tingkatan tombol.
 *
 * Sebelumnya hanya ada satu: pil gradien emas, 43 kali di 39 berkas. Karena
 * setiap aksi memakai bentuk yang sama, "Batal" terbaca sepenting "Beli poin".
 *
 * `primary` membaca token `--action`, jadi komponen yang sama keluar sebagai
 * pil biru di halaman publik dan tombol ink 8px di dalam aplikasi tanpa perlu
 * prop apa pun — perbedaannya diwarisi dari `[data-surface]` di layout.
 *
 * `money` adalah satu-satunya sisa gradien emas, dan hanya hidup di dalam
 * aplikasi: top-up, checkout, perpanjangan. Di halaman publik yang hanya punya
 * satu aksi, emas tidak menandai apa pun.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-action text-on-action hover:brightness-110",
  secondary: "bg-surface text-ink ring-1 ring-border hover:bg-surface-sunken",
  money:
    "bg-gradient-to-br from-gold-500 to-gold-400 font-semibold text-navy-900 hover:brightness-110",
  ghost: "bg-transparent text-accent hover:bg-surface-sunken",
  danger: "bg-danger text-white hover:brightness-110",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-caption",
  md: "px-4 py-2 text-body",
  lg: "px-6 py-3 text-body-lg",
};

export function buttonClass(options: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
}): string {
  const { variant = "primary", size = "md", full, className } = options;
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-action font-medium transition",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    full && "w-full",
    className,
  );
}
