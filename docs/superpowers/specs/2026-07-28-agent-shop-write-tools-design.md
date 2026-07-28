# Agent Shop Write Tools — Tambah Produk & Catat Order lewat Chat (Design)

**Date:** 2026-07-28
**Status:** Approved (user asked to implement directly)

## 1. Tujuan

Pemilik toko bisa mengoperasikan tokonya lewat chat — WhatsApp maupun `/agent/chat`:

- `tambahkan produk nasi goreng harga 10000`
- `buatkan order pada tanggal 15 juni 2026 untuk Bu Ani 1. Nasi Goreng 2, 2. Mie Goreng 1`

Data masuk ke tabel `ShopProduct`/`ShopOrder` yang sama dengan halaman web
Produk/Transaksi/Dashboard, jadi apa pun yang dicatat lewat chat langsung terlihat di
web dan sebaliknya.

## 2. Hubungan dengan spec 22 Juli

`2026-07-22-agent-shop-tools-design.md` **disetujui tapi belum pernah dibangun** (tidak
ada `tools.ts`, `AgentProfile.lastRecapDate` belum ada, model `AgentProduct`/`AgentOrder`
masih ada, `context.ts` masih menyatakan agen tidak punya tool). Spec ini:

- **Mengambil alih** pondasinya: tool-calling loop, `record_sale`, `list_products`,
  `list_recent_orders`, `status` pada `createOrder`.
- **Menambah** yang dulu di luar cakupan: `add_product` (dulu "web-only for now") dan
  **tanggal order** (dulu tidak ada sama sekali).
- **Menunda**: `get_sales_summary`, `update_order_status`, recap harian 20:00,
  kolom `lastRecapDate`, dan penghapusan model `Agent*`. Spec 22 Juli tetap berlaku
  sebagai rujukan untuk bagian-bagian itu.

## 3. Cakupan

**Masuk:** tool loop, 4 tool (`list_products`, `add_product`, `record_sale`,
`list_recent_orders`), kolom `ShopOrder.occurredAt`, `status` pada `OrderInput`,
pembaruan system prompt, metering poin lintas putaran, pembaruan UI yang menampilkan
tanggal order.

**Tidak masuk:** recap harian, tool hapus permanen, konfirmasi sebelum simpan.

`get_sales_summary`, `update_order_status`, dan pengurangan stok otomatis semula di luar
cakupan, lalu **dimasukkan pada hari yang sama** — lihat §12.

## 4. Keputusan yang sudah diambil

1. **Simpan langsung tanpa konfirmasi**, untuk produk maupun order (lanjutan keputusan
   22 Juli). Pengamannya: agen wajib meng-echo ringkasan hasil simpan, dan nama produk
   yang sudah ada tidak diduplikasi.
2. **Tanggal order disimpan di kolom baru `occurredAt`**, bukan menimpa `createdAt`.
   `createdAt` tetap menjadi jejak "kapan dicatat".
3. Empat tool dulu; ringkasan penjualan dan recap menyusul.

## 5. Arsitektur

```
runAgentTurn (sudah ada — dipakai WhatsApp DAN /agent/chat)
  └─ runToolLoop({ systemPrompt, history, userId, timezone })
       ├─ chat completion + tools: SHOP_TOOLS
       ├─ ada tool_calls? → executeTool(ctx, name, argsJson) → append role:"tool" → ulangi
       │                      └─ src/lib/shop.ts
       ├─ maksimum 5 putaran
       └─ putaran habis → satu panggilan terakhir TANPA tools
```

Karena `runAgentTurn` sudah dipakai bersama kedua channel, tidak ada kode per-channel.

### `src/lib/agent/tools.ts` (baru)

```ts
export const SHOP_TOOLS: ToolDefinition[]          // format function-calling OpenAI
export interface ToolContext { userId: string; timezone: string }
export async function executeTool(
  ctx: ToolContext, name: string, argsJson: string
): Promise<string>                                 // selalu JSON string, tidak pernah throw
```

`userId` **selalu** dari `ToolContext` (diturunkan dari `AgentProfile`), tidak pernah
dari output model — agen tidak bisa menyentuh data tenant lain.

### `src/lib/agent/tool-loop.ts` (baru)

```ts
export async function runToolLoop(params: {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  userId: string;
  timezone: string;
}): Promise<{ text: string; model: string; usage: TokenUsage | null; pricing: AiPricing; rounds: number }>
```

Modul terpisah dari `claude-client.ts`: `claude-client` tetap transport HTTP, loop ini
orkestrasi. `usage` adalah **jumlah seluruh putaran** (lihat §9).

