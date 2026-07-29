import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/format";
import { Sparkline } from "@/components/admin/Sparkline";
import { Icon, type IconName } from "@/components/ui/icons";

const ACTIVE_LICENSE = { in: ["active", "comp"] };
const DAY_MS = 24 * 60 * 60 * 1000;

const CHIP_TONES = {
  blue: "bg-brand-blue/15 text-[#3B65C4]",
  sky: "bg-brand-sky/25 text-[#1F7FAE]",
  orange: "bg-brand-orange/15 text-[#C25717]",
  gold: "bg-gold-400/30 text-[#9A6B08]",
} as const;

function IconChip({ tone, icon }: { tone: keyof typeof CHIP_TONES; icon: IconName }) {
  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${CHIP_TONES[tone]}`}>
      <Icon name={icon} />
    </span>
  );
}

function StatTile({
  tone,
  icon,
  label,
  value,
  hint,
  alert,
}: {
  tone: keyof typeof CHIP_TONES;
  icon: IconName;
  label: string;
  value: number | string;
  hint?: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ${
        alert ? "ring-2 ring-gold-500/55" : "ring-navy-900/10"
      }`}
    >
      <div className="mb-3">
        <IconChip tone={tone} icon={icon} />
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10 ${className}`}
    >
      {children}
    </div>
  );
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "bg-gold-400/25 text-[#9A6B08]" },
  fulfilled: { label: "Selesai", className: "bg-emerald-500/10 text-emerald-700" },
  cancelled: { label: "Dibatalkan", className: "bg-navy-900/5 text-muted" },
};

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

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

  const AGENT_PLAN_DOT: Record<string, string> = {
    free: "#8A97AC",
    pro: "#4A7DE8",
    business: "#FF8B45",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          tone="blue"
          icon="users"
          label="Total pengguna"
          value={totalUsers}
          hint={
            <>
              <span className="font-semibold text-emerald-700">+{newUsersThisWeek}</span> minggu ini
            </>
          }
        />
        <StatTile
          tone="sky"
          icon="key"
          label="Lisensi aktif"
          value={totalActiveLicenses}
          hint={licenseByPlan.map((l) => `${l.name}: ${l.count}`).join(" · ") || "belum ada"}
        />
        <StatTile
          tone="orange"
          icon="chat"
          label="Agent aktif"
          value={totalActiveAgents}
          hint={agentGroups.map((g) => `${g.plan}: ${g._count._all}`).join(" · ") || "belum ada"}
        />
        <StatTile
          tone="gold"
          icon="clock"
          label="Order menunggu"
          value={pendingOrders}
          alert={pendingOrders > 0}
          hint={
            pendingOrders > 0 ? (
              <span className="font-semibold text-[#B45309]">Perlu diproses</span>
            ) : (
              "tidak ada antrian"
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Pengguna baru</h2>
              <p className="text-xs text-muted">30 hari terakhir</p>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-[#3B65C4]">
              +{usersLast30.length}
            </p>
          </div>
          <Sparkline
            data={userTrend}
            lineColor="#4A7DE8"
            fillColor="rgba(74,125,232,.12)"
            label={`Grafik pengguna baru 30 hari terakhir, total ${usersLast30.length}`}
          />
        </Card>
        <Card>
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Order masuk</h2>
              <p className="text-xs text-muted">30 hari terakhir</p>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-[#C25717]">
              +{ordersLast30.length}
            </p>
          </div>
          <Sparkline
            data={orderTrend}
            lineColor="#E0661C"
            fillColor="rgba(255,139,69,.12)"
            label={`Grafik order masuk 30 hari terakhir, total ${ordersLast30.length}`}
          />
        </Card>
      </div>

      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-ink">Order terbaru</h2>
          <Link href="/admin/orders" className="text-sm text-brand-blue hover:underline">
            Lihat semua ›
          </Link>
        </div>
        <div className="mt-3 divide-y divide-navy-900/10">
          {recentOrders.length === 0 && (
            <p className="py-3 text-sm text-muted">Belum ada order.</p>
          )}
          {recentOrders.map((order) => {
            const status = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending;
            return (
              <div key={order.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {order.user.name ?? order.user.email}
                  </p>
                  <p className="truncate text-xs text-muted">{order.user.email}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Badge
                    className={
                      order.product === "metadata"
                        ? "bg-brand-blue/15 text-[#3B65C4]"
                        : "bg-brand-orange/15 text-[#C25717]"
                    }
                  >
                    {order.product === "metadata" ? "Metadata" : "Agent"} · {order.planName}
                  </Badge>
                  <Badge className={status.className}>{status.label}</Badge>
                  {order.status === "pending" &&
                    (order.proofUploadedAt ? (
                      <Badge className="border border-emerald-600/25 bg-emerald-500/10 text-emerald-700">
                        ✓ Bukti bayar
                      </Badge>
                    ) : (
                      <Badge className="border border-dashed border-muted/40 text-muted/80">
                        Belum ada bukti
                      </Badge>
                    ))}
                  <span className="whitespace-nowrap text-xs tabular-nums text-muted">
                    {formatRelativeTime(order.createdAt, now)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-ink">Lisensi akan berakhir</h2>
            <span className="text-xs text-muted">30 hari ke depan</span>
          </div>
          <div className="mt-2 divide-y divide-navy-900/10">
            {expiringLicenses.length === 0 && (
              <p className="py-3 text-sm text-muted">Tidak ada lisensi yang akan berakhir.</p>
            )}
            {expiringLicenses.map((license) => {
              const daysLeft = Math.max(
                0,
                Math.ceil((license.validUntil!.getTime() - now.getTime()) / DAY_MS)
              );
              return (
                <div key={license.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {license.user.name ?? license.user.email}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {license.plan?.name ?? "Tanpa paket"} · berakhir{" "}
                      {license.validUntil!.toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge
                    className={
                      daysLeft <= 7
                        ? "bg-rose-500/10 text-rose-700"
                        : "bg-gold-400/25 text-[#9A6B08]"
                    }
                  >
                    {daysLeft} hari lagi
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-ink">Aktivitas Agent</h2>
            <span className="text-xs text-muted">7 hari terakhir</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface p-3.5 ring-1 ring-navy-900/10">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Pesan diproses
              </p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink">
                {agentMessages7}
              </p>
            </div>
            <div className="rounded-xl bg-surface p-3.5 ring-1 ring-navy-900/10">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Order via agent
              </p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink">{agentOrders7}</p>
            </div>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {agentGroups.length === 0 && (
              <p className="text-sm text-muted">Belum ada agent aktif.</p>
            )}
            {agentGroups.map((g) => (
              <span
                key={g.plan}
                className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-navy-900/10"
              >
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full align-[1px]"
                  style={{ backgroundColor: AGENT_PLAN_DOT[g.plan] ?? "#8A97AC" }}
                />
                {g.plan} <b className="tabular-nums">{g._count._all}</b>
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(
          [
            { href: "/admin/users", label: "Kelola pengguna", tone: "blue" },
            { href: "/admin/orders", label: "Proses order", tone: "gold" },
            { href: "/admin/pengaturan", label: "Harga & rekening", tone: "orange" },
          ] as const
        ).map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 text-sm font-medium text-ink shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10 transition hover:brightness-[0.98]"
          >
            {link.label}
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full font-semibold ${CHIP_TONES[link.tone]}`}
            >
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
