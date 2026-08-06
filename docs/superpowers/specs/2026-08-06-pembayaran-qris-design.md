# Pembayaran QRIS lewat SumoPod Managed Payment — Desain

Tanggal: 2026-08-06
Status: disetujui owner, langsung diimplementasikan
Repo: `nerona-web`
Mode awal: **sandbox**

## 1. Ringkasan

Pelanggan membayar paket Metadata dan top-up poin lewat **QRIS**, dan paketnya
aktif sendiri begitu pembayaran masuk — tanpa mengunggah bukti transfer dan
tanpa menunggu admin. Transfer manual **tetap ada** sebagai pilihan kedua.

Integrasinya kecil karena aktivasi sudah berada di balik satu fungsi:
`fulfillOrderRequest` (`src/lib/orders.ts:321`). Webhook memanggil fungsi yang
sama persis dengan yang dipanggil tombol konfirmasi admin. Tidak ada jalur
aktivasi kedua yang harus dijaga ikut benar.

## 2. Keputusan owner (2026-08-06)

1. **Cakupan: paket Metadata + top-up poin.** Keduanya pembelian sekali bayar
   dengan alur order yang identik. Perpanjangan otomatis tidak termasuk —
   tagihannya dibuat cron, bukan diklik pengguna, jadi ia butuh pengiriman
   tautan bayar yang tidak dipakai dua alur lainnya.
2. **Transfer manual tetap jadi pilihan kedua**, tidak dihapus.
3. **Biaya ditanggung Nerona.** Pelanggan membayar harga yang tertulis; Rp
   29.000 masuk sebagai Rp 28.497 (0,7% + Rp 300 = Rp 503).
4. **Sandbox dulu**, sebelum live.

## 3. Kontrak SumoPod yang dipakai

**Buat pembayaran** — `POST {base}/api/v1/payments`, header `X-Api-Key`:

```json
{ "order_id": "…", "amount": 50000, "currency": "IDR",
  "expires_in_hours": 24, "payment_method_type_code": "QRIS",
  "success_return_url": "…", "cancel_return_url": "…" }
```

Balasan: `payment_id`, `order_id`, `amount`, `fee`, `net_amount`,
`payment_link_url`, `payment_code`, `payment_channel_used`, `status`,
`expires_at`.

**Webhook**: `payment.completed` | `payment.failed` | `payment.expired` |
`payment.test`, dengan `data` berisi `payment_id`, `order_id`, `amount`, `fee`,
`net_amount`, `status`, `payment_method`, `completed_at`. **Wajib dibalas 2xx
dalam 10 detik**, kalau tidak ditandai gagal dan bisa dikirim ulang dari
dashboard.

**QRIS**: biaya 0,7% + Rp 300, settle 2 hari.

### Yang TIDAK ada di kontraknya, dan akibatnya

**Tidak ada endpoint untuk menanyakan status sebuah pembayaran.** Kita hanya
tahu hasil sebuah pembayaran kalau webhook-nya sampai. Itu satu-satunya alasan
terkuat mengapa **tombol konfirmasi manual admin tidak boleh dihapus**: kalau
webhook hilang dan tidak ada yang mengirim ulang, satu-satunya cara pelanggan
mendapatkan paketnya adalah admin membuka tab Payments di dashboard SumoPod,
melihat pembayarannya masuk, lalu menekan tombol yang sudah ada hari ini.

## 4. Verifikasi tanda tangan

Skema Svix: header `svix-id`, `svix-timestamp`, `svix-signature`. Rahasianya
`whsec_…`; buang awalan itu, decode base64 → kunci HMAC. Konten yang
ditandatangani `${svix-id}.${svix-timestamp}.${raw body}`, HMAC-SHA256 →
base64. `svix-signature` bisa berisi beberapa nilai `v1,<sig>` dipisah spasi
(saat rahasia dirotasi, ±24 jam) — cocok dengan salah satunya berarti sah.

**Dipilih daripada `X-Webhook-Token` yang jauh lebih sederhana**, karena token
itu string tetap yang sama di setiap permintaan: sekali bocor (log, proxy,
riwayat browser), siapa pun bisa mengulang permintaan palsu selamanya, dan
tidak ada apa pun di permintaan itu yang bisa kita tolak. Skema Svix membawa
timestamp, jadi permintaan lama bisa ditolak.

Dua hal yang gampang salah dan keduanya membuat verifikasi **selalu gagal atau,
lebih buruk, selalu lolos**:

