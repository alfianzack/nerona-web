import { cn } from "./cn";

/**
 * Judul halaman aplikasi.
 *
 * Menggantikan satu baris judul yang disalin persis 16 kali di seluruh repo:
 * sebuah h1 berukuran 30px, setengah tebal, dengan tracking dirapatkan dan
 * warna tinta. Ukurannya sengaja dijabarkan dengan kata di sini — pemindai
 * Tailwind membaca komentar sebagai teks biasa, jadi menuliskan nama kelasnya
 * akan membuat ukuran yang baru saja ditinggalkan tetap terbit di bundel CSS.
 *
 * Slot `actions` ada karena tanpanya setiap halaman menjahit sendiri baris
 * flex untuk menaruh tombolnya di sebelah judul, dan tidak ada dua yang
 * memakai jarak yang sama.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-title-1 text-balance text-ink">{title}</h1>
        {description && (
          <p className="mt-2 max-w-[62ch] text-body text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-none flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
