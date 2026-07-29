import { requireUser } from "@/lib/session-guards";
import { ProductManager } from "@/components/shop/ProductManager";

export const metadata = { title: "Produk — Nerona" };

export default async function ProdukPage() {
  await requireUser();

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-14 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Produk</h1>
        <p className="mt-2 text-sm text-muted">
          Kelola daftar produk toko Anda — tambah, ubah harga & stok, atau nonaktifkan.
        </p>
        <div className="mt-8">
          <ProductManager />
        </div>
      </div>
    </main>
  );
}
