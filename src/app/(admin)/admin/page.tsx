import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/format";
import { Sparkline } from "@/components/admin/Sparkline";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { TextLink } from "@/components/ui/TextLink";
import { Icon, type IconName } from "@/components/ui/icons";

const ACTIVE_LICENSE = { in: ["active", "comp"] };
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Status order turun jadi nada Badge.
 *
 * Sebelumnya pasangan latar/teksnya ditulis tangan di sini sebagai hex lepas,
 * jadi status yang sama tampil dengan langkah warna berbeda dari layar tenant.
 * "Dibatalkan" memakai nada netral, bukan merah: order yang dibatalkan bukan
 * kesalahan yang perlu ditangani, hanya baris yang sudah selesai urusannya.
 */
const STATUS_TONE: Record<string, BadgeTone> = {
  pending: "warning",
  fulfilled: "success",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  fulfilled: "Selesai",
  cancelled: "Dibatalkan",
};

/**
 * Titik warna paket agent. Ketiganya dulu hex lepas yang dipasang lewat atribut
 * style, sehingga tidak ikut berpindah kalau tokennya berubah.
 */
const AGENT_PLAN_DOT: Record<string, string> = {
  free: "bg-muted",
  pro: "bg-brand-blue",
  business: "bg-brand-orange",
};

/**
 * Tiga jalan pintas di kaki halaman.
 *
 * Dulu tiap kartu ditutup lingkaran berwarna berisi glyph teks "→". Glyph itu
 * dirender sistem operasi, jadi bentuknya berbeda di tiap mesin — dan daftar
 * ikon belum punya panah kanan. Ikon tujuannya sendiri mengerjakan pekerjaan
 * yang sama dengan lebih banyak makna: ketiganya sama persis dengan ikon menu
 * samping untuk halaman yang dituju.
 */
const QUICK_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/users", label: "Kelola pengguna", icon: "users" },
  { href: "/admin/orders", label: "Proses order", icon: "receipt" },
  { href: "/admin/pengaturan", label: "Harga & rekening", icon: "settings" },
];