## 6. Tool

| Tool | Argumen | Backing |
|---|---|---|
| `list_products` | `q?`, `limit?` (default 20, maks 50) | `listProductsPaged` |
| `add_product` | `name`, `price`, `stock?`, `description?` | `createProduct` / `updateProduct` |
| `record_sale` | `items[{product_name, qty, unit_price?}]`, `customer_name?`, `date?`, `note?`, `status?` (default `paid`) | `createOrder` |
| `list_recent_orders` | `limit?` (default 5, maks 20), `status?` | `listOrdersPaged` |

### `add_product`

Nama dicocokkan **persis tapi case-insensitive** terhadap produk milik pemilik
(termasuk yang `isActive: false`).

- Sudah ada → `updateProduct` harganya (dan `stock`/`description` bila dikirim),
  hasil `{ ok: true, action: "updated", product }`. Nama tidak diduplikasi.
- Belum ada → `createProduct`, hasil `{ ok: true, action: "created", product }`.

Validasi: `name` tidak kosong setelah trim (maks 120 karakter), `price` bilangan bulat
`>= 0`, `stock` bilangan bulat `>= 0` bila dikirim (tidak dikirim = `null` = stok tidak
dilacak).

### `record_sale`

Pencocokan produk: **contains, case-insensitive**, hanya produk `isActive`.

- Tepat satu → `productId` terisi, `unit_price` default harga produk.
- Lebih dari satu → `{ ok: false, error, candidates: [{name, price}] }` supaya model
  bertanya mana yang dimaksud. Tidak ada yang disimpan.
- Tidak ada → boleh sebagai item bebas (`productId: null`) **hanya bila `unit_price`
  dikirim**; kalau tidak → `{ ok: false, error }` meminta harga.

Validasi: minimal satu item; `qty` bilangan bulat `>= 1`; `unit_price` bilangan bulat
`>= 0`; `status` harus salah satu `new|paid|done|cancelled`.

### Tanggal pada `record_sale`

Model mengirim `date` dalam format `YYYY-MM-DD` (model yang mengubah "15 juni 2026" /
"kemarin"; baris `Sekarang: …` di system prompt sudah memberi acuan hari ini).

Server yang mengurus zona waktu: tanggal disimpan pada **jam 12:00 waktu lokal profil**
lalu dikonversi ke UTC, sehingga tidak bergeser hari ketika ditampilkan kembali.
Perhitungan offset memakai `Intl.DateTimeFormat` dengan `timeZone` profil — tidak
menambah dependensi.

`date` tidak dikirim → `occurredAt` = sekarang.

Format bukan `YYYY-MM-DD`, tanggal tidak valid (mis. `2026-02-31`), atau selisihnya
**lebih dari 1 tahun** dari hari ini (ke depan maupun ke belakang) → `{ ok: false,
error }`. Selisih sebesar itu hampir pasti salah parse, bukan kehendak pemilik.

## 7. Perubahan schema

```prisma
model ShopOrder {
  ...
  occurredAt DateTime @default(now())   // tanggal transaksi menurut pemilik
  createdAt  DateTime @default(now())   // jejak: kapan baris ini dicatat
}
```

Kolom **non-null**, dan migrasinya mengisi ulang baris lama:

```sql
ALTER TABLE "shop_orders" ADD COLUMN "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "shop_orders" SET "occurredAt" = "createdAt";
CREATE INDEX "shop_orders_userId_occurredAt_idx" ON "shop_orders"("userId", "occurredAt");
```

Non-null + backfill artinya **tidak ada satu pun cabang `null`** di query mana pun —
itu yang menekan risiko utama pilihan kolom baru ini.

Migrasi ditulis manual ke `prisma/migrations/20260728000000_add_shop_order_occurred_at/`
dan **tidak dijalankan otomatis**: `.env.local` menunjuk ke Supabase produksi, jadi
penerapannya keputusan pemilik (`npm run db:migrate`).

### Semua pembacaan yang pindah ke `occurredAt`

Inventaris lengkap (bukan perkiraan):

- `src/lib/shop.ts` — `orderBy` daftar order (:131), kunci sort `OrderQuery` (:179),
  filter `dateFrom`/`dateTo` (:198)
- `src/lib/shop-dashboard.ts` — omzet bulan ini (:20), jumlah order (:22), order
  terbaru (:27,:29), bucket grafik (:60,:61,:70)
- `src/components/shop/OrderManager.tsx` — tipe (:26), state sort (:54), kolom
  tabel (:173-177), detail (:310)
