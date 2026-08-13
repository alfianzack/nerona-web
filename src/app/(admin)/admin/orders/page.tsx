import { AdminOrdersPanel } from "@/components/admin/AdminOrdersPanel";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AdminOrdersPage() {
  return (
    <>
      {/* Judul halaman ini dulu hidup sebagai <h2> di dalam panel klien, jadi
          layar order sama sekali tidak punya judul tingkat satu. PageHeader
          menaruhnya di tempat yang sama dengan halaman admin lain.

          Tanpa <main> dan tanpa pembungkus lebar: keduanya sudah datang dari
          layout (admin), dan menambahkannya lagi di sini berarti dua wadah
          bersarang dengan padding ganda. */}
      <PageHeader title="Order Masuk" />
      <div className="mt-8">
        <AdminOrdersPanel />
      </div>
    </>
  );
}
