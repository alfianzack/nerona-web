import { cn } from "./cn";

type CardVariant = "default" | "sunken" | "flush";
type CardPadding = "none" | "sm" | "md" | "lg";

/**
 * Pengganti resep yang sebelumnya disalin 57 kali di 41 berkas:
 *
 *   rounded-3xl bg-gradient-to-b from-surface to-surface2 p-5
 *   shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10
 *
 * Gradiennya putih menuju #F4F8FD — tidak mengerjakan apa pun secara visual,
 * tapi dipasang di setiap panel produk, bahkan di dalam DataTable dan Modal.
 * Yang hilang di sini: gradien itu, dan bayangannya. Permukaan dipisahkan oleh
 * garis rambut, dan bayangan disimpan untuk lapisan yang benar-benar melayang.
 */
const VARIANTS: Record<CardVariant, string> = {
  default: "bg-surface ring-1 ring-border",
  sunken: "bg-surface-sunken ring-1 ring-border",
  // Tanpa latar dan tanpa garis — untuk kartu yang sudah berada di dalam
  // permukaan lain dan hanya butuh radius serta padding.
  flush: "bg-transparent",
};

const PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-7",
};

export function Card({
  variant = "default",
  padding = "md",
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  padding?: CardPadding;
}) {
  return (
    <div
      className={cn("rounded-card shadow-card", VARIANTS[variant], PADDING[padding], className)}
      {...rest}
    >
      {children}
    </div>
  );
}
