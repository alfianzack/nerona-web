# Generate gambar di nerona-web

Tanggal: 2026-09-15. Disetujui owner lewat brainstorming pada tanggal yang sama.

## Masalahnya

Kontributor microstock membuat asetnya di alat lain, lalu membawanya ke Nerona
hanya untuk metadata. Owner ingin Nerona ikut membuat asetnya, seperti generator
yang sudah umum: satu kolom prompt, satu tombol, galeri hasil.

Tujuan yang dinyatakan owner: **dijual dulu, pemakaian bebas menyusul**. Artinya
jalur akhirnya harus sampai ke metadata dan Hub. Putaran pertama sengaja belum
ke sana.

## Tiga fakta yang membentuk desain ini

1. **Gateway yang sekarang tidak bisa membuat gambar.** SumoPod adalah LiteLLM,
   rute `/images/edits` dan `/videos/generations` ada (400 dan 405, bukan 404),
   tapi tidak satu pun model gambar terdaftar di akun ini: `gpt-image-1`,
   `dall-e-3`, `flux-pro`, `imagen-4`, `seedream-4` semuanya ditolak dengan
   "Invalid model name", dan `/v1/models` berisi 58 model chat plus 2 embedding.
   Jadi fitur ini butuh model gambar dinyalakan di akun yang sama, atau provider
   kedua.
2. **Tarif gambar bukan tarif token.** Generator menagih per gambar.
   `costForUsage` yang ada sekarang tidak bisa dipakai apa adanya.
3. **Nerona belum pernah menyimpan berkas.** Satu-satunya yang tersimpan adalah
   bukti transfer, sebagai kolom `Bytes` di Postgres (`Order.proofImage`). Tidak
   ada object storage sama sekali.

## Keputusan owner

| Pertanyaan | Jawaban |
| --- | --- |
| Untuk apa asetnya | Dijual dulu, pemakaian bebas menyusul |
| Potongan pertama | Generate, galeri, unduh. Tanpa upscale, tanpa jembatan metadata |
| Penyimpanan berkas | Tidak disimpan. Hanya tautan provider, plus thumbnail |
| Pendekatan | Provider kedua lewat endpoint OpenAI-compatible |

### Konsekuensi yang diterima sadar

Hasil putaran pertama **tidak bisa dijual di Adobe Stock maupun Shutterstock**.
Keduanya menolak berkas di bawah 4 megapiksel (`min_pixels = 4000000` di
`nerona-hub/core/src/catalog.rs`), sementara generator umumnya keluar di 1024
piksel alias 1 megapiksel. Upscale adalah syarat jalur jual, dan ia ada di
potongan berikutnya, bukan di sini.

Tautan provider berumur pendek, biasanya jam sampai hari. Gambar penuh yang
tidak sempat diunduh hilang. Yang tersisa: prompt, parameter, dan thumbnail.

## Pemecahan pekerjaan

1. **Generate gambar di nerona-web** (dokumen ini).
2. **Video**, menumpang fondasi yang sama, tapi menuntut pola kirim lalu tanya
   hasil karena waktunya menit bukan detik.
3. **Hub**, menarik hasil generate ke antrean unggah.

## Bentuk data

### `AiModel`, dua kolom baru

```prisma
kind         String  @default("chat")   // "chat" | "image"
usdPerImage  Float?                     // wajib saat kind = "image"
```

- `kind` memisahkan katalog tanpa tabel kedua, jadi panel provider, gerbang
  paket (`planFree`/`planPro`/`planBusiness`), dan tombol aktif yang sudah hidup
  langsung berlaku untuk model gambar.
- `usdPerImage` dipakai hanya saat `kind = "image"`. Poinnya
  `ceil(usdPerImage × pointsPerUsd)`, memakai `pointsPerUsd` yang sama dengan
  metadata, supaya harga tetap punya satu tuas.
- `isDefault` jadi **unik per jenis**, bukan global. Baris chat default hari ini
  tidak boleh terganggu.

### `ImageGeneration`, tabel baru

```prisma
model ImageGeneration {
  id           String   @id @default(cuid())
  userId       String
  aiModelId    String?
  prompt       String   @db.Text
  size         String
  providerUrl  String?  @db.Text
  urlExpiresAt DateTime?
  thumbnail    Bytes?
  thumbMime    String?
  points       Int      @default(0)
  status       String   @default("ok")   // ok | no_image | blocked | upstream
  createdAt    DateTime @default(now())
}
```

Prompt dan parameternya disimpan selamanya: murah, dan itu yang membuat hasil
bisa dibuat ulang. Yang fana hanya `providerUrl`.

Thumbnail sekitar 20 KB per baris, pola yang sama dengan `Order.proofImage`.
Dengan itu galeri tetap terbaca setahun kemudian: 20 MB per 1000 generate.

**Tabel ini buku besarnya sendiri. Generate gambar TIDAK ditulis ke
`ai_usage_logs`.** Tabel itu berbentuk token dan rata-ratanya memberi makan
estimasi poin per gambar metadata; menaruh generate gambar di sana akan menarik
estimasi itu ke angka yang tidak berhubungan. Kesalahan bentuk ini sudah pernah
terjadi sekali, dengan panggilan keyword yang tercatat sebagai ber-gambar.

### Migrasi

Dua kolom bernilai bawaan dan satu tabel baru, seluruhnya aditif. **`.env.local`
menunjuk Supabase produksi**, jadi berkas migrasi dibuat lebih dulu dan
diterapkan hanya atas perintah owner.

## Jalur panggilan

`POST /api/generate/image`, sesi web lewat `getServerSession(authOptions)`.
Bukan token extension: ini layar aplikasi.

