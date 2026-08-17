import { cn } from "./cn";

type BandTone = "plain" | "sunken" | "navy" | "navy-gradient";
type BandAlign = "left" | "center";

/**
 * Pita bagian halaman publik.
 *
 * Memiliki dua hal yang selama ini ditulis ulang di setiap bagian pemasaran:
 * irama vertikal (`--band`, 104px di halaman publik) dan lebar isi. Lebarnya
 * naik dari max-w-5xl ke 980px karena itu ukuran isi apple.com, dan pada
 * ukuran judul yang baru, wadah lama membuat baris pecah terlalu cepat.
 *
 * Pita gelap ada dua nada, dan keduanya menuntut isinya membalik warnanya
 * sendiri — token ink/muted di dalamnya tetap warna terang.
 *
 * `navy-gradient` berdiri sebagai nada tersendiri, bukan sebagai nada rata yang
 * ditimpa gradien dari luar lewat className. Sebabnya sama dengan sebab varian
 * kartu accent ada: begitu dua utilitas menyetel properti yang sama pada satu
 * elemen, pemenangnya adalah yang jatuh belakangan di CSS keluaran menurut
 * abjad, bukan yang ditulis belakangan. Menyediakan nadanya membuat kasus itu
 * mustahil ditulis salah.
 *
 * Isinya sekarang satu kelas di globals.css, bukan rangkaian utilitas gradien
 * Tailwind. Sebabnya ada di docblock kelas itu — singkatnya, gradien dua
 * perhentian tidak bisa memberi kedalaman pada bidang selebar ini, dan yang
 * dibutuhkan adalah sumber cahaya berbentuk radial yang tidak punya padanan
 * utilitas. Menaruhnya di lapisan components juga menutup jebakan di paragraf
 * sebelumnya dari sisi yang lain: kelas ini jatuh sebelum seluruh lapisan
 * utilities, jadi `bg-*` apa pun yang dioper lewat className tetap menang —
 * yang memang perilaku yang benar.
 */
const TONES: Record<BandTone, string> = {
  plain: "bg-canvas",
  sunken: "bg-surface-sunken",
  navy: "bg-navy-900 text-white",
  "navy-gradient": "band-navy-glow text-white",
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
