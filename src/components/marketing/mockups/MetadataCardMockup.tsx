const KEYWORDS = ["cakrawala kota", "jam emas", "pemandangan udara", "kota pesisir", "pelabuhan"];

export function MetadataCardMockup() {
  return (
    <div className="rounded-3xl bg-gradient-to-b from-surface to-surface2 p-7 text-left shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted/70">
          Metadata yang dihasilkan
        </p>
        <span className="flex h-2 w-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
        </span>
      </div>
      <p className="mt-4 text-[15px] font-semibold text-ink">
        Cakrawala kota pesisir saat jam emas
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Pemandangan udara cakrawala kota pesisir modern bermandikan cahaya keemasan, dengan air
        pelabuhan yang tenang memantulkan gedung-gedung.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {KEYWORDS.map((word) => (
          <span
            key={word}
            className="rounded-full bg-gold-400/10 px-3 py-1 text-xs font-medium text-brand-blue"
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}
