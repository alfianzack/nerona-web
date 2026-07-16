const KEYWORDS = [
  "skyline",
  "golden hour",
  "aerial view",
  "coastal city",
  "harbor",
  "travel",
  "sunset",
  "architecture",
  "waterfront",
  "cityscape",
];

export function KeywordChipsMockup() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        30 keywords, ready to edit
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {KEYWORDS.map((word) => (
          <span
            key={word}
            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700"
          >
            {word}
          </span>
        ))}
        <span className="rounded-full border border-dashed border-gray-400 px-3 py-1 text-xs text-gray-500">
          + add your own
        </span>
      </div>
    </div>
  );
}
