import { requireUser } from "@/lib/session-guards";
import { getMetadataLogStats, listMetadataLogsForUserPage } from "@/lib/metadata-log";
import { pageHref, parsePage } from "@/lib/pagination";
import { MetadataLogSummary } from "@/components/metadata/MetadataLogSummary";
import { MetadataLogTable } from "@/components/metadata/MetadataLogTable";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";

export const metadata = { title: "Riwayat Metadata · Nerona" };

export default async function RiwayatMetadataPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireUser();
  const [stats, logs] = await Promise.all([
    getMetadataLogStats(session.user.id),
    listMetadataLogsForUserPage(session.user.id, parsePage(searchParams.hal)),
  ]);

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-band">
        <PageHeader
          title="Riwayat Metadata"
          description="Judul, keyword, dan halaman marketplace dari setiap gambar yang di-generate lewat extension."
        />

        {/* Ringkasannya sekarang membawa kotaknya sendiri, jadi tidak dibungkus
            kartu lagi — kartu di dalam kartu membuat garis rambutnya dobel. */}
        <section className="mt-8">
          <MetadataLogSummary stats={stats} />
        </section>

        <Card padding="lg" className="mt-6">
          <h2 className="text-title-2 text-ink">Riwayat, terbaru dulu</h2>
          <div className="mt-3">
            <MetadataLogTable
              rows={logs.rows.map((log) => ({
                id: log.id,
                marketplace: log.marketplace,
                pageUrl: log.pageUrl,
                title: log.title,
                keywords: log.keywords,
                keywordCount: log.keywordCount,
                createdAt: log.createdAt.toISOString(),
              }))}
            />
          </div>
          <Pagination
            className="mt-4 border-t border-divider pt-4"
            page={logs.page}
            total={logs.total}
            noun="metadata"
            hrefFor={(p) => pageHref("/riwayat-metadata", searchParams, "hal", p)}
          />
        </Card>
      </div>
    </main>
  );
}
