import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { getBalance, listTransactions } from "@/lib/points";
import { getMetadataLogStats, listMetadataLogsForUser } from "@/lib/metadata-log";
import { getExtensionConnectionState } from "@/lib/extension-connection";

export const metadata = { title: "Dashboard — Nerona" };

const POINT_REASON_LABEL: Record<string, string> = {
  manual_adjust: "Penyesuaian admin",
  spend: "Pemakaian AI",
  topup: "Top-up",
};

const cardClass =
  "rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={cardClass}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Dashboard kontributor metadata.
 *
 * Sebelumnya halaman ini murni toko — pendapatan bulan ini, transaksi, produk
 * terlaris, stok menipis — yang tidak berarti apa pun bagi kontributor stock.
 * getDashboardSummary dan getSalesSeries tetap ada di lib/shop-dashboard.ts,
 * tidak dipakai di sini, dan kembali begitu AGENT_ENABLED dinyalakan.
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
      <div className="mx-auto max-w-5xl px-6 py-14 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Dashboard</h1>

        {/* Pemasangan ekstensi adalah pekerjaan pertama seorang pelanggan baru,
            jadi panduannya menonjol sampai ekstensinya benar-benar dipakai.
            Panelnya sendiri tetap satu, di /profile — disalin ke sini berarti
            dua tempat yang harus dijaga bersamaan. */}
        {connection.status !== "connected" && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gold-400/15 p-5 ring-1 ring-gold-400/40">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {connection.status === "none"
                  ? "Ekstensi belum terhubung"
                  : "Tokennya sudah dibuat — tinggal ditempel"}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {connection.status === "none"
                  ? "Unduh ekstensi Nerona Metadata, pasang di Chrome, lalu tempel token akun Anda."
                  : "Buka popup ekstensi di Chrome dan tempel token yang sudah Anda buat."}
              </p>
            </div>
            <Link
              href="/profile"
              className="whitespace-nowrap rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110"
            >
              Hubungkan ekstensi
            </Link>
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Saldo poin" value={balance.toLocaleString("id-ID")} />
          <Stat label="Paket" value={planValue} hint={planHint} />
          <Stat label="Metadata 7 hari terakhir" value={stats.last7Days.toLocaleString("id-ID")} />
          <Stat label="Total metadata" value={stats.total.toLocaleString("id-ID")} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Metadata terbaru</p>
              <Link href="/riwayat-metadata" className="text-xs text-brand-blue hover:underline">
                Lihat semua
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-navy-900/10">
              {recentLogs.length === 0 && (
                <li className="py-2 text-sm text-muted">
                  Belum ada metadata. Hasil generate pertama Anda akan muncul di sini.
                </li>
              )}
              {recentLogs.map((log) => (
                <li key={log.id} className="py-2">
                  <p className="truncate text-sm text-ink">{log.title || "Tanpa judul"}</p>
                  <p className="text-xs text-muted">
                    {log.marketplace} · {log.keywordCount} kata kunci · {fmtDate(log.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            <div className={cardClass}>
              <p className="text-sm font-semibold text-ink">Marketplace teratas</p>
              <ul className="mt-3 space-y-2 text-sm">
                {stats.perMarketplace.length === 0 && (
                  <li className="text-muted">Belum ada data.</li>
                )}
                {stats.perMarketplace.slice(0, 5).map((row) => (
                  <li key={row.marketplace} className="flex justify-between gap-3">
                    <span className="text-ink">{row.marketplace}</span>
                    <span className="tabular-nums text-muted">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={cardClass}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">Poin</p>
                <Link href="/finance" className="text-xs text-brand-blue hover:underline">
                  Lihat semua
                </Link>
              </div>
              <p className="mt-1 text-xs text-muted">
                Poin terpakai setiap kali AI membuat metadata.
              </p>
              <ul className="mt-3 divide-y divide-navy-900/10">
                {pointsHistory.length === 0 && (
                  <li className="py-2 text-sm text-muted">Belum ada aktivitas poin.</li>
                )}
                {pointsHistory.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        {POINT_REASON_LABEL[t.reason] ?? t.reason}
                        {t.note ? <span className="text-muted"> · {t.note}</span> : null}
                      </p>
                      <p className="text-xs text-muted">{fmtDate(t.createdAt)}</p>
                    </div>
                    <span
                      className={`whitespace-nowrap text-sm font-semibold tabular-nums ${
                        t.delta >= 0 ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
                      {t.delta >= 0 ? "+" : ""}
                      {t.delta.toLocaleString("id-ID")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
