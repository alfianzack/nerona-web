import { requireUser } from "@/lib/session-guards";
import { OrderManager } from "@/components/shop/OrderManager";

export const metadata = { title: "Transaksi — Nerona" };

export default async function TransaksiPage() {
  await requireUser();

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-14 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Transaksi</h1>
        <p className="mt-2 text-sm text-muted">
          Catat penjualan Anda — pilih produk, atur jumlah, dan perbarui statusnya.
        </p>
        <div className="mt-8">
          <OrderManager />
        </div>
      </div>
    </main>
  );
}
