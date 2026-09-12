import { cn } from "./cn";
import { Reveal } from "./Reveal";

type BandTone = "plain" | "sunken" | "navy" | "navy-gradient" | "navy-deep" | "ruang";
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
  "navy-deep": "band-navy-deep text-white",
  // Di dalam Ruang Kata: latarnya panggung, paddingnya lapisan, dan reveal
  // dimatikan — lapisannya sendiri yang mendekat dari kabur.
  ruang: "bg-transparent",
};

export function Band({
  tone = "plain",
  align = "left",
  padat = false,
  reveal = false,
  id,
  className,
  children,
}: {
  tone?: BandTone;
  align?: BandAlign;
  /**
   * Irama setengah, untuk pita yang isinya satu baris.
   *
   * Irama penuh dipilih untuk seksi bertumpuk — judul, subjudul, lalu kartu.
   * Dipakai pada pita berisi tiga angka setinggi 89px, paddingnya jadi lebih
   * tinggi daripada isinya, dan yang terbaca bukan "seksi lapang" melainkan
   * "ada yang gagal dimuat".
   */
  padat?: boolean;
  /**
   * Isinya naik-memudar saat pita ini masuk layar.
   *
   * SATU reveal untuk seluruh pita, bukan satu per elemen. Judul, paragraf,
   * dan kartu yang masuk bergantian menarik perhatian ke urutannya sendiri,
   * dan yang perlu dibaca di halaman ini kalimatnya. Pita yang naik utuh
   * terbaca sebagai "seksi baru dimulai" — pekerjaan yang selama ini
   * dikerjakan sendirian oleh pergantian latar.
   *
   * Pita paling atas TIDAK memakainya: ia sudah terlihat saat halaman dimuat,
   * dan hero punya urutan animasinya sendiri.
   */
  reveal?: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        tone === "ruang" ? "px-0 py-0" : cn("px-6", padat ? "py-band-padat" : "py-band"),
        TONES[tone],
        className,
      )}
    >
      <div className={cn("mx-auto max-w-band", align === "center" && "text-center")}>
        {reveal && tone !== "ruang" ? <Reveal>{children}</Reveal> : children}
      </div>
    </section>
  );
}