Catatan yang ditemukan saat implementasi: `requireUser()` di `session-guards.ts`
TIDAK bisa dipakai di rute API. Ia memanggil `redirect()`, yang di sebuah rute
API berarti mengirim 307 ke halaman login alih-alih JSON yang bisa dibaca
layarnya. Halaman servernya tetap memakai `requireUser()`.

Urutannya:

1. Gerbang paket dan saldo diperiksa **sebelum** provider dipanggil. 402 kalau
   poin habis, 403 kalau paket tenant tidak mencakup model itu.
2. Model diambil dari baris `kind = "image"` yang `isDefault` dan `active`.
3. Panggil `/images/generations` milik provider:
   `{ model, prompt, size, n: 1 }`.
4. **Balasan tanpa URL gambar tidak menagih poin.** Ongkos ke provider tetap
   ditanggung Nerona. Ini pelajaran 2026-09-14: `gpt-5` mengembalikan string
   kosong dan poinnya tetap terpotong, dan itu tidak boleh terulang di fitur
   baru.
5. Baris `ImageGeneration` ditulis, poin dipotong lewat `spendPoints`.

Thumbnail dibuat **di browser**, bukan di server: `sharp` bukan dependensi repo
ini, dan menambah dependensi native hanya untuk memperkecil gambar itu mahal.
Sesudah gambar tampil, browser mengecilkannya lewat canvas lalu mengirimnya ke
`PATCH /api/generate/image/[id]/thumbnail`, dibatasi 64 KB dan wajib bisa
didekode. Kolomnya nullable, jadi barisnya tetap sah kalau langkah itu gagal.

### Galat dibedakan

| Kode | Artinya | Menagih poin |
| --- | --- | --- |
| `no_image` | Provider menjawab tanpa gambar | Tidak |
| `blocked` | Prompt ditolak penyaring provider | Tidak |
| `upstream` | Gagal jaringan atau 5xx | Tidak |

"Prompt kamu ditolak" dan "servernya sedang mati" menuntut tindakan berbeda dari
tenant, jadi keduanya tidak boleh digebuk jadi satu pesan.

## Layar

Rute `/studio` di grup `(app)`, satu tautan baru di sidebar.

Yang tidak dikerjakan **tidak ditampilkan**, bukan ditampilkan lalu mati
(antislop R-24 dan R-26): tidak ada tab Video, tidak ada filter Upscaled, tidak
ada Prompt Studio, tidak ada pilihan gaya.

Yang ada, dan semuanya hidup:

- Kolom prompt dengan penghitung karakter.
- Ukuran dan rasio, hanya yang didukung model terpilih, dibaca dari baris
  `AiModel` dan bukan daftar yang ditulis tangan di komponen.
- Tombol Buat yang menyebut ongkosnya dalam poin. Berbeda dengan metadata,
  harga gambar itu tarif tetap per gambar, jadi angka ini **pasti**, bukan
  perkiraan.
- Galeri: thumbnail, prompt, poin, waktu. Tautan hidup punya tombol Unduh; yang
  kedaluwarsa menampilkan keterangannya dengan tombol Buat ulang. Pencarian atas
  teks prompt.
- Keadaan kosong yang menyebut langkah pertamanya.

**Mockup interaktif disetujui owner sebelum baris pertama komponen ditulis.**

## Keadaan per 2026-09-15

Seluruh dokumen ini sudah dikerjakan: migrasi diterapkan ke produksi, metering,
endpoint dan penjaganya, panel owner (kolom jenis dan tarif per gambar),
layar `/studio`, serta thumbnail (PATCH untuk menyimpan, GET untuk menyajikan).

Dua hal yang perlu diketahui tentang thumbnail, dan keduanya disengaja:

1. **Bisa gagal tanpa suara.** Gambarnya dikecilkan di browser lewat canvas,
   dan canvas hanya bisa dibaca kalau CDN provider mengirim header CORS. Kalau
   tidak, kolomnya tetap null dan galerinya jatuh ke kotak keterangan. Tenant
   tidak diberi galat untuk sesuatu yang tidak bisa ia perbaiki.
2. **`onError` saja tidak cukup** untuk mendeteksi thumbnail yang gagal dimuat:
   gambarnya dirender di server, jadi kegagalannya bisa terjadi sebelum React
   memasang penanganannya, dan peristiwa yang sudah lewat tidak dikirim ulang.
   Komponennya memeriksa `complete && naturalWidth === 0` lewat ref.

## Uji

- Poin per gambar dari `usdPerImage × pointsPerUsd`, dipaku satu tes.
- Rute menolak tanpa menagih ketika provider menjawab tanpa gambar.
- Gerbang paket dan saldo diuji terpisah dari jalur suksesnya.
- Thumbnail menolak di atas 64 KB dan yang bukan gambar.
- Gerbang visual: mockup disetujui, lalu layar jadinya dipotret dan diukur di
  tiga lebar.

## Di luar lingkup

Video, upscale ke 4 MP, jembatan ke metadata, integrasi Hub, gaya, gambar acuan,
favorit.

**Dicatat sejak sekarang:** begitu jembatan ke metadata dibangun, deklarasi
konten AI tiap marketplace jadi bagian fitur, bukan pilihan. Adobe menuntut
penandaan Generative AI dan Canva punya aturannya sendiri. Menundanya sampai
tahap itu berarti mengunggah berkas yang bisa ditolak massal.

## Urutan kerja

1. Migrasi dan metering, bisa diuji tanpa UI.
2. Endpoint dan penjaganya.
3. Mockup untuk disetujui owner.
4. Layarnya.