- **Badan mentah, bukan hasil parse.** Satu spasi berbeda dari
  `JSON.stringify(JSON.parse(body))` sudah mengubah HMAC-nya. Rute Next
  membaca `await request.text()` dan baru mem-parse setelah tanda tangannya
  cocok.
- **Bandingkan dengan `timingSafeEqual`**, bukan `===`.

Selain tanda tangan, **timestamp yang lebih tua dari 5 menit ditolak**. Tanpa
itu, satu permintaan sah yang pernah terekam bisa diputar ulang kapan saja —
dan tanda tangannya akan tetap cocok selamanya.

## 5. Model `Payment`

Tabel sendiri, bukan kolom tambahan di `OrderRequest`, karena **satu order bisa
punya beberapa upaya bayar**: tautan QRIS kedaluwarsa dalam ≤24 jam, dan
pelanggan yang kembali besok butuh tautan baru sementara riwayat upaya
sebelumnya tetap perlu terbaca saat merekonsiliasi.

```prisma
model Payment {
  id                String   @id @default(cuid())
  orderId           String
  order             OrderRequest @relation(fields: [orderId], references: [id], onDelete: Cascade)
  provider          String   @default("sumopod")
  providerPaymentId String?  @unique   // payment_id dari balasan
  reference         String   @unique   // `order_id` yang KITA kirim
  amount            Int
  fee               Int?
  netAmount         Int?
  status            String   @default("pending") // pending|completed|failed|expired
  linkUrl           String
  expiresAt         DateTime
  completedAt       DateTime?
  createdAt         DateTime @default(now())

  @@index([orderId])
  @@map("payments")
}
```

**`reference` bukan `orderId` apa adanya.** SumoPod memakai `order_id` sebagai
kunci unik di sisi mereka, jadi upaya kedua atas order yang sama akan ditolak
atau — lebih buruk — menimpa yang pertama. Formatnya `{orderId}-{urutan}`, dan
webhook mencari balik lewat kolom `reference` yang unik, bukan dengan memotong
teksnya.

**`amount` dibekukan saat pembayaran dibuat.** Harga paket dibaca dari DB dan
owner bisa mengubahnya kapan saja; tanpa membekukannya, pembayaran yang dibuat
kemarin akan dicocokkan dengan harga hari ini.

## 6. Idempotensi

Webhook dikirim ulang — itu bagian dari desain SumoPod, bukan kegagalan. Ada
dua penjaga, dan yang kedua sudah ada sejak sebelum pekerjaan ini:

1. **`Payment.status`** — kalau sudah `completed`, webhook kedua tidak
   melakukan apa-apa dan tetap dibalas **200**. Membalas galat justru membuat
   SumoPod mengirim ulang lagi, selamanya.
2. **`fulfillOrderRequest` menolak order yang statusnya bukan `pending`**
   (`orders.ts:333`). Jadi dua webhook yang tiba bersamaan tidak bisa
   mengaktifkan paket dua kali atau mengkredit poin dua kali.

Urutannya penting: **penuhi dulu, tandai `completed` sesudahnya.** Kalau
dibalik, kegagalan di tengah meninggalkan pembayaran yang tercatat lunas
sementara paketnya tidak pernah aktif — dan penjaga nomor 1 akan membuat setiap
kiriman ulang berikutnya diam saja.

**Jumlah yang dibayar dicocokkan dengan `Payment.amount`.** Tanda tangannya
sudah membuktikan pesan itu dari SumoPod, jadi ini bukan penjaga terhadap
pemalsuan — ia penjaga terhadap kesalahan pemetaan di sisi kita sendiri, yang
akibatnya paket Business aktif atas pembayaran Rp 1.000.

## 7. Aktor boleh `null`

`fulfillOrderRequest(adminId, orderId)` menuntut id admin, dan pembayaran
gateway tidak punya admin. Kolomnya (`OrderRequest.fulfilledById`,
`License.grantedById`, `PointLedger.createdById`) **sudah nullable di skema**,
jadi tanda tangannya dilonggarkan jadi `string | null` sampai ke
`grantLicense` dan `creditTopupPoints`.

