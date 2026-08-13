const KEYWORDS = [
  "cakrawala kota",
  "jam emas",
  "pemandangan udara",
  "kota pesisir",
  "pelabuhan",
  "perjalanan",
  "matahari terbenam",
  "arsitektur",
  "tepi laut",
  "lanskap kota",
];

export function KeywordChipsMockup() {
  return (
    <div className="rounded-card bg-surface p-7 ring-1 ring-border">
      <p className="font-mono text-label uppercase text-muted">
        Kata kunci hasil AI, siap disunting
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {KEYWORDS.map((word) => (
          <span
            key={word}
            className="rounded-chip bg-surface-sunken px-3.5 py-1.5 text-caption font-medium text-muted"
          >
            {word}
          </span>
        ))}
        {/* Satu-satunya chip beraksen: yang membedakannya dari yang lain adalah
            bahwa ini milik pengguna, bukan hasil AI. */}
        <span className="rounded-chip border border-dashed border-accent/40 px-3.5 py-1.5 text-caption font-medium text-accent">
          + tambah sendiri
        </span>
      </div>
    </div>
  );
}
