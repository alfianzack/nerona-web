import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBalance, listTransactions } from "@/lib/points";
import { UserDetailTabs, type PurchaseView } from "@/components/admin/UserDetailTabs";

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    notFound();
  }

  const [balance, txns, orderRequests, orders] = await Promise.all([
    getBalance(user.id),
    listTransactions(user.id),
    prisma.orderRequest.findMany({
      where: { userId: user.id, status: "fulfilled" },
      orderBy: { fulfilledAt: "desc" },
      select: { id: true, product: true, planName: true, fulfilledAt: true },
    }),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, amount: true, currency: true, note: true, courseId: true, createdAt: true },
    }),
  ]);

  const purchases: PurchaseView[] = [
    ...orderRequests.map((o) => ({
      id: `req-${o.id}`,
      kind: "plan" as const,
      label: `${o.product === "agent" ? "Agent" : "Metadata"} — ${o.planName}`,
      detail: null,
      amount: null,
      date: (o.fulfilledAt ?? new Date(0)).toISOString(),
    })),
    ...orders.map((o) => ({
      id: `ord-${o.id}`,
      kind: "order" as const,
      label: o.courseId ? "Pembelian kelas" : "Aktivasi lisensi",
      detail: o.note,
      amount: o.amount,
      date: o.createdAt.toISOString(),
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const transactions = txns.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }));

  return (
    <div className="max-w-2xl">
      <Link href="/admin/users" className="text-sm text-brand-blue hover:underline">
        ‹ Kembali ke daftar pengguna
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{user.name ?? user.email}</h2>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-3.5 py-1.5 text-sm font-semibold text-navy-900">
          {balance.toLocaleString("id-ID")} poin
        </span>
      </div>

      <div className="mt-6">
        <UserDetailTabs
          userEmail={user.email}
          userId={user.id}
          balance={balance}
          transactions={transactions}
          purchases={purchases}
        />
      </div>
    </div>
  );
}
