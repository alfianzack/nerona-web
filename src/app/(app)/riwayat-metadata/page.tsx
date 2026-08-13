import { requireUser } from "@/lib/session-guards";
import { getMetadataLogStats, listMetadataLogsForUser } from "@/lib/metadata-log";
import { MetadataLogSummary } from "@/components/metadata/MetadataLogSummary";
import { MetadataLogTable } from "@/components/metadata/MetadataLogTable";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Riwayat Metadata — Nerona" };

export default async function RiwayatMetadataPage() {
  const session = await requireUser();
  const [stats, logs] = await Promise.all([
    getMetadataLogStats(session.user.id),
    listMetadataLogsForUser(session.user.id, 100),
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
          <h2 className="text-title-2 text-ink">100 terakhir</h2>
          <div className="mt-3">
            <MetadataLogTable
              rows={logs.map((log) => ({
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
        </Card>
      </div>
    </main>
  );
}
