"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatRupiah } from "@/lib/format";
import {
  OrderForm,
  type OrderFormPayload,
  type ProductOption,
} from "@/components/shop/OrderForm";

interface OrderItem {
  id: string;
  productName: string;
  qty: number;
  unitPrice: number;
}

interface Order {
  id: string;
  customerName: string | null;
  status: string;
  total: number;
  note: string | null;
  occurredAt: string;
  createdAt: string;
  items: OrderItem[];
}

const STATUS_LABEL: Record<string, string> = {
  new: "Baru",
  paid: "Dibayar",
  done: "Selesai",
  cancelled: "Batal",
};
/**
 * Empat pasang warna yang sebelumnya ditulis tangan di sini turun jadi nada
 * Badge. "Baru" memakai nada peringatan, bukan emas: emas di dalam aplikasi
 * menandai aksi yang menggerakkan uang, jadi memakainya untuk status membuat
 * dua hal berbeda terlihat sama.
 */
const STATUS_TONE: Record<string, BadgeTone> = {
  new: "warning",
  paid: "info",
  done: "success",
  cancelled: "danger",
};

const PAGE_SIZE = 20;

/**
 * Belum ada primitive untuk <select>. Bentuknya dijiplak dari Input supaya
 * kotak cari, penyaring status, dan kedua kotak tanggal di baris yang sama
 * tidak berbeda tinggi.
 */
const selectClass =
  "rounded-control bg-surface px-3 py-2.5 text-body text-ink ring-1 ring-border transition focus:outline-none focus:ring-2 focus:ring-accent";
// Versi rapat untuk pemilih status di dalam baris tabel: tingginya disamakan
// dengan tombol ukuran kecil yang berdiri tepat di sebelahnya.
const rowSelectClass =
  "rounded-control bg-surface px-2 py-1.5 text-caption text-ink ring-1 ring-border transition focus:outline-none focus:ring-2 focus:ring-accent";

export function OrderManager() {
  const [rows, setRows] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("occurredAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [detail, setDetail] = useState<Order | null>(null);

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
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    const res = await fetch(`/api/shop/orders?${params.toString()}`);
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat transaksi.");
      return;
    }
    setError("");
    setRows(data.rows);
    setTotal(data.total);
  }, [page, sort, order, q, status, dateFrom, dateTo]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [q, status, dateFrom, dateTo, sort, order]);

  // Load active products once for the create form's dropdown.
  const loadProducts = useCallback(async () => {
    const res = await fetch("/api/shop/products?status=active&pageSize=100");
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      setProducts(
        data.rows.map((p: { id: string; name: string; price: number }) => ({
          id: p.id,
          name: p.name,
          price: p.price,
        }))
      );
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function openCreate() {
    setFormError("");
    setCreateOpen(true);
  }

  async function submitOrder(payload: OrderFormPayload) {
    setBusy(true);
    const res = await fetch("/api/shop/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !data?.ok) {
      setFormError(data?.message || "Gagal membuat transaksi.");
      return;
    }
    setFormError("");
    setCreateOpen(false);
    await load();
  }

  async function changeStatus(id: string, newStatus: string) {
    setBusy(true);
    const res = await fetch(`/api/shop/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Gagal memperbarui status.");
      return;
    }
    await load();
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await fetch(`/api/shop/orders/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Gagal menghapus transaksi.");
      return;
    }
    await load();
  }

  const columns: Column<Order>[] = [
    {
      key: "occurredAt",
      header: "Tanggal",
      sortable: true,
      render: (o) => (
        <span className="font-mono tabular-nums">
          {new Date(o.occurredAt).toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    { key: "customerName", header: "Pelanggan", render: (o) => o.customerName || "Tanpa nama" },
    {
      key: "total",
      header: "Total",
      sortable: true,
      render: (o) => <span className="font-mono tabular-nums">{formatRupiah(o.total)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (o) => (
        <Badge tone={STATUS_TONE[o.status] ?? STATUS_TONE.new}>
          {STATUS_LABEL[o.status] ?? o.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      render: (o) => (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={o.status}
            onChange={(e) => changeStatus(o.id, e.target.value)}
            disabled={busy}
            className={rowSelectClass}
          >
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={() => setDetail(o)}>
            Detail
          </Button>
          <Button variant="danger" size="sm" onClick={() => remove(o.id)} disabled={busy}>
            Hapus
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari pelanggan..."
          className="min-w-[150px] flex-1"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="">Semua status</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className={`${selectClass} font-mono tabular-nums`}
          aria-label="Dari tanggal"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className={`${selectClass} font-mono tabular-nums`}
          aria-label="Sampai tanggal"
        />
        {/* Mencatat transaksi tidak menggerakkan uang, jadi tombolnya primary. */}
        <Button onClick={openCreate}>+ Catat transaksi</Button>
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
        emptyMessage="Belum ada transaksi."
        rowKey={(o) => o.id}
        onPageChange={setPage}
        onSortChange={(s, o) => {
          setSort(s);
          setOrder(o);
        }}
      />

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Catat transaksi">
        <OrderForm
          products={products}
          submitting={busy}
          serverError={formError}
          onSubmit={submitOrder}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      <Modal open={detail !== null} onClose={() => setDetail(null)} title="Detail transaksi">
        {detail && (
          <div className="space-y-3 text-body">
            <p className="text-muted">
              {detail.customerName || "Tanpa nama"} ·{" "}
              <span className="font-mono tabular-nums">
                {new Date(detail.occurredAt).toLocaleString("id-ID")}
              </span>
            </p>
            {new Date(detail.createdAt).getTime() - new Date(detail.occurredAt).getTime() >
              60_000 && (
              <p className="text-caption text-muted">
                Dicatat pada{" "}
                <span className="font-mono tabular-nums">
                  {new Date(detail.createdAt).toLocaleString("id-ID")}
                </span>
              </p>
            )}
            <ul className="space-y-1">
              {detail.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 text-ink">
                  <span>
                    {item.productName} ×{" "}
                    <span className="font-mono tabular-nums">{item.qty}</span>
                  </span>
                  <span className="font-mono tabular-nums text-muted">
                    {formatRupiah(item.qty * item.unitPrice)}
                  </span>
                </li>
              ))}
            </ul>
            {detail.note && <p className="text-caption text-muted">Catatan: {detail.note}</p>}
            <div className="flex justify-between border-t border-divider pt-3">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-mono font-semibold tabular-nums text-accent">
                {formatRupiah(detail.total)}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
