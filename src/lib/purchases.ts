import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, mergePage, pageCount, type Paged } from "@/lib/pagination";

export interface Purchase {
  id: string;
  kind: "plan" | "order";
  label: string;
  detail: string | null;
  amount: number | null;
  date: Date;
}

/**
 * Riwayat pembelian seorang pengguna: aktivasi paket (OrderRequest yang sudah
 * dipenuhi) dan pembelian lama (Order) dalam satu daftar, terbaru dulu.
 *
 * Dua tabel, jadi `skip` tidak bisa dipakai langsung. Tiap tabel diambil
 * `page * PAGE_SIZE` baris teratasnya, digabung, lalu dipotong jendela
 * halamannya. Biayanya tumbuh dengan nomor halaman, bukan dengan panjang
 * riwayat, dan riwayat pembelian satu orang jarang lewat beberapa halaman.
 *
 * Dipakai /finance (tenant) dan /admin/users/[id]; sebelumnya keduanya
 * menyalin kueri dan pemetaan yang sama, tanpa batas.
 */
export async function listPurchasesPage(userId: string, requested: number): Promise<Paged<Purchase>> {
  const where = { userId, status: "fulfilled" };
  const [requestCount, orderCount] = await Promise.all([
    prisma.orderRequest.count({ where }),
    prisma.order.count({ where: { userId } }),
  ]);
  const total = requestCount + orderCount;
  const page = Math.min(requested, pageCount(total));
  const take = page * PAGE_SIZE;

  const [orderRequests, orders] = await Promise.all([
    prisma.orderRequest.findMany({
      where,
      orderBy: { fulfilledAt: "desc" },
      take,
      select: { id: true, product: true, planName: true, fulfilledAt: true },
    }),
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, amount: true, note: true, courseId: true, createdAt: true },
    }),
  ]);

  const plans: Purchase[] = orderRequests.map((o) => ({
    id: `req-${o.id}`,
    kind: "plan",
    label: `${o.product === "agent" ? "Agent" : "Metadata"} · ${o.planName}`,
    detail: null,
    amount: null,
    date: o.fulfilledAt ?? new Date(0),
  }));
  const legacy: Purchase[] = orders.map((o) => ({
    id: `ord-${o.id}`,
    kind: "order",
    label: o.courseId ? "Pembelian kelas" : "Aktivasi lisensi",
    detail: o.note,
    amount: o.amount,
    date: o.createdAt,
  }));

  const rows = mergePage(plans, legacy, (a, b) => b.date.getTime() - a.date.getTime(), page);
  return { rows, total, page };
}