- `src/app/api/shop/orders/route.ts` — kunci sort yang diterima (:35-39)
- Test: `tests/lib/shop-dashboard.test.ts`, `tests/lib/shop-orders-paged.test.ts`

Koreksi saat implementasi: `src/app/dashboard/page.tsx:82` yang sebelumnya tercatat di
sini sebagai "tampilan tanggal order" ternyata riwayat **poin** (`PointTransactionView`),
bukan order — ditangkap `tsc`. Daftar "order terbaru" di dashboard tidak menampilkan
tanggal sama sekali, jadi tidak ada perubahan UI di sana.

Kunci sort di API/URL berubah dari `createdAt` menjadi `occurredAt`; nilai lama yang
masih tersimpan di URL pengguna jatuh ke default sort, bukan error.

Detail order di web menampilkan keduanya: tanggal transaksi (`occurredAt`) sebagai
informasi utama, "dicatat pada" (`createdAt`) sebagai baris sekunder.

### `shop.ts` — `OrderInput`

Bertambah dua field opsional: `status?: OrderStatus` (divalidasi, default tetap
`"new"`) dan `occurredAt?: Date` (default `now()`). Pemanggil dari web tidak terpengaruh.

## 8. System prompt

Baris `context.ts:41` ("Anda belum memiliki alat…") diganti panduan tool: gunakan tool
dan jangan mengarang data; simpan langsung tanpa minta konfirmasi; setelah menyimpan
wajib mengulang ringkasan (item, qty, total dalam Rupiah, tanggal, nama pelanggan);
kalau nama produk ambigu, tanyakan dulu sebelum mencatat.

## 9. Metering poin

Satu turn kini bisa berisi 2–6 panggilan AI. `usage` dijumlahkan lintas putaran dan
**dipotong sekali** di akhir turn oleh `turn.ts` (memakai `costForUsage` + tarif dari
`getAiSettings`, tidak berubah). Konsekuensi yang diterima: mencatat penjualan lebih
mahal daripada obrolan biasa karena definisi tool ikut terkirim setiap putaran.

Gate saldo tetap satu kali di awal turn, jadi satu turn bisa membuat saldo minus
sedikit — perilaku yang sama seperti sekarang.

## 10. Error handling

- `executeTool` tidak pernah throw: setiap kegagalan menjadi `{ ok: false, error }`
  sebagai hasil tool, sehingga model bisa memulihkan diri secara percakapan.
- JSON argumen rusak → hasil error. Nama tool tidak dikenal → hasil error.
- Error database di dalam tool → ditangkap, jadi hasil error.
- Putaran habis (5) → satu panggilan terakhir tanpa tools supaya pemilik selalu
  dapat balasan.
- Kegagalan total job (retry + pesan maaf) tidak berubah.

## 11. Testing (TDD, Vitest)

- `tests/lib/agent/tools.test.ts` — tiap tool: happy path, validasi, pencocokan produk
  (satu/banyak/nol), scoping `userId`, JSON argumen rusak, nama tool tak dikenal;
  `add_product` duplikat → update; parsing tanggal termasuk zona waktu, tanggal tidak
  valid, dan batas 1 tahun.
- `tests/lib/agent/tool-loop.test.ts` — `fetch` dimock: satu putaran tool → teks final;
  `usage` dijumlahkan lintas putaran; budget habis → panggilan terakhir tanpa `tools`.
- `tests/lib/agent/turn.test.ts` — turn memotong poin dari usage gabungan.
- `tests/lib/shop-*.test.ts` — `createOrder` menghormati `status` dan `occurredAt`,
  default `"new"` + `now()`; query laporan memakai `occurredAt`.
- Komponen/route seperti konvensi repo: `tsc` + `npm run build` + pemeriksaan manual
  (repo ini tidak punya harness test React).

---

## 12. Perluasan cakupan (disetujui 2026-07-28, sesi lanjutan)

Tiga hal yang tadinya ditunda dimasukkan atas permintaan pemilik. Yang **tetap** di luar
cakupan: recap harian dan tool hapus permanen.

### 12.1 Pengurangan stok di `createOrder`

Dipasang di `src/lib/shop.ts`, **bukan** di tool agen, supaya mencatat lewat chat dan
lewat `/transaksi` memberi hasil yang sama. Kalau hanya agen yang mengurangi stok, angka
stok bergantung pada lewat mana transaksi dicatat — sumber kebingungan yang sulit
dilacak.

Semua dalam satu `prisma.$transaction`: buat order, lalu kurangi stok setiap item.

