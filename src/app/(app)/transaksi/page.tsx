import { requireUser } from "@/lib/session-guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { OrderManager } from "@/components/shop/OrderManager";

export const metadata = { title: "Transaksi — Nerona" };

export default async function TransaksiPage() {
  await requireUser();

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-band">
        <PageHeader
          title="Transaksi"
          description="Catat penjualan Anda — pilih produk, atur jumlah, dan perbarui statusnya."
        />
        <div className="mt-8">
          <OrderManager />
        </div>
      </div>
    </main>
  );
}
