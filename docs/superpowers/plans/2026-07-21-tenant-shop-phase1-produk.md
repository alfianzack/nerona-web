# Tenant Shop UX — Fase 1: Infra Tabel + Halaman Produk (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bangun komponen bersama `Modal` + `DataTable`, tambah query produk server-side (`listProductsPaged`), dan tulis ulang halaman Produk menjadi tabel dengan pagination/filter/sort + form popup.

**Architecture:** Komponen UI generik di `src/components/ui/`. Logika query di `src/lib/shop.ts` (diuji unit). Route API tetap adapter tipis yang mem-parse query string. `ProductManager` jadi komponen client "controlled" yang fetch per perubahan state dan merender `DataTable` + `Modal`.

**Tech Stack:** Next.js 14 (App Router) + TypeScript + Prisma 5 + Vitest + Tailwind.

Referensi spec: `docs/superpowers/specs/2026-07-21-tenant-shop-ux-overhaul-design.md` (bagian 4, 5.1, 5.3, 6).

## Global Constraints

- Semua query produk di-scope `userId`.
- Server-side: `GET /api/shop/products` menerima `page`(default 1), `pageSize`(default 20, maks 100), `q`, `sort`(`name|price|stock|createdAt`, default `createdAt`), `order`(`asc|desc`, default `desc`), `status`(`active|inactive`), `stockFilter`(`low|out`), `priceMin`, `priceMax`; mengembalikan `{ ok, rows, total, page, pageSize }`.
- `low` = `stock <= 5`, `out` = `stock = 0`; keduanya hanya berlaku untuk `stock` non-null (`{ lte }`/`{ equals }` di Prisma otomatis mengecualikan null).
- `LOW_STOCK_THRESHOLD = 5` diekspor dari `shop.ts` (dipakai lagi di Fase 3).
- Komponen React murni-presentasi diverifikasi manual + `npm run build` (repo tak punya React Testing Library); hanya fungsi `shop.ts` yang di-TDD.
- Commit dengan path file eksplisit (working tree memuat perubahan lain yang belum di-commit — jangan `git add -A`).
- Ikuti pola gaya Tailwind yang ada (kelas `inputClass`/`primaryBtn`/`secondaryBtn` di `ProductManager` lama, token warna `ink`/`muted`/`surface`/`gold-400`).

---

### Task 1: Komponen `Modal`

**Files:**
- Create: `src/components/ui/Modal.tsx`

**Interfaces:**
- Produces: `Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode })`. Dipakai Task 6 (produk) & Fase 2/3.

- [ ] **Step 1: Buat `src/components/ui/Modal.tsx`**

```tsx
"use client";

import { ReactNode, useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-xl shadow-navy-900/20 ring-1 ring-navy-900/10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1 text-muted transition hover:bg-navy-900/5 hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
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
git add src/components/ui/Modal.tsx
git commit -m "Add generic Modal component"
```

---

### Task 2: Komponen `DataTable`

**Files:**
- Create: `src/components/ui/DataTable.tsx`

**Interfaces:**
- Produces:
  - `interface Column<T> { key: string; header: string; sortable?: boolean; render?: (row: T) => React.ReactNode; className?: string }`
  - `DataTable<T>(props: { columns: Column<T>[]; rows: T[]; total: number; page: number; pageSize: number; sort: string; order: "asc" | "desc"; loading?: boolean; emptyMessage?: string; rowKey: (row: T) => string; onPageChange: (page: number) => void; onSortChange: (sort: string, order: "asc" | "desc") => void })`
- Controlled — tidak fetch sendiri. Dipakai Task 6 & Fase 2.

- [ ] **Step 1: Buat `src/components/ui/DataTable.tsx`**

