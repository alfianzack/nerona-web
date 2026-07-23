# Tenant Shop UX — Fase 2: Halaman Transaksi (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah query transaksi server-side (`listOrdersPaged`), dan tulis ulang halaman Transaksi menjadi tabel dengan pagination/filter/sort + popup buat transaksi (multi-item) + popup detail + ubah status inline.

**Architecture:** Reuse `DataTable` + `Modal` dari Fase 1. Logika query di `src/lib/shop.ts` (diuji unit). Route API adapter tipis. `OrderManager` jadi komponen client controlled; form buat-transaksi diekstrak ke `OrderForm`.

**Tech Stack:** Next.js 14 + TypeScript + Prisma 5 + Vitest + Tailwind.

Referensi spec: `docs/superpowers/specs/2026-07-21-tenant-shop-ux-overhaul-design.md` (bagian 5.2, 5.3, 7). Fase 1 sudah membuat `DataTable`, `Modal`, `formatRupiah` (di `ProductManager.tsx`), dan mengubah `GET /api/shop/products` → `{ ok, rows, total, page, pageSize }`.

## Global Constraints

- Semua query transaksi di-scope `userId`.
- `GET /api/shop/orders` menerima: `page`(default 1), `pageSize`(default 20, maks 100), `q`(cari `customerName`), `sort`(`createdAt|total|status`, default `createdAt`), `order`(`asc|desc`, default `desc`), `status`(`new|paid|done|cancelled`), `dateFrom`/`dateTo`(YYYY-MM-DD; inklusif — `dateTo` mencakup sampai akhir hari), `totalMin`/`totalMax`; mengembalikan `{ ok, rows, total, page, pageSize }` (rows menyertakan `items`).
- Ubah status transaksi memakai **select inline** di kolom Aksi (bukan popup) — ini keputusan plan yang MENGGANTIKAN kalimat "popup ubah status" di spec (popup untuk satu dropdown berlebihan). "Buat transaksi" TETAP popup. "Detail" (lihat item) popup.
- Nilai enum tak valid pada query → fallback ke default; `q` di-trim.
- **Regresi Fase 1 yang harus diperbaiki:** `OrderManager` lama membaca `pData.products` dari `/api/shop/products`; endpoint itu kini mengembalikan `rows`. Rewrite HARUS membaca `.rows`.
- Reuse `formatRupiah` dari `@/components/shop/ProductManager` (jangan definisikan ulang).
- Komponen React presentasi diverifikasi via `tsc` + `npm run build` (tak ada RTL). Hanya fungsi `shop.ts` yang di-TDD.
- Commit dengan path file eksplisit (working tree punya perubahan lain yang belum di-commit — jangan `git add -A`).

---

### Task 1: `listOrdersPaged` + query config

**Files:**
- Modify: `src/lib/shop.ts`
- Test: `tests/lib/shop-orders-paged.test.ts`

**Interfaces:**
- Consumes: `prisma`, `OrderStatus` (existing), `Prisma` type (import sudah ditambah di Fase 1).
- Produces: `interface OrderQuery { page; pageSize; q?; sort: "createdAt"|"total"|"status"; order: "asc"|"desc"; status?: OrderStatus; dateFrom?: Date; dateTo?: Date; totalMin?: number; totalMax?: number }`, `listOrdersPaged(userId, query): Promise<{ rows: (ShopOrder & { items: ShopOrderItem[] })[]; total: number }>`. Dipakai Task 2.

- [ ] **Step 1: Tulis test yang gagal**

