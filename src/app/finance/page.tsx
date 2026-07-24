import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { getBalance, listTransactions } from "@/lib/points";
import { listPendingRenewals } from "@/lib/orders";
import { isAgentPlanExpired } from "@/lib/agent/admin";

export const metadata = { title: "Finance — Nerona" };

const POINT_REASON_LABEL: Record<string, string> = {
  manual_adjust: "Penyesuaian admin",
  spend: "Pemakaian AI",
  topup: "Top-up",
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateOrNull(d: Date | null): string {
  return d ? fmtDate(d) : "—";
}

const cardClass =
  "rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10";

export default async function FinancePage() {
  const session = await requireUser();

  const [balance, transactions, renewals, orderRequests, orders, agentProfile, license] = await Promise.all([
    getBalance(session.user.id),
    listTransactions(session.user.id, 50),
    listPendingRenewals(session.user.id),
    prisma.orderRequest.findMany({
      where: { userId: session.user.id, status: "fulfilled" },
      orderBy: { fulfilledAt: "desc" },
      select: { id: true, product: true, planName: true, fulfilledAt: true },
    }),
    prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, amount: true, note: true, courseId: true, createdAt: true },
    }),
    prisma.agentProfile.findUnique({
      where: { userId: session.user.id },
      select: { plan: true, status: true, planExpiresAt: true },
    }),
    prisma.license.findFirst({
      where: { userId: session.user.id, status: { in: ["active", "comp"] } },
      orderBy: { createdAt: "desc" },
      select: { validUntil: true, status: true, plan: { select: { name: true } } },
    }),
  ]);

  const purchases = [
    ...orderRequests.map((o) => ({
      id: `req-${o.id}`,
      label: `${o.product === "agent" ? "Agent" : "Metadata"} — ${o.planName}`,
      detail: null as string | null,
      amount: null as number | null,
      date: o.fulfilledAt ?? new Date(0),
    })),
    ...orders.map((o) => ({
      id: `ord-${o.id}`,
      label: o.courseId ? "Pembelian kelas" : "Aktivasi lisensi",
      detail: o.note,
      amount: o.amount,
      date: o.createdAt,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-14 sm:py-16">
        {renewals.length > 0 && (
          <div className="mb-6 rounded-2xl bg-gold-400/15 p-4 ring-1 ring-gold-400/40">
            <p className="text-sm font-semibold text-ink">Perpanjangan paket jatuh tempo</p>
            <ul className="mt-2 space-y-1">
              {renewals.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink">
                    {r.product === "agent" ? "Agent WhatsApp" : "Metadata"} — {r.planName}
                  </span>
                  <Link
                    href={`/order/${r.id}`}
                    className="whitespace-nowrap rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-3.5 py-1.5 text-xs font-semibold text-navy-900 transition hover:brightness-110"
                  >
                    Upload bukti transfer
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Finance</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/20 px-3.5 py-1.5 text-sm font-semibold text-[#9A6B08] ring-1 ring-gold-400/40">
            {balance.toLocaleString("id-ID")} poin
          </span>
        </div>

        <section className={`mt-8 ${cardClass}`}>
          <h2 className="text-sm font-semibold text-ink">Paket</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink">
                Agent WhatsApp
                {agentProfile ? <span className="text-muted"> · {agentProfile.plan}</span> : null}
              </span>
              <span className="text-xs text-muted">
                {!agentProfile || agentProfile.plan === "free"
                  ? "Paket free"
                  : isAgentPlanExpired(agentProfile)
                    ? "Berakhir — silakan perpanjang"
                    : `Berlaku sampai ${fmtDateOrNull(agentProfile.planExpiresAt)}`}
              </span>
            </li>
            {license && (
              <li className="flex items-center justify-between gap-3">
                <span className="text-ink">
                  Metadata
                  {license.plan?.name ? <span className="text-muted"> · {license.plan.name}</span> : null}
                </span>
                <span className="text-xs text-muted">
                  {license.validUntil ? `Berlaku sampai ${fmtDate(license.validUntil)}` : "Aktif"}
                </span>
              </li>
            )}
          </ul>
        </section>

        <section className={`mt-6 ${cardClass}`}>
          <h2 className="text-sm font-semibold text-ink">Poin</h2>
          <p className="mt-1 text-xs text-muted">
            Poin dipakai untuk balasan AI asisten WhatsApp. Hubungi admin untuk isi ulang.
          </p>
          <ul className="mt-3 divide-y divide-navy-900/10">
            {transactions.length === 0 && (
              <li className="py-2 text-sm text-muted">Belum ada aktivitas poin.</li>
            )}
            {transactions.map((t) => (
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
        </section>

        <section className={`mt-6 ${cardClass}`}>
          <h2 className="text-sm font-semibold text-ink">Pembelian</h2>
          <p className="mt-1 text-xs text-muted">Riwayat pembelian & aktivasi paket di Nerona.</p>
          <ul className="mt-3 divide-y divide-navy-900/10">
            {purchases.length === 0 && (
              <li className="py-2 text-sm text-muted">Belum ada pembelian.</li>
            )}
            {purchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-ink">{p.label}</p>
                  <p className="text-xs text-muted">
                    {fmtDate(p.date)}
                    {p.detail ? ` · ${p.detail}` : ""}
                  </p>
                </div>
                {p.amount != null && (
                  <span className="whitespace-nowrap text-sm font-medium tabular-nums text-ink">
                    Rp {p.amount.toLocaleString("id-ID")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
