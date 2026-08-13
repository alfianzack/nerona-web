import { requireAdmin } from "@/lib/session-guards";
import { getMetadataLogStats, listAllMetadataLogs } from "@/lib/metadata-log";
import { MetadataLogSummary } from "@/components/metadata/MetadataLogSummary";
import { MetadataLogTable } from "@/components/metadata/MetadataLogTable";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Metadata — Admin Nerona" };

export default async function AdminMetadataPage() {
  await requireAdmin();
  // userId null = lingkup semua tenant.
  const [stats, logs] = await Promise.all([
    getMetadataLogStats(null),
    listAllMetadataLogs(100),
  ]);

  // Tanpa <main> dan tanpa pembungkus lebar: keduanya sudah datang dari layout
  // (admin). Menambahkannya lagi di sini berarti dua landmark <main> bersarang
  // — HTML tidak sah, dan pembaca layar melihat dua wilayah utama — plus
  // padding samping dan vertikal yang dobel.
  return (
    <>
      <PageHeader
        title="Metadata"
        description="Metadata yang di-generate semua tenant lewat extension."
      />

      {/* Tanpa pembungkus kartu: MetadataLogSummary mencetak kartunya sendiri
          lewat Stat, jadi membungkusnya lagi menghasilkan kartu di dalam
          kartu. Pemanggil tenant di /riwayat-metadata sudah begini. */}
      <section className="mt-8">
        <MetadataLogSummary stats={stats} />
      </section>

      <Card padding="lg" className="mt-6">
        <h2 className="text-title-2 text-ink">100 terakhir</h2>
        <div className="mt-4">
          <MetadataLogTable
            rows={logs.map((log) => ({
              id: log.id,
              marketplace: log.marketplace,
              pageUrl: log.pageUrl,
              title: log.title,
              keywords: log.keywords,
              keywordCount: log.keywordCount,
              createdAt: log.createdAt.toISOString(),
              owner: log.user.name || log.user.email,
            }))}
          />
        </div>
      </Card>
    </>
  );
}
