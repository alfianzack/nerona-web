# Banyak model AI, tarif per model

Tanggal: 2026-08-28

## Masalah

Nerona memanggil satu model untuk semua orang (`Setting.ai_model`), dengan satu
pasang tarif (`ai_price_in` / `ai_price_out`). Tenant tidak punya pilihan antara
"murah dan cukup" dan "mahal dan lebih pintar", dan owner tidak bisa menawarkan
keduanya karena tarifnya cuma satu.

Yang **tidak** jadi masalah, dan sering disangka begitu: metering per token sudah
berjalan. `costForUsage` menagih `promptTokens × inPerMTok + completionTokens ×
outPerMTok`, dikali `pointsPerUsd`, dibulatkan ke atas dengan lantai 1 poin. Yang
kurang hanyalah tarif yang bisa berbeda antar model.

## Batasan yang mewarisi luka lama

2026-07-28 `MODEL_PRICES` dihapus, dengan catatan tegas: *jangan hidupkan kembali
peta harga berkunci model*. Sebabnya bukan "tarif per model itu buruk", melainkan
cara peta itu dipakai — ia dikunci pada id model yang **dikembalikan provider**
(`gemini-2.0-flash-001`), yang tidak wajib sama dengan id yang diketik owner.
Meleset sedikit, ia jatuh ke baris termurah dan **menagih kurang tanpa suara**.

Desain ini boleh punya tarif per model, dan tetap tidak melanggar pelajaran itu,
selama satu aturan dipegang:

> Panggilan ditagih dengan tarif **baris yang dipilih sebelum panggilan**, tidak
> pernah dengan tarif hasil pencarian atas id yang dikembalikan provider.

Tarif menempel pada setelan, persis seperti sekarang — hanya jamak.

## Model data

### Tabel baru `AiModel`

```prisma
model AiModel {
  id         String   @id @default(cuid())
  label      String                  // yang dilihat tenant
  modelId    String                  // yang dikirim ke gateway
  note       String?                 // satu kalimat deskripsi, ditulis owner
  inPerMTok  Float
  outPerMTok Float
  vision     Boolean  @default(true)
  paidOnly   Boolean  @default(false)
  isDefault  Boolean  @default(false)
  active     Boolean  @default(true)
  baseUrl    String?
  apiKey     String?
  sortOrder  Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  users User[]
  @@map("ai_models")
}
```

`User.aiModelId String?` — pilihan tenant, null berarti "pakai default owner".
`onDelete: SetNull`, supaya menghapus satu model tidak menghapus penggunanya.

**`baseUrl` dan `apiKey` nullable** karena satu hal belum diketahui saat desain
ini ditulis: apakah SumoPod benar-benar menyediakan Claude, GPT, dan DeepSeek.
Kosong = pakai gateway global seperti hari ini. Kalau ada satu model yang harus
diambil langsung dari providernya, dua kolom itu diisi untuk baris tersebut saja
— tanpa mengubah apa pun yang lain.

**`vision`** menyaring daftar yang dilihat tenant. DeepSeek (`deepseek-chat`,
`deepseek-reasoner`) tidak punya penglihatan, dan empat dari lima fitur mengirim
gambar. Model tanpa penglihatan tidak pernah muncul ke tenant, jadi tidak ada
cara memilih kombinasi yang pasti gagal.

**`paidOnly`** menutup lubang uang yang dijelaskan di bawah. Ia knob per baris,
bukan daftar nama paket di kode: owner yang menentukan model mana yang butuh
paket berbayar.

### Tidak ada seed, dan itu disengaja

Rencana awal: migrasi membuat satu baris `AiModel` dari `ai_model` +
`ai_price_in/out` yang ada. Dibatalkan — SQL tidak bisa membaca rantai fallback
env (`AI_PRICE_IN`, `POINTS_PER_USD`), jadi kalau `Setting`-nya kosong tapi
env-nya terisi, seed itu akan menyalin **default kode**, bukan tarif yang
sesungguhnya berlaku, dan tagihan berubah diam-diam pada deploy.

Gantinya: **registri kosong berarti perilaku hari ini**. `resolveAiForUser`
jatuh ke `getAiSettings()` apa adanya saat tidak ada baris default. Owner
mengisi tabelnya saat siap, dan tidak ada satu tagihan pun berubah sebelum itu.

## Resolusi

`src/lib/ai-models.ts`:

```
resolveAiForUser(userId) → { modelId, apiKey, baseUrl, pricing }
  1. baris pilihan user (aiModelId) — kalau masih active
  2. kalau tidak: baris isDefault yang active
  3. kalau tidak ada baris sama sekali: getAiSettings() — perilaku hari ini
  pricing = { inPerMTok, outPerMTok dari baris } + pointsPerUsd global
```

`pointsPerUsd` tetap satu untuk semua. Itu tuas margin owner, bukan sifat model,
dan menyalinnya ke tiap baris hanya menciptakan cara baru untuk tidak konsisten.

