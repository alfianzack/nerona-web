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

**Tidak masuk:** `get_sales_summary`, `update_order_status`, recap harian, pengurangan
stok otomatis saat penjualan, tool hapus/undo, konfirmasi sebelum simpan.

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
