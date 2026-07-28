"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/ui/DataTable";
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
const STATUS_TONE: Record<string, string> = {
  new: "bg-gold-400/15 text-gold-600 ring-gold-400/30",
  paid: "bg-brand-blue/10 text-brand-blue ring-brand-blue/20",
  done: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
  cancelled: "bg-rose-500/10 text-rose-600 ring-rose-500/20",
};

const PAGE_SIZE = 20;

const selectClass =
  "rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 focus:outline-none focus:ring-2 focus:ring-gold-400";
const inputClass =
  "rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";

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
      render: (o) =>
        new Date(o.occurredAt).toLocaleString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    { key: "customerName", header: "Pelanggan", render: (o) => o.customerName || "Tanpa nama" },
    { key: "total", header: "Total", sortable: true, render: (o) => formatRupiah(o.total) },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (o) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
            STATUS_TONE[o.status] ?? STATUS_TONE.new
          }`}
        >
          {STATUS_LABEL[o.status] ?? o.status}
        </span>
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
            className="rounded-xl bg-navy-900/5 px-2 py-1 text-xs text-ink ring-1 ring-navy-900/10 focus:outline-none focus:ring-2 focus:ring-gold-400"
          >
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setDetail(o)}
            className="rounded-full bg-navy-900/5 px-3 py-1 text-xs font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
          >
            Detail
          </button>
          <button
            onClick={() => remove(o.id)}
            disabled={busy}
            className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-600 ring-1 ring-rose-500/20 transition hover:bg-rose-500/15 disabled:opacity-50"
          >
            Hapus
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari pelanggan..."
          className={`${inputClass} flex-1 min-w-[150px]`}
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
          className={selectClass}
          aria-label="Dari tanggal"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className={selectClass}
          aria-label="Sampai tanggal"
        />
        <button
          onClick={openCreate}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110"
        >
          + Catat transaksi
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-rose-500">{error}</p>}

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
          <div className="space-y-3 text-sm">
            <p className="text-muted">
              {detail.customerName || "Tanpa nama"} ·{" "}
              {new Date(detail.occurredAt).toLocaleString("id-ID")}
            </p>
            {new Date(detail.createdAt).getTime() - new Date(detail.occurredAt).getTime() >
              60_000 && (
              <p className="text-xs text-muted/70">
                Dicatat pada {new Date(detail.createdAt).toLocaleString("id-ID")}
              </p>
            )}
            <ul className="space-y-1">
              {detail.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 text-ink">
                  <span>
                    {item.productName} × {item.qty}
                  </span>
                  <span className="tabular-nums text-muted">
                    {formatRupiah(item.qty * item.unitPrice)}
                  </span>
                </li>
              ))}
            </ul>
            {detail.note && <p className="text-xs text-muted/80">Catatan: {detail.note}</p>}
            <div className="flex justify-between border-t border-navy-900/10 pt-3">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-bold text-brand-blue">{formatRupiah(detail.total)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