Create `tests/lib/shop-orders-paged.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shopOrder: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { listOrdersPaged } from "@/lib/shop";
import { prisma } from "@/lib/prisma";

const baseQuery = {
  page: 1,
  pageSize: 20,
  sort: "createdAt" as const,
  order: "desc" as const,
};

function mockDb(rows: unknown[], total: number) {
  (prisma.shopOrder.findMany as any).mockResolvedValue(rows);
  (prisma.shopOrder.count as any).mockResolvedValue(total);
}

describe("listOrdersPaged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes to userId, paginates, includes items, returns rows + total", async () => {
    mockDb([{ id: "o1", items: [] }], 1);

    const result = await listOrdersPaged("user-1", baseQuery);

    expect(result).toEqual({ rows: [{ id: "o1", items: [] }], total: 1 });
    expect(prisma.shopOrder.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 20,
      include: { items: true },
    });
    expect(prisma.shopOrder.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("computes skip from page and pageSize", async () => {
    mockDb([], 0);
    await listOrdersPaged("user-1", { ...baseQuery, page: 4, pageSize: 25 });
    expect(prisma.shopOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 75, take: 25 })
    );
  });

  it("searches customerName case-insensitively", async () => {
    mockDb([], 0);
    await listOrdersPaged("user-1", { ...baseQuery, q: "budi" });
    expect(prisma.shopOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", customerName: { contains: "budi", mode: "insensitive" } },
      })
    );
  });

  it("filters by status", async () => {
    mockDb([], 0);
    await listOrdersPaged("user-1", { ...baseQuery, status: "paid" });
    expect(prisma.shopOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", status: "paid" } })
    );
  });

  it("applies an inclusive date range on createdAt", async () => {
    mockDb([], 0);
    const dateFrom = new Date("2026-07-01T00:00:00");
    const dateTo = new Date("2026-07-31T23:59:59.999");
    await listOrdersPaged("user-1", { ...baseQuery, dateFrom, dateTo });
    expect(prisma.shopOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", createdAt: { gte: dateFrom, lte: dateTo } },
      })
    );
  });

  it("applies a total range", async () => {
    mockDb([], 0);
    await listOrdersPaged("user-1", { ...baseQuery, totalMin: 10000, totalMax: 50000 });
    expect(prisma.shopOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", total: { gte: 10000, lte: 50000 } },
      })
    );
  });

  it("sorts by the requested column and order", async () => {
    mockDb([], 0);
    await listOrdersPaged("user-1", { ...baseQuery, sort: "total", order: "asc" });
    expect(prisma.shopOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { total: "asc" } })
    );
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan gagal**

Run: `npx vitest run tests/lib/shop-orders-paged.test.ts`
Expected: FAIL — `listOrdersPaged` belum ada.

- [ ] **Step 3: Implementasi di `src/lib/shop.ts`**

Tambah di bagian Orders (setelah `export function listOrders(...)`, biarkan `listOrders` lama):

```ts
export interface OrderQuery {
  page: number;
  pageSize: number;
  q?: string;
  sort: "createdAt" | "total" | "status";
  order: "asc" | "desc";
  status?: OrderStatus;
  dateFrom?: Date;
  dateTo?: Date;
  totalMin?: number;
  totalMax?: number;
}

export async function listOrdersPaged(userId: string, query: OrderQuery) {
  const where: Prisma.ShopOrderWhereInput = { userId };

  if (query.q) {
    where.customerName = { contains: query.q, mode: "insensitive" };
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom ? { gte: query.dateFrom } : {}),
      ...(query.dateTo ? { lte: query.dateTo } : {}),
    };
  }
  if (query.totalMin !== undefined || query.totalMax !== undefined) {
    where.total = {
      ...(query.totalMin !== undefined ? { gte: query.totalMin } : {}),
      ...(query.totalMax !== undefined ? { lte: query.totalMax } : {}),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.shopOrder.findMany({
      where,
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { items: true },
    }),
    prisma.shopOrder.count({ where }),
  ]);

  return { rows, total };
}
```

- [ ] **Step 4: Jalankan test — pastikan lulus**

Run: `npx vitest run tests/lib/shop-orders-paged.test.ts`
Expected: PASS — 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shop.ts tests/lib/shop-orders-paged.test.ts
git commit -m "Add server-side paged order query with filters and sort"
```

---

### Task 2: Route `GET /api/shop/orders` server-side

**Files:**
- Modify: `src/app/api/shop/orders/route.ts` (hanya fungsi `GET` + import + helper)

**Interfaces:**
- Consumes: `listOrdersPaged`, `OrderQuery`, `isOrderStatus` (existing) dari `@/lib/shop`.
- Produces: respons `{ ok, rows, total, page, pageSize }`. Dikonsumsi Task 4. (POST tidak berubah.)
- Catatan: route diverifikasi manual.

- [ ] **Step 1: Ganti import & fungsi `GET`**

Ganti baris import:

```ts
import { createOrder, listOrders, type OrderItemInput } from "@/lib/shop";
```

