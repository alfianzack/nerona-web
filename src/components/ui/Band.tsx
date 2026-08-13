import { cn } from "./cn";

type BandTone = "plain" | "sunken" | "navy";
type BandAlign = "left" | "center";

/**
 * Pita bagian halaman publik.
 *
 * Memiliki dua hal yang selama ini ditulis ulang di setiap bagian pemasaran:
 * irama vertikal (`--band`, 104px di halaman publik) dan lebar isi. Lebarnya
 * naik dari max-w-5xl ke 980px karena itu ukuran isi apple.com, dan pada
 * ukuran judul yang baru, wadah lama membuat baris pecah terlalu cepat.
 *
 * Pita `navy` adalah satu-satunya permukaan gelap yang tersisa. Isinya harus
 * membalik warnanya sendiri — token ink/muted di dalamnya tetap warna terang.
 */
const TONES: Record<BandTone, string> = {
  plain: "bg-canvas",
  sunken: "bg-surface-sunken",
  navy: "bg-navy-900 text-white",
};

export function Band({
  tone = "plain",
  align = "left",
  id,
  className,
  children,
}: {
  tone?: BandTone;
  align?: BandAlign;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("px-6 py-band", TONES[tone], className)}>
      <div className={cn("mx-auto max-w-band", align === "center" && "text-center")}>
        {children}
      </div>
    </section>
  );
}
