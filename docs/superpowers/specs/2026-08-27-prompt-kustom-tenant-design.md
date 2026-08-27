# Prompt kustom milik tenant

Tanggal: 2026-08-27

## Masalah

Prompt metadata Nerona satu untuk semua orang. Kontributor yang bekerja di
niche sempit — pernikahan Indonesia, vektor flat, foto makanan — ingin gaya
judul dan keyword yang berbeda, dan hari ini tidak ada jalan ke sana selain
menyunting hasilnya satu per satu.

Sekaligus, prompt Nerona adalah aset inti produk. Membuka jalan bagi tenant
untuk memakai prompt sendiri tidak boleh berarti membuka isi prompt Nerona.

## Yang dibangun

Tenant bisa menyimpan beberapa **preset prompt bernama** untuk fitur metadata,
dan menandai satu sebagai aktif. Saat ada preset aktif, badan prompt itulah yang
dipakai — bukan prompt Nerona. Saat tidak ada, semuanya berjalan persis seperti
hari ini.

Prompt Nerona sendiri pindah dari konstanta di kode ke `Setting` (dengan
konstanta itu sebagai bawaan), sehingga owner bisa menyuntingnya dari panel
admin tanpa deploy.

### Batas tegas

- **Fitur metadata saja.** Scoring, commercial intent, riset keyword, dan reject
  analyzer tetap milik Nerona sepenuhnya dan tidak berubah.
- **Prompt Nerona tidak pernah terlihat oleh tenant.** Tidak ada tombol salin,
  tidak ada pratinjau, tidak ada teks bawaan yang terisi di editor. Editor
  kustom mulai kosong.
- **Ekor kontrak selalu ditempel server pada prompt kustom.** Apa pun yang
  ditulis tenant, server menambahkan blok aturan format keluaran di akhir.
  Tenant tidak bisa menghapusnya dan tidak melihat bunyinya. Jalur bawaan Nerona
  tidak memakai ekor ini — kontrak JSON sudah ada di dalam badan prompt-nya, dan
  menempelkannya lagi akan mengubah prompt yang hari ini bekerja.

## Kenapa ekor terkunci

Dua alasan, dua-duanya cukup sendirian.

Pertama, keluaran. Extension dan Hub mem-parse JSON dengan bentuk tertentu.
Prompt tenant yang tidak menyebut kontrak itu menghasilkan teks yang gagal
di-parse — dan poin sudah terbakar sebelum kegagalan itu ketahuan. Ekor menjaga
keluaran tetap terbaca walau prompt tenant seadanya.

Kedua, penyalahgunaan. Tanpa ekor, `/api/extension/generate` berubah jadi proxy
LLM serbaguna: siapa pun bisa menulis prompt apa saja dan memakai kunci API
Nerona untuk pekerjaan yang bukan metadata. Ekor memaksa setiap panggilan tetap
menghasilkan metadata gambar. Metering poin membatasi ongkosnya; ekor membatasi
kegunaannya.

## Model data

### Tabel baru `PromptPreset`

```prisma
model PromptPreset {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  body      String   @db.Text
  isActive  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@map("prompt_presets")
}
```

Tidak ada kolom `feature`. Fitur lain belum boleh punya prompt kustom, dan
menambah kolom nanti lebih murah daripada memelihara dimensi yang tidak dipakai
siapa pun hari ini.

Tepat satu preset aktif per user, dijaga di lapisan aplikasi di dalam transaksi:
mengaktifkan satu preset mematikan yang lain milik user yang sama. Bukan unique
index parsial, karena Prisma tidak bisa mendeklarasikannya tanpa SQL mentah dan
keadaan "tidak ada yang aktif" juga sah.

Batas: **20 preset per user**, nama maks **60 karakter**, badan maks **6.000
karakter**. Batas badan bukan soal ruang penyimpanan — badan prompt ikut
terkirim setiap panggilan, jadi ia biaya berulang dalam token.

### Yang sengaja TIDAK ditambahkan

`MetadataLog.promptPresetId` sempat dipertimbangkan untuk keperluan dukungan
("hasil saya jelek" — preset mana?). Dibatalkan: `MetadataLog` ditulis lewat
`/api/extension/metadata-log`, endpoint terpisah yang dipanggil klien setelah
metadata final terbentuk. Klien tidak tahu preset apa yang dipakai server, jadi
kolom itu menuntut klien mengirim data yang tidak dimilikinya.

### Kunci `Setting` baru

| kunci | isi |
|---|---|
| `prompt_metadata_advanced` | badan prompt metadata Nerona |
| `prompt_metadata_contract` | ekor kontrak yang ditempel di akhir prompt kustom |

Resolusi mengikuti pola tarif poin: **DB → konstanta kode**. Tidak ada lapisan
env di tengah — prompt bukan rahasia lingkungan dan tidak ada gunanya berbeda
antar-deploy.

Mode `quick` tidak dipindahkan ke `Setting`. Tombolnya sudah dicabut dari
extension (`installMarketplaceGenerateButtons` hanya memasang tombol
`advanced`), jadi mode itu hanya bisa dicapai lewat panggilan API langsung.
Membawanya ke panel admin berarti menyuruh owner memelihara sesuatu yang tidak
ada penggunanya.

## Resolusi prompt

Modul baru `src/lib/extension/prompt-resolver.ts`:

```
resolveMetadataPrompt({ userId, marketplace, promptMode, batchIndex })
  1. preset aktif milik userId?
       ya    → body = preset.body,  tail = Setting.contract ?? KONSTANTA
       tidak → body = Setting.advanced ?? KONSTANTA,  tail = null
  2. buildMetadataPrompt({ body, tail, marketplace, promptMode, batchIndex })
```

