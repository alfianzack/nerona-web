"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ProductForm, EMPTY_PRODUCT, type ProductFormValues } from "@/components/shop/ProductForm";
import { formatRupiah } from "@/lib/format";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  isActive: boolean;
}

const PAGE_SIZE = 20;

/**
 * Belum ada primitive untuk <select>. Bentuknya sengaja dijiplak dari Input —
 * radius kendali, cincin border, dan cincin fokus aksen yang sama — supaya
 * kotak cari dan kedua penyaring di baris yang sama tidak berbeda tinggi.
 */
const selectClass =
  "rounded-control bg-surface px-3 py-2.5 text-body text-ink ring-1 ring-border transition focus:outline-none focus:ring-2 focus:ring-accent";

export function ProductManager() {
  const [rows, setRows] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sort,
      order,
    });
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (stockFilter) params.set("stockFilter", stockFilter);

    const res = await fetch(`/api/shop/products?${params.toString()}`);
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat produk.");
      return;
    }
    setError("");
    setRows(data.rows);
    setTotal(data.total);
  }, [page, sort, order, q, status, stockFilter]);

  // Debounce reload on any query change.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Reset to page 1 when filters/search change.
  useEffect(() => {
    setPage(1);
  }, [q, status, stockFilter, sort, order]);

  function openAdd() {
    setEditing(null);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setFormError("");
    setModalOpen(true);
  }

  async function submitForm(values: ProductFormValues) {
    setBusy(true);
    const payload = {
      name: values.name,
      price: values.price,
      stock: values.stock === "" ? null : values.stock,
      description: values.description,
    };
    const res = editing
      ? await fetch(`/api/shop/products/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/shop/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !data?.ok) {
      setFormError(data?.message || "Gagal menyimpan produk.");
      return;
    }
    setFormError("");
    setModalOpen(false);
    await load();
  }

  async function toggleActive(product: Product) {
    setBusy(true);
    const res = await fetch(`/api/shop/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !product.isActive }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Gagal memperbarui produk.");
      return;
    }
    await load();
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await fetch(`/api/shop/products/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Gagal menghapus produk.");
      return;
    }
    await load();
  }

  const columns: Column<Product>[] = [
    { key: "name", header: "Nama", sortable: true },
    {
      key: "price",
      header: "Harga",
      sortable: true,
      render: (p) => <span className="font-mono tabular-nums">{formatRupiah(p.price)}</span>,
    },
    {
      key: "stock",
      header: "Stok",
      sortable: true,
      render: (p) => (
        <span className="font-mono tabular-nums">{p.stock === null ? "—" : String(p.stock)}</span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      render: (p) =>
        p.isActive ? <Badge tone="success">aktif</Badge> : <Badge tone="neutral">nonaktif</Badge>,
    },
    {
      key: "actions",
      header: "Aksi",
      render: (p) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>
            Edit
          </Button>
          <Button variant="secondary" size="sm" onClick={() => toggleActive(p)} disabled={busy}>
            {p.isActive ? "Nonaktifkan" : "Aktifkan"}
          </Button>
          <Button variant="danger" size="sm" onClick={() => remove(p.id)} disabled={busy}>
            Hapus
          </Button>
        </div>
      ),
    },
  ];

  const editInitial: ProductFormValues = editing
    ? {
        name: editing.name,
        price: String(editing.price),
        stock: editing.stock === null ? "" : String(editing.stock),
        description: editing.description ?? "",
      }
    : EMPTY_PRODUCT;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama produk..."
          className="min-w-[160px] flex-1"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="">Semua status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">Semua stok</option>
          <option value="low">Stok menipis (≤ 5)</option>
          <option value="out">Stok habis</option>
        </select>
        {/* Menambah produk tidak menggerakkan uang, jadi tombolnya primary. */}
        <Button onClick={openAdd}>+ Tambah produk</Button>
      </div>

      {error && <p className="mb-3 text-caption text-danger">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        sort={sort}
        order={order}
        loading={loading}
        emptyMessage="Belum ada produk. Tambahkan produk pertama Anda."
        rowKey={(p) => p.id}
        onPageChange={setPage}
        onSortChange={(s, o) => {
          setSort(s);
          setOrder(o);
        }}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit produk" : "Tambah produk"}
      >
        <ProductForm
          key={editing?.id ?? "new"}
          initial={editInitial}
          submitting={busy}
          serverError={formError}
          onSubmit={submitForm}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
