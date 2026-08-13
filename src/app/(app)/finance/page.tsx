import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { getBalance, listTransactions } from "@/lib/points";
import { listPendingRenewals } from "@/lib/orders";
import { isAgentPlanExpired } from "@/lib/agent/admin";
import { getTopupPackages, perPointLabel } from "@/lib/topup";
import { AGENT_ENABLED } from "@/lib/features";
import { formatRupiah } from "@/lib/money";
import { TopupCard } from "@/components/finance/TopupCard";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { TextLink } from "@/components/ui/TextLink";

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

export default async function FinancePage() {
  const session = await requireUser();

  const [balance, transactions, renewals, orderRequests, orders, agentProfile, license, topupPackages] = await Promise.all([
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
    // Di-null-kan saat Agent disembunyikan, bukan disaring di JSX: satu tempat
    // memutuskan, dan setiap pemakaian agentProfile di bawah — baris paket,
    // keadaan kosong, hasActivePlan untuk TopupCard — ikut benar sendiri.
    AGENT_ENABLED
      ? prisma.agentProfile.findUnique({
          where: { userId: session.user.id },
          select: { plan: true, status: true, planExpiresAt: true },
        })
      : Promise.resolve(null),
    prisma.license.findFirst({
      where: { userId: session.user.id, status: { in: ["active", "comp"] } },
      orderBy: { createdAt: "desc" },
      select: { validUntil: true, status: true, plan: { select: { name: true } } },
    }),
    getTopupPackages(),
  ]);

  const topupOptions = topupPackages.map((pkg) => ({
    points: pkg.points,
    price: pkg.price,
    priceLabel: formatRupiah(pkg.price),
    perPointLabel: perPointLabel(pkg),
  }));

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
      <div className="mx-auto max-w-3xl px-6 py-band">
        {/* Tagihan yang jatuh tempo memakai nada peringatan, bukan emas: emas di
            layar ini menandai tombol yang menggerakkan uang, dan kalau panelnya
            ikut emas tombolnya kehilangan tanda. */}
        {renewals.length > 0 && (
          <div className="mb-8 rounded-card bg-warning-bg p-4 ring-1 ring-warning/25">
            <p className="text-body font-semibold text-ink">Perpanjangan paket jatuh tempo</p>
            <ul className="mt-3 space-y-2">
              {renewals.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-body text-ink">
                    {r.product === "agent" ? "Agent WhatsApp" : "Metadata"} — {r.planName}
                  </span>
                  {r.proofUploadedAt ? (
                    <Link
                      href={`/order/${r.id}`}
                      className="whitespace-nowrap font-mono text-label uppercase text-muted underline-offset-2 hover:underline"
                    >
                      Menunggu verifikasi admin
                    </Link>
                  ) : (
                    <ButtonLink href={`/order/${r.id}`} variant="money" size="sm">
                      Upload bukti transfer
                    </ButtonLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <PageHeader title="Finance" />

        {/* Halaman ini seluruhnya daftar, dan daftar tidak bisa dibaca sekilas.
            Dua angka di atasnya menjawab pertanyaan yang membawa orang ke sini.

            Sempat ada angka ketiga, "Poin terpakai", dijumlahkan dari daftar
            transaksi di halaman ini. Angka itu dibuang: daftarnya dibatasi 50
            baris, jadi bagi akun yang sudah lewat 50 aktivitas ia diam-diam
            terlalu kecil — dan sebuah angka besar di layar uang terbaca sebagai
            total seumur akun berapa pun keterangan di bawahnya. Menampilkannya
            dengan benar butuh agregat di sisi basis data, dan itu pekerjaan
            lain, bukan pekerjaan tampilan. */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Stat
            label="Saldo poin"
            value={balance.toLocaleString("id-ID")}
            hint="Bisa dipakai selama paket aktif."
          />
          <Stat
            label="Pembelian"
            value={purchases.length.toLocaleString("id-ID")}
            hint="Seluruh riwayat di bawah."
          />
        </div>

        <div className="mt-6 space-y-6">
          <Card>
            <h2 className="text-title-2 text-ink">Paket</h2>
            <ul className="mt-4 space-y-3">
              {/* Baris Agent hanya ada kalau produknya ditampilkan: agentProfile
                  di-null-kan di atas saat AGENT_ENABLED false. */}
              {agentProfile && (
                <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <span className="text-body text-ink">
                    Agent WhatsApp
                    <span className="text-muted"> · {agentProfile.plan}</span>
                  </span>
                  {agentProfile.plan === "free" ? (
                    <Badge>Paket free</Badge>
                  ) : isAgentPlanExpired(agentProfile) ? (
                    <Badge tone="danger">Berakhir — silakan perpanjang</Badge>
                  ) : (
                    <Badge tone="success">
                      Berlaku sampai {fmtDateOrNull(agentProfile.planExpiresAt)}
                    </Badge>
                  )}
                </li>
              )}
              {license && (
                <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <span className="text-body text-ink">
                    Metadata
                    {license.plan?.name ? <span className="text-muted"> · {license.plan.name}</span> : null}
                  </span>
                  <Badge tone="success">
                    {license.validUntil ? `Berlaku sampai ${fmtDate(license.validUntil)}` : "Aktif"}
                  </Badge>
                </li>
              )}
              {/* Dengan baris Agent hilang, daftar ini bisa jadi kosong — dulu
                  selalu ada minimal satu baris. Daftar hampa tanpa penjelasan
                  lebih buruk daripada mengakui belum ada paket. */}
              {!agentProfile && !license && (
                <li className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-body text-muted">Belum ada paket aktif.</span>
                  <TextLink href="/paket" className="text-caption">
                    Lihat paket
                  </TextLink>
                </li>
              )}
            </ul>
          </Card>

          <Card>
            <TopupCard
              options={topupOptions}
              hasActivePlan={
                Boolean(license) ||
                Boolean(agentProfile && agentProfile.plan !== "free" && !isAgentPlanExpired(agentProfile))
              }
            />
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-title-2 text-ink">Poin</h2>
              <ButtonLink href="/paket" variant="money" size="sm">
                Beli / perpanjang paket
              </ButtonLink>
            </div>
            <p className="mt-1 text-caption text-muted">Poin terpakai setiap kali AI bekerja.</p>
            <ul className="mt-4 divide-y divide-divider">
              {transactions.length === 0 && (
                <li className="py-3 text-body text-muted">Belum ada aktivitas poin.</li>
              )}
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-body text-ink">
                      {POINT_REASON_LABEL[t.reason] ?? t.reason}
                      {t.note ? <span className="text-muted"> · {t.note}</span> : null}
                    </p>
                    <p className="mt-0.5 font-mono text-label uppercase tabular-nums text-muted">
                      {fmtDate(t.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`whitespace-nowrap text-right font-mono text-body font-semibold tabular-nums ${
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

          <Card>
            <h2 className="text-title-2 text-ink">Pembelian</h2>
            <p className="mt-1 text-caption text-muted">Riwayat pembelian & aktivasi paket di Nerona.</p>
            <ul className="mt-4 divide-y divide-divider">
              {purchases.length === 0 && (
                <li className="py-3 text-body text-muted">Belum ada pembelian.</li>
              )}
              {purchases.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-body text-ink">{p.label}</p>
                    {/* Tanggalnya mono supaya berbaris menurun; catatannya tetap
                        huruf biasa karena isinya kalimat, bukan angka. */}
                    <p className="mt-0.5 text-caption text-muted">
                      <span className="font-mono tabular-nums">{fmtDate(p.date)}</span>
                      {p.detail ? ` · ${p.detail}` : ""}
                    </p>
                  </div>
                  {p.amount != null && (
                    <span className="whitespace-nowrap text-right font-mono text-body tabular-nums text-ink">
                      Rp {p.amount.toLocaleString("id-ID")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </main>
  );
}
