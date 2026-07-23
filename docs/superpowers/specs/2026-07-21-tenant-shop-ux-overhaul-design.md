# Tenant Shop UX Overhaul (Design Spec)

- **Tanggal:** 2026-07-21
- **Status:** Disetujui untuk implementasi (menunggu review spec)
- **Ruang lingkup:** `nerona-web` — halaman tenant: Produk, Transaksi, Profile, Dashboard

## 1. Tujuan

Meningkatkan area pengelolaan toko milik tenant:

1. **Produk** & **Transaksi** menjadi **tabel** dengan **pagination, filter, dan sorting** (server-side).
2. **Form** tambah/edit menjadi **popup (modal)**, menggantikan form inline saat ini.
3. **Akun** (`/account`) di-rename menjadi **Profile** (`/profile`), dengan informasi pelanggan yang **bisa diubah**.
4. Menambah **Dashboard tenant** (`/dashboard`) berisi ringkasan (kartu angka, grafik penjualan, transaksi terbaru, produk terlaris & stok menipis).

## 2. Kondisi saat ini

- `/produk` → `ProductManager` (client): fetch semua produk, render kartu, form tambah/edit **inline**.
- `/transaksi` → `OrderManager` (client): fetch semua order, render kartu, form inline.
- `/account` → server component: tampil email, peran, lisensi. Tidak ada field yang bisa diubah.
- API `GET /api/shop/products` & `GET /api/shop/orders` mengembalikan **semua** baris tanpa parameter.
- Logika data di `src/lib/shop.ts` (`listProducts`, `createProduct`, `updateProduct`, `deleteProduct`, `listOrders`, `createOrder`, `updateOrderStatus`, `deleteOrder`).
- Data model:
  - `User`: `id, email, name?, image?, password?, emailVerified`.
  - `ShopProduct`: `userId, name, description?, price(Int), stock?(Int), isActive, createdAt, updatedAt`.
  - `ShopOrder`: `userId, customerName?, status, total(Int), note?, createdAt, updatedAt, items[]`.
  - `ShopOrderItem`: `orderId, productId?, productName, qty, unitPrice`.

## 3. Keputusan yang dikunci

| Keputusan | Nilai |
|-----------|-------|
| Strategi tabel | Server-side pagination + filter + sort |
| Filter Produk | Cari nama, status (aktif/nonaktif), stok menipis/habis, rentang harga |
| Filter Transaksi | Cari pelanggan, status, rentang tanggal, rentang total |
| Sort default | Produk: `createdAt desc`; Transaksi: `createdAt desc` |
| Ukuran halaman default | 20 baris |
| Form | Popup (modal) untuk tambah & edit |
| Field Profile yang bisa diubah | Nama, Nomor HP (kolom baru), Nama bisnis (kolom baru), Ganti password |
| Grafik | Recharts |
| Definisi Pendapatan | Jumlah `total` transaksi berstatus `paid` atau `done` |
| Path | Dashboard `/dashboard`, Profile `/profile` (redirect `/account` → `/profile`) |

## 4. Arsitektur & komponen bersama

Route API tetap adapter tipis; logika query & agregasi di `src/lib/shop.ts` (dan `src/lib/shop-dashboard.ts` baru) agar bisa diuji unit.

### 4.1 `DataTable` (komponen generik, client)

File: `src/components/ui/DataTable.tsx`.

- Props: `columns` (key, header, sortable?, render?), `rows`, `total`, `page`, `pageSize`, `sort`, `order`, dan callback `onPageChange`, `onSortChange`.
- Menampilkan: header (klik kolom `sortable` → toggle asc/desc), body baris (pakai `render` per kolom), footer pagination ("Menampilkan X–Y dari N", tombol Prev/Next + nomor halaman), state loading & empty.
- Tidak melakukan fetch sendiri — parent yang fetch & mengontrol state (pola controlled).

### 4.2 `Modal` (komponen generik, client)

File: `src/components/ui/Modal.tsx`.

- Props: `open`, `onClose`, `title`, `children`.
- Overlay gelap, panel tengah, tutup via tombol ✕, klik overlay, dan tombol `Esc`. Kunci scroll body saat terbuka.

## 5. Perubahan API

### 5.1 Produk — `GET /api/shop/products`

