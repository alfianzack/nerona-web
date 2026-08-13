import type { MetadataLogStats } from "@/lib/metadata-log";
import { Badge } from "@/components/ui/Badge";
import { Stat } from "@/components/ui/Stat";

/**
 * Ringkasan angka di atas daftar. Dipakai dashboard tenant maupun admin.
 *
 * Ketiga kotaknya sekarang memakai Stat, jadi angkanya ikut mono dan berbaris
 * rapi antar kolom. Karena Stat membawa kartunya sendiri, pemanggil TIDAK boleh
 * membungkus komponen ini dengan kartu lagi.
 */
export function MetadataLogSummary({ stats }: { stats: MetadataLogStats }) {
  const tiles = [
    { label: "Total metadata", value: stats.total },
    { label: "7 hari terakhir", value: stats.last7Days },
    { label: "Marketplace terpakai", value: stats.perMarketplace.length },
  ];

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <Stat key={tile.label} label={tile.label} value={tile.value.toLocaleString("id-ID")} />
        ))}
      </div>
      {stats.perMarketplace.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {stats.perMarketplace.map((row) => (
            <li key={row.marketplace}>
              <Badge>
                {row.marketplace}
                <span className="text-ink">{row.count.toLocaleString("id-ID")}</span>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
