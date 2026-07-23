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
    <div className="rounded-3xl bg-gradient-to-b from-surface to-surface2 p-7 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <p className="text-xs font-medium uppercase tracking-wide text-muted/70">
        30 kata kunci, siap disunting
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {KEYWORDS.map((word) => (
          <span
            key={word}
            className="rounded-full bg-navy-900/5 px-3.5 py-1.5 text-xs font-medium text-muted"
          >
            {word}
          </span>
        ))}
        <span className="rounded-full border border-dashed border-gold-400/50 px-3.5 py-1.5 text-xs font-medium text-brand-blue">
          + tambah sendiri
        </span>
      </div>
    </div>
  );
}
