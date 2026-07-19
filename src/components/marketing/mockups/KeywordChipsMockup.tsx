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
    <div className="rounded-3xl bg-gradient-to-b from-navy-800 to-navy-900 p-7 shadow-lg shadow-black/40 ring-1 ring-white/10">
      <p className="text-xs font-medium uppercase tracking-wide text-navy-300/70">
        30 kata kunci, siap disunting
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {KEYWORDS.map((word) => (
          <span
            key={word}
            className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-navy-300"
          >
            {word}
          </span>
        ))}
        <span className="rounded-full border border-dashed border-gold-400/50 px-3.5 py-1.5 text-xs font-medium text-gold-400">
          + tambah sendiri
        </span>
      </div>
    </div>
  );
}