`null` di sana berarti satu hal yang tepat: **tidak ada manusia yang
melakukannya.** Alternatifnya — memakai id pelanggan sendiri sebagai aktor —
akan menulis jejak audit yang berbohong ("pengguna ini memberi lisensi kepada
dirinya sendiri"), dan jejak audit yang berbohong lebih buruk daripada jejak
yang kosong.

## 8. Konfigurasi

| Nama | Tempat | Isi |
|---|---|---|
| `SUMOPOD_PAY_API_BASE` | env | `https://api-pay-sandbox.sumopod.com` |
| `SUMOPOD_PAY_API_KEY` | env | kunci proyek Managed Payment |
| `SUMOPOD_PAY_WEBHOOK_SECRET` | env | `whsec_…` |
| `payment_gateway_enabled` | `Setting` | `"1"` menyalakan tombol QRIS |

**Awalan `SUMOPOD_PAY_`, bukan `SUMOPOD_`.** `SUMOPOD_API_KEY` dan
`SUMOPOD_BASE_URL` **sudah dipakai** layanan AI SumoPod (`ai-settings.ts:65`,
`agent/claude-client.ts:3`) — dua produk berbeda dari vendor yang sama, dengan
kunci yang berbeda. Memakai nama yang sama berarti kunci AI terkirim ke endpoint
pembayaran, dan gagalnya berupa 401 yang menyesatkan.

Kunci di env, bukan `Setting`: ia rahasia, dan `Setting` terbaca dari panel
admin. Saklar nyala/mati di `Setting` supaya **owner bisa mematikan QRIS dalam
satu klik tanpa deploy** kalau gateway-nya bermasalah — semua pelanggan
langsung jatuh ke transfer manual yang tetap ada. Sandbox vs live ditentukan
pasangan base URL + kunci, jadi keduanya berpindah bersama.

## 9. Halaman order

Dua pilihan berdampingan, QRIS lebih dulu:

- **Bayar dengan QRIS** → membuat pembayaran, membuka `payment_link_url`.
  Kalau sudah ada pembayaran `pending` yang belum kedaluwarsa, tombolnya
  membuka tautan yang **sama**, bukan membuat yang baru.
- **Transfer manual** → detail rekening + unggah bukti, persis seperti
  sekarang.

Saat pembayaran `pending`, halaman menyebut kapan tautannya kedaluwarsa. Saat
`completed`, kartu ordernya sudah berstatus `fulfilled` lewat jalur biasa.

Halaman ini **tidak melakukan polling**. Tidak ada endpoint status untuk
di-poll, dan menebak dengan memuat ulang berkala hanya akan menampilkan
"pending" lebih lama tanpa satu pun informasi baru.

## 10. Pengujian

Tes berjalan di `environment: "node"`, tidak ada harness render komponen.

- **Verifikasi tanda tangan** — vektor yang dihitung sendiri: sah; badan
  diubah satu karakter; timestamp 6 menit lalu; beberapa tanda tangan dipisah
  spasi (rotasi rahasia) yang salah satunya cocok; header hilang; rahasia
  tanpa awalan `whsec_`.
- **Idempotensi** — `payment.completed` kedua tidak memanggil
  `fulfillOrderRequest` lagi dan tetap 200.
- **Ketidakcocokan jumlah** ditolak dan pembayaran TIDAK ditandai lunas.
- **Aktor `null`** sampai ke `grantLicense`/`creditTopupPoints`.
- **`reference` berurutan** untuk upaya kedua atas order yang sama.
- **Rute buat-pembayaran**: 401 tanpa sesi, 404 untuk order milik orang lain,
  menolak order yang bukan `pending`, menolak saat saklar mati.
- **`payment.test`** dibalas 200 tanpa menyentuh order apa pun.

Yang **tidak** bisa dibuktikan tes: bahwa SumoPod benar-benar memanggil webhook
kita, bahwa QRIS-nya bisa dipindai, dan bahwa uangnya sampai. Itu uji sandbox
oleh owner.

## 11. Di luar lingkup

Perpanjangan otomatis; paket Agent (disembunyikan `AGENT_ENABLED`); metode
selain QRIS; penarikan saldo; rekonsiliasi otomatis (tidak mungkin tanpa
endpoint status).

## 12. Risiko terbuka

1. **Webhook hilang = pelanggan membayar tanpa paket aktif.** Tidak ada
   endpoint status untuk menutupnya. Penawarnya: kirim ulang manual dari
   dashboard SumoPod, atau tombol konfirmasi admin.
2. **Fitur ini baru** di sisi SumoPod dan sebagian (multi-merchant) masih
   dikembangkan. Bentuk payload bisa berubah tanpa kabar.
3. **Dana mengendap di dompet SumoPod** sampai ditarik, settle 2 hari.
4. **Batas laju `/api/payments/create`** memakai pembatas dalam-memori yang
   tidak dibagi antar instance serverless (`src/lib/rate-limit.ts`) — sama
   seperti seluruh repo ini, tapi di sini yang dibanjiri adalah tabel milik
   pihak ketiga.