`buildMetadataPrompt` tetap murni dan sinkron; ia hanya menerima dua argumen
opsional baru (`body`, `tail`). Tanpa keduanya hasilnya identik byte-for-byte
dengan hari ini, sehingga `tests/lib/extension-prompts.test.ts` tidak perlu
disentuh sama sekali.

Bentuk prompt akhir untuk preset kustom:

```
<preset.body>

<tail>
Context marketplace: <marketplace>.<hint vecteezy/miricanvas><hint batch>
```

Hint marketplace dan hint batch tetap bagian dari perakitan server, bukan
tanggung jawab tenant — keduanya menutup aturan spesifik situs yang tenant tidak
bisa diharapkan menghafalnya.

`maxTokens` memakai cap `advanced` saat preset aktif dipakai. Prompt tenant tidak
punya cap sendiri untuk ditebak, dan cap advanced adalah yang paling longgar di
antara dua mode.

Hanya `feature === "metadata"` yang lewat resolver. Empat fitur lain di
`buildPromptFor` tidak berubah.

### Dampak ke klien

Nol. Extension dan Nerona Hub sama-sama memanggil
`POST /api/extension/generate`, dan server sudah tahu `userId` dari token. Tidak
ada rilis extension dan tidak ada rilis Hub yang diperlukan.

## Antarmuka tenant

Halaman baru `/prompt`, masuk grup nav **Metadata** di `src/lib/nav.ts`, di atas
"Riwayat".

**Keadaan bawaan — "Pakai prompt Nerona".** Tidak ada teks prompt yang
ditampilkan. Hanya keterangan singkat tentang apa yang dikerjakannya: menghasilkan
judul, deskripsi, dan 50 keyword berorientasi pembeli.

**Keadaan kustom — "Pakai prompt saya".** Daftar preset dengan penanda mana yang
aktif, plus editor. Editor mulai kosong, dengan *placeholder* berisi contoh
pendek yang kita tulis sendiri — contoh mainan, bukan potongan prompt Nerona:

> Kamu penulis metadata microstock. Fokus niche wedding Indonesia. Judul
> deskriptif, hindari kata korporat…

Di bawah editor, satu kalimat tentang ekor:

> Nerona otomatis menambahkan aturan format keluaran dan konteks marketplace di
> akhir prompt Anda. Tidak perlu Anda tulis, dan tidak bisa dihapus.

Bunyinya tidak ditampilkan. Tenant cukup tahu ia ada dan tidak perlu diurus.

Kembali ke prompt Nerona selalu satu klik — menonaktifkan preset aktif, tanpa
menghapus apa pun.

### Konsekuensi yang diterima

Menulis prompt dari nol lebih sulit daripada menyunting salinan, jadi sebagian
tenant akan menghasilkan prompt yang lebih buruk dari bawaan. Itu harga dari
menjaga prompt Nerona tetap tertutup, dan diterima sadar. Yang menutupinya:
saklar balik satu klik, dan ekor yang menjaga keluaran tetap terpakai.

## Antarmuka admin

Panel `AdminPromptPanel` di `/admin/pengaturan`: dua textarea (badan + ekor),
badge "sedang dioverride" bila nilai tersimpan berbeda dari konstanta kode, dan
tombol "kembalikan ke bawaan" per kolom.

**Hanya `owner_admin`.** Ini tempat pertama di basis kode yang membedakan
`owner_admin` dari `support` — panel admin lain hanya memeriksa `session.user.role`
apa pun isinya. Pembedaan itu disengaja di sini: prompt adalah aset inti, dan
peran dukungan tidak punya alasan melihatnya, apalagi menyuntingnya. Endpoint
`/api/admin/prompts` menegakkan aturan yang sama; pemeriksaan di komponen hanya
demi tampilan.

### Prompt yang dioverride vs golden test

Setelah fitur ini, prompt yang berjalan di produksi bisa berbeda dari yang ada
di kode. `tests/lib/extension-prompts.test.ts` hanya menjaga **bawaannya** —
gagalnya tes tetap berarti "konstanta berubah, disengaja?", tapi tidak lagi
berarti "inilah yang dipakai produksi". Badge "sedang dioverride" di panel ada
supaya perbedaan itu tidak jadi kejutan saat menelusuri keluhan hasil.

## Validasi

Ditegakkan di API, bukan hanya di form:

| aturan | penolakan |
|---|---|
| nama wajib, ≤ 60 char | 400 |
| badan wajib, ≤ 6.000 char | 400 |
| ≤ 20 preset per user | 400 |
| preset milik user lain | 404 |

## Pengujian

Tes baru `tests/lib/prompt-resolver.test.ts`:

- tanpa preset aktif → prompt identik byte-for-byte dengan `buildMetadataPrompt`
  hari ini
- preset aktif → badan tenant + ekor + baris konteks marketplace, dan tidak
  mengandung sepotong pun prompt Nerona
- preset ada tapi nonaktif → kembali ke bawaan
- `Setting` terisi → nilai `Setting` yang menang atas konstanta
- hint vecteezy/miricanvas dan hint batch tetap terpasang di jalur kustom

Tes preset (`tests/lib/prompt-presets.test.ts`):

- mengaktifkan satu preset mematikan yang lain milik user yang sama
- preset user lain tidak ikut termatikan
- batas 20 / 60 char / 6.000 char ditolak

Golden test lama tetap jalan apa adanya.

## Bukan bagian dari pekerjaan ini

- Prompt kustom untuk empat fitur AI lain
- Preset yang otomatis terpilih per marketplace
- Tombol "coba prompt ini" dengan gambar contoh di halaman `/prompt`
- Berbagi preset antar-user, atau galeri preset
- Gerbang paket — semua tenant dengan lisensi aktif boleh memakainya
