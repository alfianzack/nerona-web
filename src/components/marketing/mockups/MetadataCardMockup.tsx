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
    <div className="rounded-3xl bg-gradient-to-b from-surface to-surface2 p-7 text-left shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted/70">
          Metadata yang dihasilkan
        </p>
        <span className="flex h-2 w-2">
          <span
            className={`h-2 w-2 rounded-full bg-emerald-400 ${
              animated ? "animate-nerona-done motion-reduce:animate-none" : ""
            }`}
          />
        </span>
      </div>
      <p className={`mt-4 text-[15px] font-semibold text-ink ${rise} [animation-delay:250ms]`}>
        Cakrawala kota pesisir saat jam emas
      </p>
      <p className={`mt-2 text-sm leading-relaxed text-muted ${rise} [animation-delay:650ms]`}>
        Pemandangan udara cakrawala kota pesisir modern bermandikan cahaya keemasan, dengan air
        pelabuhan yang tenang memantulkan gedung-gedung.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {KEYWORDS.map((word, index) => (
          <span
            key={word}
            className={`rounded-full bg-gold-400/10 px-3 py-1 text-xs font-medium text-brand-blue ${pop}`}
            style={animated ? { animationDelay: `${1100 + index * 120}ms` } : undefined}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}