Query params (semua opsional): `page` (default 1), `pageSize` (default 20, maks 100), `q`, `sort` (`name|price|stock|createdAt`, default `createdAt`), `order` (`asc|desc`, default `desc`), `status` (`active|inactive`), `stockFilter` (`low|out` — low = `stock <= 5`, out = `stock = 0`; hanya berlaku untuk produk dengan `stock` non-null, produk stok tak-terlacak `null` dikecualikan), `priceMin`, `priceMax`.

Respons: `{ ok: true, rows: Product[], total: number, page: number, pageSize: number }`.

### 5.2 Transaksi — `GET /api/shop/orders`

Query params: `page`, `pageSize`, `q` (cari `customerName`), `sort` (`createdAt|total|status`, default `createdAt`), `order`, `status` (`new|paid|done|cancelled`), `dateFrom`, `dateTo` (ISO date; inklusif), `totalMin`, `totalMax`.

Respons: `{ ok: true, rows: Order[], total, page, pageSize }` (order menyertakan `items`).

### 5.3 Fungsi `shop.ts` baru (menggantikan `listProducts`/`listOrders`)

```ts
interface ProductQuery {
  page: number; pageSize: number; q?: string;
  sort: "name" | "price" | "stock" | "createdAt"; order: "asc" | "desc";
  status?: "active" | "inactive";
  stockFilter?: "low" | "out"; priceMin?: number; priceMax?: number;
}
listProductsPaged(userId: string, query: ProductQuery): Promise<{ rows: ShopProduct[]; total: number }>

interface OrderQuery {
  page: number; pageSize: number; q?: string;
  sort: "createdAt" | "total" | "status"; order: "asc" | "desc";
  status?: OrderStatus;
  dateFrom?: Date; dateTo?: Date; totalMin?: number; totalMax?: number;
}
listOrdersPaged(userId: string, query: OrderQuery): Promise<{ rows: (ShopOrder & { items: ShopOrderItem[] })[]; total: number }>
```

Keduanya membangun `where` scoped `userId` + filter, memakai `skip/take` + `orderBy`, dan `prisma.$transaction([findMany, count])` untuk baris + total. `LOW_STOCK_THRESHOLD = 5` diekspor untuk dipakai dashboard.

`createProduct`, `updateProduct`, `deleteProduct`, `createOrder`, `updateOrderStatus`, `deleteOrder` tetap. `listProducts`/`listOrders` lama dihapus bila tak dipakai lagi (cek pemakaian saat implementasi).

## 6. Halaman Produk (`/produk`)

`ProductManager` ditulis ulang memakai `DataTable` + `Modal`:

- Toolbar: input cari (debounce), dropdown status, dropdown stok, input rentang harga, tombol **"Tambah produk"**.
- Kolom: Nama · Harga (`Rp`) · Stok · Status (badge) · Aksi (Edit, Aktif/Nonaktif, Hapus).
- Tambah/Edit membuka `Modal` berisi `ProductForm` (name, price, stock, description). Submit → POST/PATCH → tutup modal → reload halaman aktif.
- Perubahan filter/sort/halaman → fetch ulang dengan query.

## 7. Halaman Transaksi (`/transaksi`)

`OrderManager` ditulis ulang memakai `DataTable` + `Modal`:

- Toolbar: cari pelanggan, dropdown status, rentang tanggal (2 input date), rentang total, tombol **"Catat transaksi"**.
- Kolom: Tanggal · Pelanggan · Total (`Rp`) · Status (badge) · Aksi (Detail/Ubah status, Hapus).
- **Popup buat transaksi** (`OrderForm`): input nama pelanggan (opsional), catatan, dan **daftar item** — tiap baris pilih produk (dropdown dari produk aktif) atau ketik nama manual, qty, harga satuan (terisi otomatis dari produk, bisa diubah); tombol tambah/hapus baris; total dihitung live. Submit → POST `/api/shop/orders`.
- **Popup ubah status**: dropdown status → PATCH.

## 8. Halaman Profile (`/profile`)

- Rename dari `/account`. Buat `/account` me-redirect ke `/profile` (kompatibilitas link lama).
- Schema: tambah `User.phone String?` dan `User.businessName String?`.
- Tampil: Email (read-only), Peran (read-only), dan **form editable**: Nama, Nomor HP, Nama bisnis. Tombol **Simpan** → `PATCH /api/profile`.
- **Ganti password**: bagian terpisah (hanya untuk akun yang punya `password`; akun Google disembunyikan) — input password lama + baru → `POST /api/profile/password` (verifikasi password lama dengan bcrypt, update hash baru).
- Blok lisensi & tombol verifikasi email tetap seperti sekarang.
- Modul logika: `src/lib/profile.ts` — `updateProfile(userId, { name?, phone?, businessName? })`, `changePassword(userId, currentPassword, newPassword): Promise<{ ok: boolean; reason?: "no_password" | "wrong_password" }>`.

