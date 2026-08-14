/**
 * Kata kuncinya WAJIB berbahasa Inggris — lihat sebab lengkapnya di
 * MetadataCardMockup. Ringkasnya: prompt produksi menuliskan "English only", dan
 * contoh berbahasa Indonesia memberi tahu kontributor berpengalaman bahwa
 * karyanya akan ditolak marketplace.
 *
 * Jumlahnya sengaja banyak. Bagian ini berjudul "Puluhan kata kunci hasil AI",
 * dan versi sebelumnya menampilkan sepuluh — bukti yang menyanggah klaimnya
 * sendiri. Sekarang jumlahnya benar-benar puluhan, jadi pembaca menghitungnya
 * dan klaimnya terbukti tanpa satu kalimat tambahan.
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
  "downtown",
  "high rise",
  "office building",
  "bay",
  "reflection",
  "dusk",
  "panorama",
  "drone shot",
  "business district",
  "skyscraper",
  "tourism",
  "seaside",
];

export function KeywordChipsMockup() {
  return (
    <div className="rounded-card bg-surface p-7 ring-1 ring-border">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-label uppercase text-muted">
          Kata kunci hasil AI, siap disunting
        </p>
        <p className="font-mono text-label tabular-nums text-muted">{KEYWORDS.length}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {KEYWORDS.map((word) => (
          <span
            key={word}
            className="rounded-chip bg-surface-sunken px-3 py-1 text-caption font-medium text-muted"
          >
            {word}
          </span>
        ))}
        {/* Satu-satunya chip beraksen: yang membedakannya dari yang lain adalah
            bahwa ini milik pengguna, bukan hasil AI. */}
        <span className="rounded-chip border border-dashed border-accent/40 px-3 py-1 text-caption font-medium text-accent">
          + tambah sendiri
        </span>
      </div>
    </div>
  );
}
