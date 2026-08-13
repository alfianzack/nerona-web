/**
 * Contoh keluaran, dan isinya WAJIB berbahasa Inggris.
 *
 * Ini bukan pilihan gaya. Prompt generasi di lib/extension/prompts.ts menuliskan
 * "English only" tiga kali, karena Adobe Stock dan Shutterstock memang menuntut
 * metadata berbahasa Inggris. Contoh berbahasa Indonesia di halaman jualan
 * memberi tahu kontributor yang paham salah satu dari dua hal: alat ini tidak
 * dipakai orang sungguhan, atau alat ini akan membuat karyanya ditolak. Dua-duanya
 * membunuh kepercayaan di depan tepat orang yang mau dijual.
 *
 * Jumlah chip juga bukan pilihan bebas. Halaman ini menjanjikan "puluhan kata
 * kunci"; menampilkan lima membuat buktinya menyanggah klaimnya sendiri.
 */
const KEYWORDS = [
  "city skyline",
  "golden hour",
  "aerial view",
  "coastal city",
  "harbour",
  "waterfront",
  "cityscape",
  "urban skyline",
  "sunset",
  "architecture",
  "modern city",
  "travel destination",
];

const TOTAL_KEYWORDS = 42;

/**
 * Kartu hasil metadata.
 *
 * `animated` memainkan urutan pembuatannya sekali saat halaman dibuka: titik
 * status kuning berubah hijau, judul lalu deskripsi muncul, kata kunci menyusul
 * satu per satu. Itu memperlihatkan pekerjaan yang dijual produk ini — AI
 * menuliskan metadata — bukan hiasan yang bergerak tanpa arti.
 *
 * Default-nya mati: kartu ini juga dipakai sebagai ilustrasi fitur di beranda
 * dua produk, jauh di bawah lipatan layar, di mana animasi hanya akan berjalan
 * tanpa ada yang melihat.
 *
 * Semua animasi dimatikan oleh `motion-reduce`, dan karena keadaan awal yang
 * menyembunyikan ada di dalam keyframe (bukan di kelas markup), mematikannya
 * menyisakan kartu yang lengkap dan terbaca.
 */
export function MetadataCardMockup({ animated = false }: { animated?: boolean }) {
  const rise = animated ? "animate-nerona-rise motion-reduce:animate-none" : "";
  const pop = animated ? "animate-nerona-pop motion-reduce:animate-none" : "";
  const sisa = TOTAL_KEYWORDS - KEYWORDS.length;

  return (
    <div className="rounded-card bg-surface p-7 text-left ring-1 ring-border">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-label uppercase text-muted">Metadata yang dihasilkan</p>
        <span className="flex h-2 w-2">
          {/* Warna diam memakai token; saat animated, keyframe nerona-done yang
              memegang warnanya dari kuning ke hijau. */}
          <span
            className={`h-2 w-2 rounded-full bg-success ${
              animated ? "animate-nerona-done motion-reduce:animate-none" : ""
            }`}
          />
        </span>
      </div>

      <p className={`mt-4 text-body font-semibold text-ink ${rise} [animation-delay:250ms]`}>
        Aerial view of a modern coastal city skyline at golden hour
      </p>
      <p className={`mt-2 text-body text-muted ${rise} [animation-delay:650ms]`}>
        Aerial view of a modern coastal city skyline bathed in warm golden light, with calm harbour
        water reflecting the buildings below.
      </p>

      <p
        className={`mt-5 font-mono text-label uppercase text-muted ${rise} [animation-delay:900ms]`}
      >
        {TOTAL_KEYWORDS} kata kunci
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {KEYWORDS.map((word, index) => (
          <span
            key={word}
            className={`rounded-chip bg-accent/10 px-3 py-1 text-caption font-medium text-accent ${pop}`}
            style={animated ? { animationDelay: `${1100 + index * 70}ms` } : undefined}
          >
            {word}
          </span>
        ))}
        <span
          className={`rounded-chip px-3 py-1 text-caption font-medium text-muted ${pop}`}
          style={animated ? { animationDelay: `${1100 + KEYWORDS.length * 70}ms` } : undefined}
        >
          +{sisa} lagi
        </span>
      </div>
    </div>
  );
}
