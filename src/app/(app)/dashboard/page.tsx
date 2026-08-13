import { requireUser } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { getBalance, listTransactions } from "@/lib/points";
import { getMetadataLogStats, listMetadataLogsForUser } from "@/lib/metadata-log";
import { getExtensionConnectionState } from "@/lib/extension-connection";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { TextLink } from "@/components/ui/TextLink";
import { Icon } from "@/components/ui/icons";

export const metadata = { title: "Dashboard — Nerona" };

const POINT_REASON_LABEL: Record<string, string> = {
  manual_adjust: "Penyesuaian admin",
  spend: "Pemakaian AI",
  topup: "Top-up",
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Dashboard kontributor metadata.
 *
 * Sebelumnya halaman ini murni toko — pendapatan bulan ini, transaksi, produk
 * terlaris, stok menipis — yang tidak berarti apa pun bagi kontributor stock.
 * getDashboardSummary dan getSalesSeries tetap ada di lib/shop-dashboard.ts,
 * tidak dipakai di sini, dan kembali begitu AGENT_ENABLED dinyalakan.
 *
 * Empat angka ringkasan dan tiga panel daftar dulu memakai satu resep kartu
 * yang sama persis, jadi tidak ada yang menuntun mata. Sekarang angkanya jadi
 * kotak kecil berlabel mono, sementara panel isinya bernapas lebih lega dan
 * punya judul sungguhan — perbedaan massa itulah yang membentuk urutan baca.
 */
export default async function DashboardPage() {
  const session = await requireUser();
  const [balance, pointsHistory, stats, recentLogs, license, connection] = await Promise.all([
    getBalance(session.user.id),
    listTransactions(session.user.id, 5),
    getMetadataLogStats(session.user.id),
    listMetadataLogsForUser(session.user.id, 5),
    prisma.license.findFirst({
      where: { userId: session.user.id, status: { in: ["active", "comp"] } },
      orderBy: { createdAt: "desc" },
      select: { validUntil: true, plan: { select: { name: true } } },
    }),
    getExtensionConnectionState(session.user.id),
  ]);

  const planValue = license?.plan?.name ?? "Free";
  const planHint = license?.validUntil
    ? `Berlaku sampai ${fmtDate(license.validUntil)}`
    : license
      ? "Aktif"
      : "Belum ada paket berbayar";

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-5xl px-6 py-band">
        <PageHeader title="Dashboard" />

        {/* Pemasangan ekstensi adalah pekerjaan pertama seorang pelanggan baru,
            jadi panduannya menonjol sampai ekstensinya benar-benar dipakai.
            Panelnya sendiri tetap satu, di /profile — disalin ke sini berarti
            dua tempat yang harus dijaga bersamaan.

            Cincin aksen, bukan emas: emas di dalam aplikasi menandai aksi yang
            menggerakkan uang, dan menghubungkan ekstensi tidak memindahkan
            sepeser pun. Varian dipakai apa adanya karena menimpa cincin lewat
            className gagal diam-diam; sebabnya ditulis di Card.tsx. */}
        {connection.status !== "connected" && (
          <Card
            variant="accent"
            className="mt-8 flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex min-w-0 items-start gap-3">
              <Icon name="link" className="mt-0.5 h-[18px] w-[18px] flex-none text-accent" />
              <div className="min-w-0">
                <p className="text-body font-semibold text-ink">
                  {connection.status === "none"
                    ? "Ekstensi belum terhubung"
                    : "Tokennya sudah dibuat — tinggal ditempel"}
                </p>
                <p className="mt-1 text-caption text-muted">
                  {connection.status === "none"
                    ? "Unduh ekstensi Nerona Metadata, pasang di Chrome, lalu tempel token akun Anda."
                    : "Buka popup ekstensi di Chrome dan tempel token yang sudah Anda buat."}
                </p>
              </div>
            </div>
            <ButtonLink href="/profile">Hubungkan ekstensi</ButtonLink>
          </Card>
        )}

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Saldo poin" value={balance.toLocaleString("id-ID")} />
          <Stat label="Paket" value={planValue} hint={planHint} />
          <Stat label="Metadata 7 hari terakhir" value={stats.last7Days.toLocaleString("id-ID")} />
          <Stat label="Total metadata" value={stats.total.toLocaleString("id-ID")} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card padding="lg">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-title-2 text-ink">Metadata terbaru</h2>
              <TextLink href="/riwayat-metadata" className="text-caption">
                Lihat semua
              </TextLink>
            </div>
            <ul className="mt-4 divide-y divide-divider">
              {recentLogs.length === 0 && (
                <li className="py-2 text-body text-muted">
                  Belum ada metadata. Hasil generate pertama Anda akan muncul di sini.
                </li>
              )}
              {recentLogs.map((log) => (
                <li key={log.id} className="py-2.5">
                  <p className="truncate text-body text-ink">{log.title || "Tanpa judul"}</p>
                  {/* Baris keterangan pakai mono tapi huruf kecil biasa: isinya
                      nama marketplace dan tanggal, bukan label kolom. */}
                  <p className="mt-0.5 font-mono text-label text-muted">
                    {log.marketplace} · {log.keywordCount} kata kunci · {fmtDate(log.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <div className="space-y-6">
            <Card padding="lg">
              <h2 className="text-title-2 text-ink">Marketplace teratas</h2>
              <ul className="mt-4 space-y-2 text-body">
                {stats.perMarketplace.length === 0 && (
                  <li className="text-muted">Belum ada data.</li>
                )}
                {stats.perMarketplace.slice(0, 5).map((row) => (
                  <li key={row.marketplace} className="flex justify-between gap-3">
                    <span className="text-ink">{row.marketplace}</span>
                    <span className="font-mono tabular-nums text-muted">{row.count}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card padding="lg">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-title-2 text-ink">Poin</h2>
                <TextLink href="/finance" className="text-caption">
                  Lihat semua
                </TextLink>
              </div>
              <p className="mt-1 text-caption text-muted">
                Poin terpakai setiap kali AI membuat metadata.
              </p>
              <ul className="mt-4 divide-y divide-divider">
                {pointsHistory.length === 0 && (
                  <li className="py-2 text-body text-muted">Belum ada aktivitas poin.</li>
                )}
                {pointsHistory.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-body text-ink">
                        {POINT_REASON_LABEL[t.reason] ?? t.reason}
                        {t.note ? <span className="text-muted"> · {t.note}</span> : null}
                      </p>
                      <p className="mt-0.5 font-mono text-label text-muted">
                        {fmtDate(t.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`whitespace-nowrap font-mono text-body font-semibold tabular-nums ${
                        t.delta >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {t.delta >= 0 ? "+" : ""}
                      {t.delta.toLocaleString("id-ID")}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