- Hanya item dengan `productId` (produk terdaftar) **dan** `stock !== null`. Item bebas
  dan produk yang stoknya tidak dilacak dilewati.
- Stok berhenti di **0**, tidak pernah minus.
- Penjualan **tidak pernah gagal** karena stok kurang — data stok warung sering basi, dan
  transaksi yang sudah terjadi lebih penting daripada akurasi stok.

`createOrder` mengembalikan objek order seperti sebelumnya **ditambah**
`stockWarnings: { productName, requested, available }[]`, hanya berisi item yang stoknya
tidak cukup. Bentuk lama tetap utuh sehingga `/api/shop/orders` hanya mendapat satu key
tambahan yang tidak dipakai UI. Agen memakainya untuk memperingatkan pemilik.

**Perubahan perilaku di luar agen:** halaman `/transaksi` yang tadinya tidak menyentuh
stok kini mengurangi stok. Ini konsekuensi yang diterima, bukan efek samping.

**Stok TIDAK dikembalikan** saat order dibatalkan atau dihapus (keputusan eksplisit:
opsi dengan pemulihan stok ditolak karena rumit — status lama→baru harus dilacak agar
tidak dikurangi/dikembalikan dua kali). Koreksi stok setelah pembatalan dilakukan manual
di `/produk`.

### 12.2 `get_sales_summary`

Fungsi baru `getSalesSummaryForRange(userId, { from, to })` di `shop-dashboard.ts` —
diletakkan di sana, bukan di `tools.ts`, supaya bisa diuji sendiri dan dipakai ulang oleh
recap harian nanti. Mengembalikan omzet (`paid` + `done`), jumlah transaksi, dan produk
terlaris pada rentang itu, semuanya difilter `occurredAt`.

Tool `get_sales_summary` menerima `period`: `today` | `week` | `month`, dihitung dalam
**zona waktu profil** memakai helper zona waktu di `tools.ts` yang dinaikkan menjadi
`zonedTime(dateStr, hour, timeZone)`:

- `today` = sejak tengah malam lokal sampai sekarang
- `week` = 7 hari lokal terakhir termasuk hari ini
- `month` = sejak tanggal 1 bulan ini (lokal)

Aritmetika "7 hari" memakai selisih 24 jam dari awal hari lokal. Untuk zona tanpa DST
(termasuk `Asia/Jakarta`) ini tepat; di zona dengan DST batasnya bisa bergeser satu jam.
Diterima — ini ringkasan penjualan, bukan pembukuan pajak.

### 12.3 `update_order_status`

Argumen `order_id` + `status`. Menumpang `updateOrderStatus` yang sudah ada; fungsi itu
sudah men-scope `userId` dan mengembalikan `null` kalau order bukan milik pemilik →
menjadi `{ ok: false, error }`.

Alur "ubah order tadi jadi lunas": model memanggil `list_recent_orders` untuk mendapat
id, lalu `update_order_status`. Anggaran 5 putaran cukup.

**"Hapus order itu" dilayani sebagai pembatalan** (`status: cancelled`), bukan hapus
permanen. Alasannya: agen menyimpan langsung tanpa konfirmasi, jadi tool hapus permanen
berarti satu salah baca model bisa menghilangkan transaksi tanpa bisa dibatalkan. Hapus
permanen tetap lewat `/transaksi`.

### 12.4 Prompt dan jumlah tool

`SHOP_TOOLS` menjadi **6**. Dua baris panduan ditambahkan: pakai `get_sales_summary`
untuk pertanyaan omzet (jangan menjumlahkan sendiri dari daftar order), dan "hapus"
berarti membatalkan — bukan menghapus permanen.

Konsekuensi poin: definisi 6 tool terkirim setiap putaran, jadi satu turn agak lebih
mahal daripada 4 tool.

### 12.5 Testing tambahan

- `tests/lib/shop-create-order.test.ts` — stok berkurang untuk produk terdaftar, produk
  `stock: null` tidak disentuh, item bebas dilewati, clamp di 0 dengan `stockWarnings`
  terisi, dan semuanya terjadi dalam satu transaksi.
- `tests/lib/shop-dashboard.test.ts` — `getSalesSummaryForRange`: omzet hanya dari
  `paid`+`done`, jumlah transaksi, produk terlaris.
- `tests/lib/agent/tools.test.ts` — batas periode `today`/`week`/`month` di
  `Asia/Jakarta`; `update_order_status` untuk kasus sukses, bukan milik pemilik, dan
  status tidak valid; daftar tool menjadi 6.
