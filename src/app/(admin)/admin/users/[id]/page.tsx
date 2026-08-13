import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBalance, listTransactions } from "@/lib/points";
import { UserDetailTabs, type PurchaseView } from "@/components/admin/UserDetailTabs";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon } from "@/components/ui/icons";

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
      select: { id: true, amount: true, note: true, courseId: true, createdAt: true },
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
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const transactions = txns.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }));

  return (
    <div className="max-w-2xl">
      {/* Panah kiri sebagai ikon sungguhan, bukan glyph kurung sudut: glyph
          dirender font sistem, jadi tingginya berbeda antar mesin dan tidak
          bisa disetel ukurannya. TextLink tidak dipakai di sini karena ia
          menambahkan kurung sudut di kanan — arah yang salah untuk "kembali". */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-caption text-accent transition hover:underline"
      >
        <Icon name="arrow-left" className="h-4 w-4 flex-none" />
        Kembali ke daftar pengguna
      </Link>

      {/* Surel memakai mono karena ia identitas, bukan kalimat — dan ia berdiri
          sendiri di bawah PageHeader, sebab prop `description` hanya menerima
          teks biasa dan akan mencetaknya dalam huruf sans. */}
      <PageHeader
        className="mt-4"
        title={user.name ?? user.email}
        actions={<Badge tone="points">{balance.toLocaleString("id-ID")} poin</Badge>}
      />
      <p className="mt-2 truncate font-mono text-caption text-muted">{user.email}</p>

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
