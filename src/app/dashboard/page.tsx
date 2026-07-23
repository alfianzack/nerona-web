import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { getDashboardSummary, getSalesSeries } from "@/lib/shop-dashboard";
import { getBalance, listTransactions } from "@/lib/points";
import { formatRupiah } from "@/lib/format";
import { SalesChart } from "@/components/shop/SalesChart";

export const metadata = { title: "Dashboard — Nerona" };

const STATUS_LABEL: Record<string, string> = {
  new: "Baru",
  paid: "Dibayar",
  done: "Selesai",
  cancelled: "Batal",
};

const POINT_REASON_LABEL: Record<string, string> = {
  manual_adjust: "Penyesuaian admin",
  spend: "Pemakaian AI",
  topup: "Top-up",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireUser();
  const [summary, series, pointsBalance, pointsHistory] = await Promise.all([
    getDashboardSummary(session.user.id),
    getSalesSeries(session.user.id),
    getBalance(session.user.id),
    listTransactions(session.user.id, 8),
  ]);

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-5xl px-6 py-14 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Dashboard</h1>

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Pendapatan bulan ini" value={formatRupiah(summary.revenueThisMonth)} />
          <Stat label="Transaksi bulan ini" value={String(summary.orderCount)} />
          <Stat label="Produk aktif" value={String(summary.activeProductCount)} />
          <Stat label="Belum dibayar" value={String(summary.unpaidCount)} />
        </div>

        <div className="mt-8 rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
          <p className="text-sm font-semibold text-ink">Penjualan 30 hari terakhir</p>
          <div className="mt-4 text-ink">
            <SalesChart data={series} />
          </div>
        </div>

        <div className="mt-8 rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Poin</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/20 px-2.5 py-1 text-sm font-semibold text-[#9A6B08] ring-1 ring-gold-400/40">
              {pointsBalance.toLocaleString("id-ID")} poin
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Poin dipakai untuk balasan AI asisten WhatsApp. Hubungi admin untuk isi ulang.
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
                  <p className="text-xs text-muted">
                    {t.createdAt.toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
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

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Transaksi terbaru</p>
              <Link href="/transaksi" className="text-xs text-brand-blue hover:underline">
                Lihat semua
              </Link>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {summary.recentOrders.length === 0 && (
                <li className="text-muted">Belum ada transaksi.</li>
              )}
              {summary.recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3">
                  <span className="text-ink">{o.customerName || "Tanpa nama"}</span>
                  <span className="text-xs text-muted">{STATUS_LABEL[o.status] ?? o.status}</span>
                  <span className="tabular-nums font-medium text-ink">{formatRupiah(o.total)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
              <p className="text-sm font-semibold text-ink">Produk terlaris</p>
              <ul className="mt-3 space-y-2 text-sm">
                {summary.topProducts.length === 0 && <li className="text-muted">Belum ada data.</li>}
                {summary.topProducts.map((p) => (
                  <li key={p.productName} className="flex justify-between gap-3">
                    <span className="text-ink">{p.productName}</span>
                    <span className="text-muted">{p.qtySold} terjual</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
              <p className="text-sm font-semibold text-ink">Stok menipis</p>
              <ul className="mt-3 space-y-2 text-sm">
                {summary.lowStock.length === 0 && <li className="text-muted">Semua stok aman.</li>}
                {summary.lowStock.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span className="text-ink">{p.name}</span>
                    <span className="text-rose-600">sisa {p.stock ?? 0}</span>
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