```tsx
"use client";

import { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  order: "asc" | "desc";
  loading?: boolean;
  emptyMessage?: string;
  rowKey: (row: T) => string;
  onPageChange: (page: number) => void;
  onSortChange: (sort: string, order: "asc" | "desc") => void;
}

export function DataTable<T>({
  columns,
  rows,
  total,
  page,
  pageSize,
  sort,
  order,
  loading,
  emptyMessage = "Belum ada data.",
  rowKey,
  onPageChange,
  onSortChange,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function handleHeaderClick(col: Column<T>) {
    if (!col.sortable) return;
    if (sort === col.key) {
      onSortChange(col.key, order === "asc" ? "desc" : "asc");
    } else {
      onSortChange(col.key, "asc");
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-surface to-surface2 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy-900/10 text-xs uppercase tracking-wide text-muted">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleHeaderClick(col)}
                  className={`px-4 py-3 font-medium ${col.sortable ? "cursor-pointer select-none hover:text-ink" : ""} ${col.className ?? ""}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && sort === col.key && (
                      <span aria-hidden="true">{order === "asc" ? "▲" : "▼"}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={rowKey(row)} className="border-b border-navy-900/5 last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-ink ${col.className ?? ""}`}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-900/10 px-4 py-3 text-sm text-muted">
        <span>
          Menampilkan {from}–{to} dari {total}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-full bg-navy-900/5 px-3 py-1 font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-40"
          >
            Sebelumnya
          </button>
          <span className="text-ink">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-full bg-navy-900/5 px-3 py-1 font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-40"
          >
            Berikutnya
          </button>
        </div>
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
git add src/components/ui/DataTable.tsx
git commit -m "Add generic controlled DataTable component"
```

---

### Task 3: `listProductsPaged` + konfigurasi query

**Files:**
- Modify: `src/lib/shop.ts`
- Test: `tests/lib/shop-products-paged.test.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces: `LOW_STOCK_THRESHOLD = 5`, `interface ProductQuery { page; pageSize; q?; sort: "name"|"price"|"stock"|"createdAt"; order: "asc"|"desc"; status?: "active"|"inactive"; stockFilter?: "low"|"out"; priceMin?; priceMax? }`, `listProductsPaged(userId: string, query: ProductQuery): Promise<{ rows: ShopProduct[]; total: number }>`. Dipakai Task 4.

- [ ] **Step 1: Tulis test yang gagal**

Create `tests/lib/shop-products-paged.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shopProduct: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { listProductsPaged, LOW_STOCK_THRESHOLD } from "@/lib/shop";
import { prisma } from "@/lib/prisma";

const baseQuery = {
  page: 1,
  pageSize: 20,
  sort: "createdAt" as const,
  order: "desc" as const,
};

function mockDb(rows: unknown[], total: number) {
  (prisma.shopProduct.findMany as any).mockResolvedValue(rows);
  (prisma.shopProduct.count as any).mockResolvedValue(total);
}

describe("listProductsPaged", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes to userId, paginates, and returns rows + total", async () => {
    mockDb([{ id: "p1" }], 1);

    const result = await listProductsPaged("user-1", baseQuery);

    expect(result).toEqual({ rows: [{ id: "p1" }], total: 1 });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 20,
    });
    expect(prisma.shopProduct.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("computes skip from page and pageSize", async () => {
    mockDb([], 0);
    await listProductsPaged("user-1", { ...baseQuery, page: 3, pageSize: 10 });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it("adds a case-insensitive name search", async () => {
    mockDb([], 0);
    await listProductsPaged("user-1", { ...baseQuery, q: "kopi" });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", name: { contains: "kopi", mode: "insensitive" } },
      })
    );
  });

  it("filters by active/inactive status", async () => {
    mockDb([], 0);
    await listProductsPaged("user-1", { ...baseQuery, status: "inactive" });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", isActive: false } })
    );
  });

  it("filters low stock at or below the threshold", async () => {
    mockDb([], 0);
    await listProductsPaged("user-1", { ...baseQuery, stockFilter: "low" });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", stock: { lte: LOW_STOCK_THRESHOLD } },
      })
    );
  });

  it("filters out-of-stock as exactly zero", async () => {
    mockDb([], 0);
    await listProductsPaged("user-1", { ...baseQuery, stockFilter: "out" });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", stock: 0 } })
    );
  });

  it("applies a price range", async () => {
    mockDb([], 0);
    await listProductsPaged("user-1", { ...baseQuery, priceMin: 1000, priceMax: 5000 });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", price: { gte: 1000, lte: 5000 } },
      })
    );
  });

  it("sorts by the requested column and order", async () => {
    mockDb([], 0);
    await listProductsPaged("user-1", { ...baseQuery, sort: "price", order: "asc" });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { price: "asc" } })
    );
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan gagal**

Run: `npx vitest run tests/lib/shop-products-paged.test.ts`
Expected: FAIL — `listProductsPaged`/`LOW_STOCK_THRESHOLD` belum ada.

- [ ] **Step 3: Implementasi di `src/lib/shop.ts`**

Tambah import tipe di atas file (setelah baris `import { prisma } from "./prisma";`):

```ts
import type { Prisma } from "@prisma/client";
```

Tambah di bagian Products (setelah `export function listProducts(...)`, boleh biarkan `listProducts` lama):

```ts
export const LOW_STOCK_THRESHOLD = 5;

export interface ProductQuery {
  page: number;
  pageSize: number;
  q?: string;
  sort: "name" | "price" | "stock" | "createdAt";
  order: "asc" | "desc";
  status?: "active" | "inactive";
  stockFilter?: "low" | "out";
  priceMin?: number;
  priceMax?: number;
}

export async function listProductsPaged(userId: string, query: ProductQuery) {
  const where: Prisma.ShopProductWhereInput = { userId };

  if (query.q) {
    where.name = { contains: query.q, mode: "insensitive" };
  }
  if (query.status === "active") {
    where.isActive = true;
  } else if (query.status === "inactive") {
    where.isActive = false;
  }
  if (query.stockFilter === "out") {
    where.stock = 0;
  } else if (query.stockFilter === "low") {
    where.stock = { lte: LOW_STOCK_THRESHOLD };
  }
  if (query.priceMin !== undefined || query.priceMax !== undefined) {
    where.price = {
      ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
      ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.shopProduct.findMany({
      where,
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.shopProduct.count({ where }),
  ]);

  return { rows, total };
}
```

- [ ] **Step 4: Jalankan test — pastikan lulus**

Run: `npx vitest run tests/lib/shop-products-paged.test.ts`
Expected: PASS — 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shop.ts tests/lib/shop-products-paged.test.ts
git commit -m "Add server-side paged product query with filters and sort"
```

---

### Task 4: Route `GET /api/shop/products` server-side

**Files:**
- Modify: `src/app/api/shop/products/route.ts` (hanya fungsi `GET`)

**Interfaces:**
- Consumes: `listProductsPaged`, `ProductQuery` (Task 3).
- Produces: respons `{ ok, rows, total, page, pageSize }`. Dikonsumsi Task 6. (POST tidak berubah.)
- Catatan: route diverifikasi manual.

- [ ] **Step 1: Ganti import & fungsi `GET`**

Ganti baris import:

```ts
import { createProduct, listProducts } from "@/lib/shop";
```

menjadi:

```ts
import { createProduct, listProductsPaged, type ProductQuery } from "@/lib/shop";
```

Ganti seluruh fungsi `GET`:

```ts
function numParam(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
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
  const sort: ProductQuery["sort"] = (["name", "price", "stock", "createdAt"] as const).includes(
    sortParam as ProductQuery["sort"]
  )
    ? (sortParam as ProductQuery["sort"])
    : "createdAt";
  const order: ProductQuery["order"] = searchParams.get("order") === "asc" ? "asc" : "desc";

  const statusParam = searchParams.get("status");
  const status =
    statusParam === "active" || statusParam === "inactive" ? statusParam : undefined;

  const stockParam = searchParams.get("stockFilter");
  const stockFilter = stockParam === "low" || stockParam === "out" ? stockParam : undefined;

  const query: ProductQuery = {
    page,
    pageSize,
    q: searchParams.get("q")?.trim() || undefined,
    sort,
    order,
    status,
    stockFilter,
    priceMin: numParam(searchParams.get("priceMin")),
    priceMax: numParam(searchParams.get("priceMax")),
  };

  const { rows, total } = await listProductsPaged(session.user.id, query);
  return NextResponse.json({ ok: true, rows, total, page, pageSize });
}
```

- [ ] **Step 2: Verifikasi type-check**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shop/products/route.ts
git commit -m "Parse pagination/filter/sort params in products GET route"
```

---

### Task 5: Komponen `ProductForm`

**Files:**
- Create: `src/components/shop/ProductForm.tsx`

**Interfaces:**
- Produces: `interface ProductFormValues { name: string; price: string; stock: string; description: string }`, `ProductForm({ initial, submitting, onSubmit, onCancel }: { initial: ProductFormValues; submitting: boolean; onSubmit: (values: ProductFormValues) => void; onCancel: () => void })`. Dipakai Task 6 di dalam `Modal`.

- [ ] **Step 1: Buat `src/components/shop/ProductForm.tsx`**

```tsx
"use client";

import { useState } from "react";

export interface ProductFormValues {
  name: string;
  price: string;
  stock: string;
  description: string;
}

export const EMPTY_PRODUCT: ProductFormValues = { name: "", price: "", stock: "", description: "" };

const inputClass =
  "w-full rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";

interface ProductFormProps {
  initial: ProductFormValues;
  submitting: boolean;
  onSubmit: (values: ProductFormValues) => void;
  onCancel: () => void;
}

export function ProductForm({ initial, submitting, onSubmit, onCancel }: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>(initial);
  const [error, setError] = useState("");

  function set<K extends keyof ProductFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit() {
    if (!values.name.trim() || values.price === "") {
      setError("Nama dan harga wajib diisi.");
      return;
    }
    setError("");
    onSubmit(values);
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm text-muted">Nama produk</label>
        <input value={values.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-muted">Harga (Rp)</label>
          <input
            value={values.price}
            onChange={(e) => set("price", e.target.value)}
            inputMode="numeric"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-sm text-muted">Stok (opsional)</label>
          <input
            value={values.stock}
            onChange={(e) => set("stock", e.target.value)}
            inputMode="numeric"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="text-sm text-muted">Deskripsi (opsional)</label>
        <input
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          className={inputClass}
        />
      </div>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="rounded-full bg-navy-900/5 px-4 py-2 text-sm font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
        >
          Batal
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? "Menyimpan..." : "Simpan"}
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
git add src/components/shop/ProductForm.tsx
git commit -m "Add ProductForm used inside the product modal"
```

---

### Task 6: Tulis ulang `ProductManager` (tabel + popup)

**Files:**
- Modify: `src/components/shop/ProductManager.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `DataTable`, `Column` (Task 2); `Modal` (Task 1); `ProductForm`, `ProductFormValues`, `EMPTY_PRODUCT` (Task 5); `GET/POST/PATCH/DELETE /api/shop/products`.
- Produces: `ProductManager()` (dipakai `/produk`), `formatRupiah` tetap diekspor (dipakai tempat lain bila ada).
- Catatan: diverifikasi manual + `npm run build`.

- [ ] **Step 1: Ganti seluruh isi `src/components/shop/ProductManager.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { ProductForm, EMPTY_PRODUCT, type ProductFormValues } from "@/components/shop/ProductForm";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  isActive: boolean;
}

export function formatRupiah(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

const PAGE_SIZE = 20;

const selectClass =
  "rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 focus:outline-none focus:ring-2 focus:ring-gold-400";
const inputClass =
  "rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";

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
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
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
    setBusy(false);
    if (!res.ok) {
      setError("Gagal menyimpan produk.");
      return;
    }
    setModalOpen(false);
    await load();
  }

  async function toggleActive(product: Product) {
    setBusy(true);
    await fetch(`/api/shop/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !product.isActive }),
    });
    setBusy(false);
    await load();
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/shop/products/${id}`, { method: "DELETE" });
    setBusy(false);
    await load();
  }

  const columns: Column<Product>[] = [
    { key: "name", header: "Nama", sortable: true },
    {
      key: "price",
      header: "Harga",
      sortable: true,
      render: (p) => formatRupiah(p.price),
    },
    {
      key: "stock",
      header: "Stok",
      sortable: true,
      render: (p) => (p.stock === null ? "—" : String(p.stock)),
    },
    {
      key: "isActive",
      header: "Status",
      render: (p) =>
        p.isActive ? (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
            aktif
          </span>
        ) : (
          <span className="rounded-full bg-navy-900/5 px-2 py-0.5 text-xs font-semibold text-muted">
            nonaktif
          </span>
        ),
    },
    {
      key: "actions",
      header: "Aksi",
      render: (p) => (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openEdit(p)}
            className="rounded-full bg-navy-900/5 px-3 py-1 text-xs font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
          >
            Edit
          </button>
          <button
            onClick={() => toggleActive(p)}
            disabled={busy}
            className="rounded-full bg-navy-900/5 px-3 py-1 text-xs font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-50"
          >
            {p.isActive ? "Nonaktifkan" : "Aktifkan"}
          </button>
          <button
            onClick={() => remove(p.id)}
            disabled={busy}
            className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-600 ring-1 ring-rose-500/20 transition hover:bg-rose-500/15 disabled:opacity-50"
          >
            Hapus
          </button>
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
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama produk..."
          className={`${inputClass} flex-1 min-w-[160px]`}
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
        <button
          onClick={openAdd}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110"
        >
          + Tambah produk
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
          initial={editInitial}
          submitting={busy}
          onSubmit={submitForm}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Verifikasi type-check**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add src/components/shop/ProductManager.tsx
git commit -m "Rewrite ProductManager as a paged/filterable table with modal form"
```

---

### Task 7: Verifikasi penuh Fase 1

**Files:** none (verifikasi saja).

- [ ] **Step 1: Seluruh unit test**

Run: `npm test`
Expected: seluruh test lulus, termasuk `tests/lib/shop-products-paged.test.ts`. Kegagalan pre-existing di berkas non-terkait (mis. `orders.test.ts`) dicatat sebagai di luar ruang lingkup.

- [ ] **Step 2: Build produksi**

Run: `npm run build`
Expected: sukses tanpa error tipe.

- [ ] **Step 3: Cek manual `/produk`**

Run: `npm run dev`. Login sebagai user, buka `/produk`.
- Tabel tampil dengan pagination (footer "Menampilkan …"), header Nama/Harga/Stok bisa diklik untuk sort (indikator ▲/▼).
- Cari nama mem-filter; dropdown status & stok mem-filter; ganti filter mereset ke halaman 1.
- "+ Tambah produk" membuka popup; simpan → produk baru muncul. Edit membuka popup terisi; simpan → berubah. Nonaktifkan & Hapus bekerja.
- Tutup popup via ✕, klik overlay, dan `Esc`.

---

## Fase 1 complete when

- `npm test` hijau termasuk `shop-products-paged.test.ts`.
- `npm run build` sukses.
- `/produk` menampilkan tabel dengan pagination, sort kolom, pencarian, filter status & stok — semua server-side.
- Tambah/edit produk lewat popup; nonaktif/hapus tetap berfungsi.

**Fase berikutnya:** Fase 2 (Transaksi: `listOrdersPaged` + `/transaksi` tabel & popup `OrderForm` multi-item) — plan tersendiri setelah Fase 1 terverifikasi.
