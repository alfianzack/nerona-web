const KEYWORDS = ["cakrawala kota", "jam emas", "pemandangan udara", "kota pesisir", "pelabuhan"];

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

  return (
    <div className="rounded-card bg-surface p-7 text-left ring-1 ring-border">
      <div className="flex items-center justify-between">
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
        Cakrawala kota pesisir saat jam emas
      </p>
      <p className={`mt-2 text-body text-muted ${rise} [animation-delay:650ms]`}>
        Pemandangan udara cakrawala kota pesisir modern bermandikan cahaya keemasan, dengan air
        pelabuhan yang tenang memantulkan gedung-gedung.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {KEYWORDS.map((word, index) => (
          <span
            key={word}
            className={`rounded-chip bg-accent/10 px-3 py-1 text-caption font-medium text-accent ${pop}`}
            style={animated ? { animationDelay: `${1100 + index * 120}ms` } : undefined}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}
