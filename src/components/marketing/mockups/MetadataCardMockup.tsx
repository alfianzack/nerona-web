const KEYWORDS = ["skyline", "golden hour", "aerial view", "coastal city", "harbor"];

export function MetadataCardMockup() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        Generated metadata
      </p>
      <p className="mt-3 text-sm font-semibold text-gray-900">
        Golden hour skyline over a coastal city
      </p>
      <p className="mt-2 text-sm text-gray-600">
        Aerial view of a modern coastal skyline bathed in warm golden-hour light, with calm
        harbor waters reflecting the buildings.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {KEYWORDS.map((word) => (
          <span key={word} className="rounded-full bg-gray-900 px-3 py-1 text-xs text-white">
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}