menjadi:

```ts
import { createOrder, listOrdersPaged, isOrderStatus, type OrderItemInput, type OrderQuery } from "@/lib/shop";
```

Ganti seluruh fungsi `GET`:

```ts
function numParam(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function dateParam(value: string | null, endOfDay: boolean): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));

  const sortParam = searchParams.get("sort");
  const sort: OrderQuery["sort"] = (["createdAt", "total", "status"] as const).includes(
    sortParam as OrderQuery["sort"]
  )
    ? (sortParam as OrderQuery["sort"])
    : "createdAt";
  const order: OrderQuery["order"] = searchParams.get("order") === "asc" ? "asc" : "desc";

  const statusParam = searchParams.get("status");
  const status = isOrderStatus(statusParam) ? statusParam : undefined;

  const query: OrderQuery = {
    page,
    pageSize,
    q: searchParams.get("q")?.trim() || undefined,
    sort,
    order,
    status,
    dateFrom: dateParam(searchParams.get("dateFrom"), false),
    dateTo: dateParam(searchParams.get("dateTo"), true),
    totalMin: numParam(searchParams.get("totalMin")),
    totalMax: numParam(searchParams.get("totalMax")),
  };

  const { rows, total } = await listOrdersPaged(session.user.id, query);
  return NextResponse.json({ ok: true, rows, total, page, pageSize });
}
```

- [ ] **Step 2: Verifikasi type-check**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shop/orders/route.ts
git commit -m "Parse pagination/filter/sort params in orders GET route"
```

---

### Task 3: Komponen `OrderForm`

**Files:**
- Create: `src/components/shop/OrderForm.tsx`

**Interfaces:**
- Produces:
  - `interface ProductOption { id: string; name: string; price: number }`
  - `interface OrderItemPayload { productId: string | null; productName: string; qty: number; unitPrice: number }`
  - `interface OrderFormPayload { customerName: string; note: string; items: OrderItemPayload[] }`
  - `OrderForm({ products, submitting, serverError, onSubmit, onCancel }: { products: ProductOption[]; submitting: boolean; serverError?: string; onSubmit: (payload: OrderFormPayload) => void; onCancel: () => void })`
- Dipakai Task 4 di dalam `Modal`.

- [ ] **Step 1: Buat `src/components/shop/OrderForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { formatRupiah } from "@/components/shop/ProductManager";

export interface ProductOption {
  id: string;
  name: string;
  price: number;
}

export interface OrderItemPayload {
  productId: string | null;
  productName: string;
  qty: number;
  unitPrice: number;
}

export interface OrderFormPayload {
  customerName: string;
  note: string;
  items: OrderItemPayload[];
}

interface DraftItem {
  productId: string;
  productName: string;
  qty: string;
  unitPrice: string;
}

const emptyItem = (): DraftItem => ({ productId: "", productName: "", qty: "1", unitPrice: "" });

const inputClass =
  "w-full rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";
const secondaryBtn =
  "rounded-full bg-navy-900/5 px-3.5 py-1.5 text-sm font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-50";

interface OrderFormProps {
  products: ProductOption[];
  submitting: boolean;
  serverError?: string;
  onSubmit: (payload: OrderFormPayload) => void;
  onCancel: () => void;
}

