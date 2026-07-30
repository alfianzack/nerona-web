import type { MetadataLogStats } from "@/lib/metadata-log";

/** Ringkasan angka di atas daftar. Dipakai dashboard tenant maupun admin. */
export function MetadataLogSummary({ stats }: { stats: MetadataLogStats }) {
  const tiles = [
    { label: "Total metadata", value: stats.total },
    { label: "7 hari terakhir", value: stats.last7Days },
    { label: "Marketplace terpakai", value: stats.perMarketplace.length },
  ];

  return (
    <div>
      <dl className="grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl bg-navy-900/[0.03] p-4 ring-1 ring-navy-900/10"
          >
            <dt className="text-[11px] text-muted">{tile.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">
              {tile.value.toLocaleString("id-ID")}
            </dd>
          </div>
        ))}
      </dl>
      {stats.perMarketplace.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {stats.perMarketplace.map((row) => (
            <li
              key={row.marketplace}
              className="rounded-full bg-navy-900/5 px-3 py-1 text-xs text-ink ring-1 ring-navy-900/10"
            >
              {row.marketplace}
              <span className="ml-1.5 font-semibold tabular-nums">
                {row.count.toLocaleString("id-ID")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
