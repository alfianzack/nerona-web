import { requireUser } from "@/lib/session-guards";
import { getMetadataLogStats, listMetadataLogsForUser } from "@/lib/metadata-log";
import { MetadataLogSummary } from "@/components/metadata/MetadataLogSummary";
import { MetadataLogTable } from "@/components/metadata/MetadataLogTable";

export const metadata = { title: "Riwayat Metadata — Nerona" };

const cardClass =
  "rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10";

export default async function RiwayatMetadataPage() {
  const session = await requireUser();
  const [stats, logs] = await Promise.all([
    getMetadataLogStats(session.user.id),
    listMetadataLogsForUser(session.user.id, 100),
  ]);

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-14 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Riwayat Metadata</h1>
        <p className="mt-1 text-sm text-muted">
          Judul, keyword, dan halaman marketplace dari setiap gambar yang di-generate lewat
          extension.
        </p>

        <section className={`mt-8 ${cardClass}`}>
          <MetadataLogSummary stats={stats} />
        </section>

        <section className={`mt-6 ${cardClass}`}>
          <h2 className="text-sm font-semibold text-ink">100 terakhir</h2>
          <div className="mt-2">
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
        </section>
      </div>
    </main>
  );
}