export function OrderForm({ products, submitting, serverError, onSubmit, onCancel }: OrderFormProps) {
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [error, setError] = useState("");

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function onPickProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (product) {
      updateItem(index, { productId, productName: product.name, unitPrice: String(product.price) });
    } else {
      updateItem(index, { productId: "" });
    }
  }

  const draftTotal = items.reduce(
    (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0),
    0
  );

  function handleSubmit() {
    const cleaned = items.filter((item) => item.productName.trim() && Number(item.qty) > 0);
    if (cleaned.length === 0) {
      setError("Tambahkan minimal satu item dengan nama dan jumlah.");
      return;
    }
    setError("");
    onSubmit({
      customerName,
      note,
      items: cleaned.map((item) => ({
        productId: item.productId || null,
        productName: item.productName.trim(),
        qty: Number(item.qty),
        unitPrice: Number(item.unitPrice) || 0,
      })),
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Nama pelanggan (opsional)"
          className={inputClass}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              value={item.productId}
              onChange={(e) => onPickProduct(index, e.target.value)}
              className={`${inputClass} sm:w-40`}
            >
              <option value="">— pilih produk —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              value={item.productName}
              onChange={(e) => updateItem(index, { productName: e.target.value })}
              placeholder="Nama item"
              className={`${inputClass} sm:flex-1`}
            />
            <input
              value={item.qty}
              onChange={(e) => updateItem(index, { qty: e.target.value })}
              placeholder="Qty"
              inputMode="numeric"
              className={`${inputClass} sm:w-16`}
            />
            <input
              value={item.unitPrice}
              onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
              placeholder="Harga"
              inputMode="numeric"
              className={`${inputClass} sm:w-24`}
            />
            <button
              onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
              className="rounded-full px-2 py-1 text-sm text-rose-600 transition hover:bg-rose-500/10"
              aria-label="Hapus item"
            >
              ✕
            </button>
          </div>
        ))}
        <button onClick={() => setItems((prev) => [...prev, emptyItem()])} className={secondaryBtn}>
          + Item
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-navy-900/10 pt-3">
        <span className="text-sm font-semibold text-ink">Total</span>
        <span className="text-lg font-extrabold text-brand-blue">{formatRupiah(draftTotal)}</span>
      </div>

      {(error || serverError) && (
        <p className="text-sm text-rose-500">{error || serverError}</p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className={secondaryBtn}>
          Batal
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? "Menyimpan..." : "Simpan transaksi"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verifikasi type-check**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add src/components/shop/OrderForm.tsx
git commit -m "Add OrderForm (multi-item) used inside the transaction modal"
```

---

### Task 4: Tulis ulang `OrderManager` (tabel + popup)

**Files:**
- Modify: `src/components/shop/OrderManager.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `DataTable`, `Column` (Fase 1); `Modal` (Fase 1); `OrderForm`, `ProductOption`, `OrderFormPayload` (Task 3); `formatRupiah` (dari ProductManager); `GET/POST /api/shop/orders`, `PATCH/DELETE /api/shop/orders/[id]`, `GET /api/shop/products?status=active`.
- Catatan: diverifikasi manual + `npm run build`.

- [ ] **Step 1: Ganti seluruh isi `src/components/shop/OrderManager.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { formatRupiah } from "@/components/shop/ProductManager";
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
  const [sort, setSort] = useState("createdAt");
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
      key: "createdAt",
      header: "Tanggal",
      sortable: true,
      render: (o) =>
        new Date(o.createdAt).toLocaleString("id-ID", {
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
              {new Date(detail.createdAt).toLocaleString("id-ID")}
            </p>
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
```

- [ ] **Step 2: Verifikasi type-check & build**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add src/components/shop/OrderManager.tsx
git commit -m "Rewrite OrderManager as a paged/filterable table with modal form and detail"
```

---

### Task 5: Verifikasi penuh Fase 2

**Files:** none (verifikasi saja).

- [ ] **Step 1: Seluruh unit test**

Run: `npm test`
Expected: lulus termasuk `tests/lib/shop-orders-paged.test.ts` (7). Kegagalan pre-existing di `orders.test.ts` (submitOrder) dicatat sebagai di luar ruang lingkup.

- [ ] **Step 2: Build produksi**

Run: `npm run build`
Expected: sukses tanpa error tipe.

- [ ] **Step 3: Cek manual `/transaksi`**

Run: `npm run dev`, login, buka `/transaksi`.
- Tabel + pagination; sort Tanggal/Total/Status; cari pelanggan; filter status + rentang tanggal.
- "+ Catat transaksi" → popup; dropdown produk terisi (produk aktif); tambah/hapus item; total live; simpan → transaksi muncul.
- Ubah status via select inline; "Detail" popup menampilkan item + total; Hapus bekerja.

---

## Fase 2 complete when

- `npm test` hijau termasuk `shop-orders-paged.test.ts`.
- `npm run build` sukses.
- `/transaksi` menampilkan tabel server-side (pagination, sort, cari pelanggan, filter status & rentang tanggal), popup buat transaksi (dropdown produk aktif terisi — regresi Fase 1 teratasi), popup detail, ubah status inline, hapus.

**Fase berikutnya:** Fase 3 (Profile + Dashboard).