### API Profile
- `PATCH /api/profile` `{ name?, phone?, businessName? }` → update field yang dikirim.
- `POST /api/profile/password` `{ currentPassword, newPassword }` → 200/400 dengan pesan.

## 9. Dashboard tenant (`/dashboard`)

Server component memuat data lewat `src/lib/shop-dashboard.ts`, lalu render (chart pakai komponen client Recharts).

### 9.1 Agregasi (`shop-dashboard.ts`)

```ts
getDashboardSummary(userId: string, now?: Date): Promise<{
  revenueThisMonth: number;      // sum total order paid|done, createdAt >= awal bulan
  orderCount: number;            // jumlah order bulan ini
  activeProductCount: number;    // produk isActive
  unpaidCount: number;           // order status "new"
  recentOrders: { id, customerName, total, status, createdAt }[]; // 8 terbaru
  topProducts: { productName, qtySold }[];   // 5 teratas dari ShopOrderItem (order paid|done)
  lowStock: { id, name, stock }[];           // stock <= LOW_STOCK_THRESHOLD, 5 teratas
}>
getSalesSeries(userId: string, days = 30, now?: Date): Promise<{ date: string; revenue: number }[]>
// pendapatan harian (paid|done) untuk `days` hari terakhir, mengisi 0 untuk hari tanpa transaksi
```

### 9.2 Tata letak

- Baris **kartu angka**: Pendapatan bulan ini (`Rp`), Transaksi bulan ini, Produk aktif, Belum dibayar.
- **Grafik penjualan** (`SalesChart.tsx`, client, Recharts `LineChart`/`BarChart`): sumbu-x tanggal, sumbu-y pendapatan; data dari `getSalesSeries`.
- **Transaksi terbaru**: tabel ringkas (bukan `DataTable`, cukup daftar statis) dengan tautan ke `/transaksi`.
- **Produk terlaris** & **Stok menipis**: dua kartu daftar berdampingan.

### 9.3 Dependency
Tambah `recharts` ke `package.json`. Komponen chart wajib `"use client"`. Saat implementasi grafik, ikuti skill `dataviz` untuk warna/aksesibilitas.

## 10. Navigasi

Perbarui `Header`/menu tenant: tautkan **Dashboard**, **Produk**, **Transaksi**, **Profile** (ganti label "Akun" → "Profile"). (Cek `src/components/layout/Header.tsx` saat implementasi.)

## 11. Rencana pengujian

- **`shop.ts`**: `listProductsPaged` & `listOrdersPaged` — pembentukan `where` (scope userId, tiap filter), `orderBy`, `skip/take`, dan bentuk keluaran `{ rows, total }`. Mock `prisma.$transaction`/`findMany`/`count`.
- **`shop-dashboard.ts`**: `getDashboardSummary` (definisi pendapatan paid|done, hitung per kategori) & `getSalesSeries` (pengisian hari kosong dengan 0, batas rentang).
- **`profile.ts`**: `updateProfile` (hanya field terkirim), `changePassword` (tanpa password → `no_password`, salah → `wrong_password`, benar → update hash).
- **Komponen & route**: diverifikasi manual (pola repo) — `DataTable`/`Modal`/halaman/route.
- Verifikasi akhir: `npm test`, `npm run build`, cek manual tiap halaman.

## 12. Tahapan implementasi (untuk plan)

- **Fase 1:** `DataTable` + `Modal` + API produk server-side (`listProductsPaged`) + `/produk` tabel & popup.
- **Fase 2:** API orders server-side (`listOrdersPaged`) + `/transaksi` tabel & popup (termasuk `OrderForm` multi-item).
- **Fase 3:** Schema `User.phone`/`businessName` + `/profile` (rename, edit, ganti password) + `/dashboard` (agregasi + kartu + Recharts + daftar) + navigasi.

## 13. Di luar ruang lingkup

- Ekspor CSV/PDF, cetak struk.
- Manajemen pelanggan sebagai entitas (CRM) — `customerName` tetap teks bebas.
- Multi-user/peran dalam satu toko.
- Caching lanjutan / infinite scroll (pakai pagination bernomor).
