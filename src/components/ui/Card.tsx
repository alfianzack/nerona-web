import { cn } from "./cn";

type CardVariant = "default" | "sunken" | "accent" | "flush";
type CardPadding = "none" | "sm" | "md" | "lg";

/**
 * Pengganti satu resep kartu yang sebelumnya disalin 57 kali di 41 berkas:
 * sudut 24px, gradien putih menuju #F4F8FD, bayangan besar bernada navy, dan
 * cincin navy tembus pandang. Gradiennya tidak mengerjakan apa pun secara
 * visual, tapi dipasang di setiap panel produk — bahkan di dalam DataTable dan
 * Modal. Yang hilang di sini: gradien itu, dan bayangannya. Permukaan
 * dipisahkan garis rambut, dan bayangan disimpan untuk lapisan yang
 * benar-benar melayang.
 *
 * Resep lamanya sengaja dijabarkan dengan kata, bukan dengan nama kelasnya:
 * pemindai Tailwind membaca komentar sebagai teks biasa, jadi menuliskannya di
 * sini akan membuat kedelapan kelas yang baru saja dihapus tetap terbit di
 * bundel CSS sebagai aturan mati. Berkas ini rumah aturan itu; ia yang paling
 * tidak boleh melanggarnya.
 */
const VARIANTS: Record<CardVariant, string> = {
  default: "bg-surface ring-1 ring-border",
  sunken: "bg-surface-sunken ring-1 ring-border",
  /**
   * Kartu yang ditonjolkan — paket unggulan, paket poin paling hemat.
   *
   * Varian ini ada karena menimpa cincin dari luar TIDAK BEKERJA, dan gagalnya
   * diam-diam. Ketika dua kelas Tailwind menyetel properti yang sama pada satu
   * elemen, yang menang adalah yang jatuh belakangan di CSS keluaran, bukan
   * yang ditulis belakangan di className. Urutan keluaran itu menurut abjad
   * nama kelas, jadi cincin border mengalahkan cincin accent, teks muted
   * mengalahkan teks accent, dan latar transparent mengalahkan latar surface.
   * Terbukti dengan membaca stylesheet hasil build, bukan diduga.
   *
   * Akibatnya `<Card className="ring-2 ring-accent">` menghasilkan cincin
   * abu-abu 2px: terlihat benar di kode, salah di layar. Menyediakan varian
   * membuat kasus ini mustahil ditulis salah.
   */
  accent: "bg-surface ring-2 ring-accent",
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
