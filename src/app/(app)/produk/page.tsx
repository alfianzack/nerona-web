import { requireUser } from "@/lib/session-guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductManager } from "@/components/shop/ProductManager";

export const metadata = { title: "Produk — Nerona" };

export default async function ProdukPage() {
  await requireUser();

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-band">
        <PageHeader
          title="Produk"
          description="Kelola daftar produk toko Anda — tambah, ubah harga & stok, atau nonaktifkan."
        />
        <div className="mt-8">
          <ProductManager />
        </div>
      </div>
    </main>
  );
}