Langkah 1 → 2 juga menutup kasus model yang dinonaktifkan setelah dipilih:
jatuhnya ke default, dan aman justru karena tarifnya ikut baris default itu —
bukan tebakan, bukan baris termurah.

Pemanggil yang berubah:

| berkas | dari | jadi |
|---|---|---|
| `api/extension/generate/route.ts` | `getAiSettings()` | `resolveAiForUser(userId)` |
| `lib/agent/tool-loop.ts` | `getAiSettings()` | `resolveAiForUser(params.userId)` |
| `api/extension/me/route.ts` | `ai.model` global | model yang berlaku bagi tenant itu |

`lib/ai-connection-test.ts` tetap memakai `getAiSettings()` — ia menguji sambungan
gateway milik owner, bukan pilihan siapa pun.

`chatCompletion` menerima `baseUrl` opsional; kosong = `SUMOPOD_BASE_URL` seperti
sekarang.

## Antarmuka tenant

Halaman baru `/model`, grup nav Metadata. Daftarnya memuat model yang `active` dan
`vision`, dan menyembunyikan yang `paidOnly` dari tenant berpaket Free.

Tiap baris: label, catatan satu kalimat dari owner, dan **perkiraan poin per
gambar**. Perkiraan itu dihitung dari profil token acuan (~1.200 masuk, ~150
keluar — profil metadata advanced) lewat `costForUsage` yang sama dengan yang
menagih, bukan rumus kedua yang bisa berbeda.

Kata "perkiraan" wajib ada dan tidak boleh dijanjikan lebih: ongkos sebenarnya
lahir dari token yang benar-benar terpakai, dan baru diketahui setelah panggilan
selesai. Halaman Hub sudah memakai bahasa yang sama untuk alasan yang sama.

## Antarmuka admin

Panel `AdminAiModelsPanel` di `/admin/pengaturan`: daftar model dengan tambah,
sunting, hapus, jadikan default, aktif/nonaktif. Kolom `apiKey` tidak pernah
dikirim balik ke klien dalam bentuk utuh — hanya penanda "terisi", mengikuti cara
`AdminAiSettingsPanel` memperlakukan kunci gateway.

Panel Koneksi AI yang lama tetap ada. Ia sekarang berarti "yang dipakai saat
registri kosong, dan gateway mana yang dipakai baris tanpa `baseUrl` sendiri".

## Uang: satu angka yang harus dilihat sebelum rilis

Dengan default di kode (0,25 / 1,5 USD per MTok, 1.000 poin per USD), satu
generate metadata (~1.200 masuk, ~150 keluar) berharga **1 poin**. Model kelas
Opus pada $5 / $25 membuat generate yang sama berharga **10 poin**.

Jatah paket Free adalah 10 poin. Artinya tenant Free yang memilih model termahal
mendapat **satu** generate, lalu mentok — dan ia tidak akan mengerti kenapa.

Dua penutupnya, dua-duanya dibangun:

1. **Ongkosnya terlihat** di `/model` sebelum dipilih, bukan ditemukan setelah
   saldo habis.
2. **`paidOnly`** — owner menandai model mahal sebagai khusus paket berbayar, dan
   ia hilang dari daftar tenant Free. Penjagaannya di server, bukan hanya di
   daftar: memilih lewat API pun ditolak.

Yang **tidak** dibangun: menaikkan jatah Free. Itu keputusan harga, bukan kode.

## Pengujian

- Tarif ikut baris yang dipilih — provider mengembalikan id model yang berbeda,
  tagihan tetap sama (ini uji penjaga atas luka `MODEL_PRICES`)
- Tenant tanpa pilihan → baris default
- Registri kosong → `getAiSettings()`, tarif hari ini, tidak ada yang berubah
- Model pilihan dinonaktifkan → jatuh ke default, bukan ke termurah
- Daftar tenant tidak pernah memuat model tanpa penglihatan
- Daftar tenant Free tidak memuat `paidOnly`, dan memilihnya lewat API ditolak
- `baseUrl` per baris dipakai saat terisi, gateway global saat kosong
- Perkiraan poin memakai `costForUsage`, bukan rumus kedua

## Bukan bagian dari pekerjaan ini

- Pemilih model di dalam extension atau Hub (pilihan tinggal di akun; klien tidak
  berubah dan tidak perlu rilis)
- Model berbeda per fitur untuk tenant
- `Setting.ai_model_keyword` — menyematkan model teks murah khusus riset keyword.
  Disebut di desain sebagai bagian terkecil dan paling gampang dicoret; dicoret.
- Menaikkan jatah paket Free
- Mengisi tabel dengan model apa pun. Tarif SumoPod belum diketahui, dan tarif
  yang dimasukkan harus tarif **SumoPod** — merekalah yang menagih, bukan
  Anthropic/OpenAI/DeepSeek langsung.
