import { requireAdmin } from "@/lib/session-guards";
import { getMetadataLogStats, listAllMetadataLogsPage } from "@/lib/metadata-log";
import { pageHref, parsePage } from "@/lib/pagination";
import { MetadataLogSummary } from "@/components/metadata/MetadataLogSummary";
import { MetadataLogTable } from "@/components/metadata/MetadataLogTable";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";

export const metadata = { title: "Metadata · Admin Nerona" };

export default async function AdminMetadataPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin();
  // userId null = lingkup semua tenant.
  const [stats, logs] = await Promise.all([
    getMetadataLogStats(null),
    listAllMetadataLogsPage(parsePage(searchParams.hal)),
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
        <h2 className="text-title-2 text-ink">Riwayat, terbaru dulu</h2>
        <div className="mt-4">
          <MetadataLogTable
            rows={logs.rows.map((log) => ({
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
        <Pagination
          className="mt-4 border-t border-divider pt-4"
          page={logs.page}
          total={logs.total}
          noun="metadata"
          hrefFor={(p) => pageHref("/admin/metadata", searchParams, "hal", p)}
        />
      </Card>
    </>
  );
}