function bucketPerDay(dates: Date[], days: number, now: Date): number[] {
  const buckets = new Array<number>(days).fill(0);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)).getTime();
  for (const date of dates) {
    const index = Math.floor((date.getTime() - start) / DAY_MS);
    if (index >= 0 && index < days) buckets[index] += 1;
  }
  return buckets;
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
  const monthAhead = new Date(now.getTime() + 30 * DAY_MS);

  const [
    totalUsers,
    newUsersThisWeek,
    usersLast30,
    ordersLast30,
    pendingOrders,
    plans,
    licenseGroups,
    agentGroups,
    recentOrders,
    expiringLicenses,
    agentMessages7,
    agentOrders7,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.findMany({
      where: { createdAt: { gte: monthAgo } },
      select: { createdAt: true },
    }),
    prisma.orderRequest.findMany({
      where: { createdAt: { gte: monthAgo } },
      select: { createdAt: true },
    }),
    prisma.orderRequest.count({ where: { status: "pending" } }),
    prisma.plan.findMany({ select: { id: true, name: true } }),
    prisma.license.groupBy({
      by: ["planId"],
      where: { status: ACTIVE_LICENSE },
      _count: { _all: true },
    }),
    prisma.agentProfile.groupBy({
      by: ["plan"],
      where: { status: "active" },
      _count: { _all: true },
    }),
    prisma.orderRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.license.findMany({
      where: { status: ACTIVE_LICENSE, validUntil: { gte: now, lte: monthAhead } },
      orderBy: { validUntil: "asc" },
      take: 5,
      include: {
        user: { select: { email: true, name: true } },
        plan: { select: { name: true } },
      },
    }),
    prisma.agentMessage.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.agentOrder.count({ where: { createdAt: { gte: weekAgo } } }),
  ]);

  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const licenseByPlan = licenseGroups
    .map((g) => ({
      name: g.planId ? planName.get(g.planId) ?? "Tanpa paket" : "Tanpa paket",
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);
  const totalActiveLicenses = licenseGroups.reduce((sum, g) => sum + g._count._all, 0);
  const totalActiveAgents = agentGroups.reduce((sum, g) => sum + g._count._all, 0);

  const userTrend = bucketPerDay(usersLast30.map((u) => u.createdAt), 30, now);
  const orderTrend = bucketPerDay(ordersLast30.map((o) => o.createdAt), 30, now);

  return (
    <>
      {/* Judulnya sebelumnya tidak ada sama sekali: satu-satunya penyebut
          halaman ini adalah penunjuk di bilah atas, dan penunjuk itu sengaja
          bukan heading. Layar dashboard tenant memasang PageHeader yang sama. */}
      <PageHeader title="Dashboard" />

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total pengguna" value={totalUsers} hint={`+${newUsersThisWeek} minggu ini`} />
        <Stat
          label="Lisensi aktif"
          value={totalActiveLicenses}
          hint={licenseByPlan.map((l) => `${l.name}: ${l.count}`).join(" · ") || "belum ada"}
        />
        <Stat
          label="Agent aktif"
          value={totalActiveAgents}
          hint={agentGroups.map((g) => `${g.plan}: ${g._count._all}`).join(" · ") || "belum ada"}
        />
        <Stat
          label="Order menunggu"
          value={pendingOrders}
          hint={pendingOrders > 0 ? "Perlu diproses" : "tidak ada antrian"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-title-2 text-ink">Pengguna baru</h2>
              <p className="mt-1 font-mono text-label uppercase text-muted">30 hari terakhir</p>
            </div>
            <p className="font-mono text-title-1 tabular-nums text-accent">+{usersLast30.length}</p>
          </div>
          <Sparkline
            data={userTrend}
            tone="accent"
            label={`Grafik pengguna baru 30 hari terakhir, total ${usersLast30.length}`}
          />
        </Card>
        <Card padding="lg">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-title-2 text-ink">Order masuk</h2>
              <p className="mt-1 font-mono text-label uppercase text-muted">30 hari terakhir</p>
            </div>
            <p className="font-mono text-title-1 tabular-nums text-emphasis">
              +{ordersLast30.length}
            </p>
          </div>
          <Sparkline
            data={orderTrend}
            tone="emphasis"
            label={`Grafik order masuk 30 hari terakhir, total ${ordersLast30.length}`}
          />
        </Card>
      </div>

      <Card padding="lg" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-title-2 text-ink">Order terbaru</h2>
          {/* Kurung sudutnya datang dari TextLink sendiri, jadi tidak lagi
              ditulis sebagai glyph di dalam teksnya. */}
          <TextLink href="/admin/orders" className="text-caption">
            Lihat semua
          </TextLink>
        </div>
        <div className="mt-4 divide-y divide-divider">
          {recentOrders.length === 0 && (
            <p className="py-3 text-body text-muted">Belum ada order.</p>
          )}
          {recentOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-body text-ink">{order.user.name ?? order.user.email}</p>
                {/* Alamat surel dan waktu memakai mono huruf kecil: keduanya isi
                    baris, bukan label kolom. */}
                <p className="mt-0.5 truncate font-mono text-label text-muted">
                  {order.user.email}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {/* Metadata dan Agent adalah dua produk, bukan dua tingkat
                    keadaan. Daftar nada Badge tidak punya oranye merek, jadi
                    yang membedakan keduanya tinggal info lawan netral. */}
                <Badge tone={order.product === "metadata" ? "info" : "neutral"}>
                  {order.product === "metadata" ? "Metadata" : "Agent"} · {order.planName}
                </Badge>
                <Badge tone={STATUS_TONE[order.status] ?? STATUS_TONE.pending}>
                  {STATUS_LABEL[order.status] ?? STATUS_LABEL.pending}
                </Badge>
                {order.status === "pending" &&
                  (order.proofUploadedAt ? (
                    <Badge tone="success">
                      <Icon name="check" className="h-3 w-3" />
                      Bukti bayar
                    </Badge>
                  ) : (
                    <Badge>Belum ada bukti</Badge>
                  ))}
                <span className="whitespace-nowrap font-mono text-label tabular-nums text-muted">
                  {formatRelativeTime(order.createdAt, now)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-title-2 text-ink">Lisensi akan berakhir</h2>
            <span className="font-mono text-label uppercase text-muted">30 hari ke depan</span>
          </div>
          <div className="mt-4 divide-y divide-divider">
            {expiringLicenses.length === 0 && (
              <p className="py-3 text-body text-muted">Tidak ada lisensi yang akan berakhir.</p>
            )}
            {expiringLicenses.map((license) => {
              const daysLeft = Math.max(
                0,
                Math.ceil((license.validUntil!.getTime() - now.getTime()) / DAY_MS)
              );
              return (
                <div key={license.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-body text-ink">
                      {license.user.name ?? license.user.email}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-label tabular-nums text-muted">
                      {license.plan?.name ?? "Tanpa paket"} · berakhir{" "}
                      {license.validUntil!.toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  {/* Seminggu terakhir masuk nada bahaya, sisanya peringatan —
                      dua langkah yang sama dipakai layar tenant untuk paket
                      yang mau habis. */}
                  <Badge tone={daysLeft <= 7 ? "danger" : "warning"}>{daysLeft} hari lagi</Badge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card padding="lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-title-2 text-ink">Aktivitas Agent</h2>
            <span className="font-mono text-label uppercase text-muted">7 hari terakhir</span>
          </div>
          {/* Kartu di dalam kartu memakai permukaan tenggelam, bukan permukaan
              yang sama dengan induknya: dua putih bertumpuk hanya terpisah oleh
              garis rambut dan tidak terbaca sebagai dua lapis. */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Card variant="sunken" padding="sm">
              <p className="font-mono text-label uppercase text-muted">Pesan diproses</p>
              <p className="mt-1 font-mono text-title-2 tabular-nums text-ink">{agentMessages7}</p>
            </Card>
            <Card variant="sunken" padding="sm">
              <p className="font-mono text-label uppercase text-muted">Order via agent</p>
              <p className="mt-1 font-mono text-title-2 tabular-nums text-ink">{agentOrders7}</p>
            </Card>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {agentGroups.length === 0 && (
              <p className="text-body text-muted">Belum ada agent aktif.</p>
            )}
            {agentGroups.map((g) => (
              <Badge key={g.plan}>
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 flex-none rounded-full ${AGENT_PLAN_DOT[g.plan] ?? "bg-muted"}`}
                />
                {g.plan} {g._count._all}
              </Badge>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-card">
            <Card className="flex h-full items-center justify-between gap-3 transition hover:bg-surface-sunken">
              <span className="text-body font-medium text-ink">{link.label}</span>
              <Icon name={link.icon} className="h-[18px] w-[18px] flex-none text-muted" />
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
