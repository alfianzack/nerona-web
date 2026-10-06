import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/pagination";
import { getBalance, listTransactionsPage } from "@/lib/points";
import { listPurchasesPage } from "@/lib/purchases";
import { UserDetailTabs } from "@/components/admin/UserDetailTabs";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon } from "@/components/ui/icons";

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    notFound();
  }

  const [balance, txns, purchases] = await Promise.all([
    getBalance(user.id),
    listTransactionsPage(user.id, parsePage(searchParams.poin)),
    listPurchasesPage(user.id, parsePage(searchParams.beli)),
  ]);

  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value) query[k] = value;
  }

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
          transactions={{
            ...txns,
            rows: txns.rows.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
          }}
          purchases={{
            ...purchases,
            rows: purchases.rows.map((p) => ({ ...p, date: p.date.toISOString() })),
          }}
          query={query}
          initialTab={query.poin || query.beli ? "finance" : "paket"}
        />
      </div>
    </div>
  );
}
