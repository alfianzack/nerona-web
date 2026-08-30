# Provider AI: satu tempat untuk kunci gateway

Tanggal: 2026-08-30

## Masalah

Kunci gateway hari ini bisa berada di dua tempat sekaligus:

- `Setting.ai_api_key` — diisi lewat panel **Koneksi AI**, dipakai sebagai kunci
  bersama untuk semua panggilan.
- `AiModel.apiKey` + `AiModel.baseUrl` — teks bebas per baris model, untuk baris
  yang harus diambil langsung dari providernya.

Akibatnya dua hal. Pertama, menambah model kedua dari gateway yang **sama**
menuntut kuncinya ditempel lagi — dan kunci yang ditempel dua kali adalah kunci
yang suatu hari diputar di satu tempat saja. Kedua, tidak ada satu layar pun yang
bisa menjawab "kunci apa saja yang dipegang sistem ini".

Sekaligus: panel **Model AI** menetapkan tarif — itu uang — tetapi gerbangnya
`Boolean(session.user.role)`, yang meloloskan admin `support`.

## Yang dibangun

1. Tabel `AiProvider`: nama, baseUrl, dan kunci, didaftarkan sekali lalu dipilih
   dari dropdown di tiap baris `AiModel`.
2. Kunci SumoPod yang sekarang di `Setting` **pindah** ke satu baris provider.
   Sesudah itu tidak ada kunci gateway di luar tabel provider.
3. Panel Model AI dan panel Provider hanya untuk `owner_admin`.

Yang **tidak** dibangun: gerbang model per tenant (dibatalkan), dan penguncian
panel Koneksi AI ke owner (di luar lingkup ini; lihat "Ditinggalkan sengaja").

## Skema

```prisma
model AiProvider {
  id        String   @id @default(cuid())
  label     String
  /// Alamat gateway, mis. "https://ai.sumopod.com/v1". Wajib.
  baseUrl   String
  /// Kosong = jatuh ke SUMOPOD_API_KEY, sama seperti perilaku hari ini.
  apiKey    String
  isDefault Boolean  @default(false)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  models    AiModel[]

  @@map("ai_providers")
}
```

`AiModel` kehilangan `baseUrl` dan `apiKey`, dan mendapat `providerId String`
(**wajib**, bukan opsional) beserta relasinya.

Tiga keputusan skema, dengan alasannya:

- **`providerId` wajib.** Kolom opsional berarti "kosong = pakai yang global",
  dan yang global itulah yang sedang dihapus. Baris model tanpa provider tidak
  punya arti setelah perubahan ini.
- **FK `ON DELETE RESTRICT`**, berbeda dengan `users.aiModelId` yang sengaja
  `SET NULL`. Sebabnya beda: tenant yang kehilangan pilihan model masih jatuh ke
  baris bawaan, sedangkan model yang kehilangan gateway tidak punya cadangan
  apa pun — ia cuma gagal saat dipanggil, setelah dipilih tenant.
- **Tidak ada kolom `active` di provider.** Provider yang tidak dipakai tinggal
  dihapus, dan yang masih dipakai tidak boleh dinonaktifkan diam-diam. Saklar
  yang tidak menjawab pertanyaan apa pun hanya menambah keadaan yang harus
  dijaga di tiga tempat.

## Rantai resolusi

`resolveAiForUser` tetap satu-satunya pintu untuk semua panggilan berbayar
(`api/extension/generate`, `api/extension/me`, `agent/tool-loop`). Yang berubah
hanya asal kunci dan gateway.

| Keadaan | Model & tarif | Kunci & gateway |
| --- | --- | --- |
| Tenant punya pilihan yang aktif | baris itu | `row.provider` |
| Tidak | baris `isDefault` yang aktif | `row.provider` |
| Registri model kosong | `Setting.ai_model` + tarif Koneksi AI | provider `isDefault` |
| Tidak ada provider, atau kuncinya kosong | — | `SUMOPOD_API_KEY`, `SUMOPOD_BASE_URL` |

Baris terakhir wajib ada. Kunci yang hari ini datang dari env harus tetap datang
dari env: deploy yang tidak pernah mengisi Setting akan mati pada saat migrasi
kalau rantai itu diputus. Aturannya sama persis dengan `getAiSettings()`
sekarang — kosong berarti "lanjut ke sumber berikutnya", bukan "tidak ada kunci".

Tarif tetap dikunci dari baris yang dipilih **sebelum** panggilan, tidak pernah
dicari dari id model yang dikembalikan provider. Itu tidak berubah.

## Migrasi

Satu migrasi di atas `20260828000000_ai_models`, dalam urutan ini:

1. `CREATE TABLE ai_providers`.
2. Sisipkan satu baris `SumoPod`, `isDefault = true`, `baseUrl` =
   `https://ai.sumopod.com/v1`, `apiKey` disalin dari `settings` baris
   `ai_api_key` (string kosong kalau barisnya tidak ada).
3. Untuk tiap `ai_models` yang punya `apiKey` sendiri: buat satu provider
   `Gateway <label>` dengan baseUrl & kunci baris itu, lalu tunjuk ke sana.
4. Sisa baris `ai_models` menunjuk ke provider SumoPod.
5. `providerId` jadi `NOT NULL` + FK `RESTRICT`; `DROP COLUMN baseUrl, apiKey`.
6. `DELETE FROM settings WHERE key = 'ai_api_key'`.

Langkah 6 yang membuat "satu tempat kunci" benar-benar satu tempat. Tanpa itu
tinggal satu baris Setting yang tidak dibaca siapa pun tetapi terlihat seperti
kunci yang berlaku — persis jenis kebingungan yang sedang dihapus.

**Tarif tidak ikut disalin.** Peringatan di migrasi `20260828000000_ai_models`
masih berlaku: SQL tidak bisa membaca rantai fallback env (`AI_PRICE_IN`,
`POINTS_PER_USD`), jadi menyalin tarif dari `settings` bisa diam-diam mengubah
tagihan saat deploy. Kunci aman disalin justru karena kosong tetap berarti
"pakai env".

Catatan keadaan: `20260828000000_ai_models` belum diterapkan ke produksi, jadi di
produksi `ai_models` masih kosong dan langkah 3 tidak akan menemukan apa pun.
Langkah itu tetap ditulis untuk basis data lokal dan agar migrasinya benar tanpa
bergantung pada urutan penerapan.

## Kode

| Berkas | Perubahan |
| --- | --- |
| `lib/ai-providers.ts` | **baru** — CRUD, `resolveProvider`, masking kunci |
| `lib/ai-settings.ts` | `apiKey` keluar dari `AiSettings` dan `AiSettingsView`; `KEY_API` dan `maskKey` ikut hilang |
| `lib/ai-models.ts` | resolusi memuat relasi provider; `AiModelInput` tukar `baseUrl`/`apiKey` dengan `providerId` |
| `lib/ai-model-input.ts` | baca `providerId`, tolak yang kosong |
| `lib/ai-model-errors.ts` | kode baru: `provider_required`, `provider_not_found`, `provider_in_use`, `base_url_required` |
| `lib/ai-connection-test.ts` | tidak lagi membaca `getAiSettings`; menerima `{ apiKey, baseUrl, modelId }` |
| `api/admin/ai-providers/route.ts` | **baru** — GET, POST |
| `api/admin/ai-providers/[id]/route.ts` | **baru** — PATCH (termasuk `isDefault`), DELETE |
| `api/admin/ai-providers/[id]/test/route.ts` | **baru** — probe teks + gambar |
| `api/admin/ai-settings/test/route.ts` | **dihapus** |
| `api/admin/ai-models/*` | gerbang jadi `owner_admin` |

Kedua probe di `ai-connection-test.ts` tetap utuh — termasuk penyensoran kunci di
pesan galat dan kesimpulan "key benar tapi model ini tidak menerima gambar".
Yang pindah hanya dari mana parameternya datang. Satu hal yang harus tetap:
probe gambar tidak dijalankan kalau probe teks gagal; sebabnya sama, dan
panggilan kedua tidak mengajarkan apa pun.

Gerbang owner mengikuti pola `api/admin/prompts`: sesi tanpa `role` dapat 401,
sesi ber-`role` selain `owner_admin` dapat **403** — bukan 401, karena ia memang
masuk, hanya tidak berwenang.

## Tampilan

- **Provider AI** — panel baru, hanya untuk owner: daftar (nama, baseUrl, kunci
  tersamar, lencana "Bawaan"), tambah/sunting/hapus, "Jadikan bawaan", dan
  tombol **Cek** dengan satu kolom model id untuk probe-nya. Model id itu tidak
  disimpan; ia hanya bahan uji.
- **Koneksi AI** → berganti nama jadi **Bawaan & tarif poin**. Kolom API key,
  tombol "Cek koneksi", dan laporannya pindah ke panel Provider. Sisanya —
  model bawaan, tarif in/out, poin per USD — tidak berubah.
- **Model AI** — kolom baseUrl dan API key diganti satu `<select>` provider;
  panelnya hanya muncul untuk owner.

Kunci API tidak pernah dikirim utuh ke browser, di kedua arah: daftar provider
mengembalikan bentuk tersamar (`****7f21`), dan kolom kunci yang dikirim kosong
berarti "biarkan yang tersimpan", bukan "hapus" — pola yang sama dengan panel
yang ada sekarang.

## Tes

TDD. Yang menentukan, dan harus ditulis lebih dulu:

1. **Provider kosong → jatuh ke env.** Ini yang menjaga deploy hari ini tidak
   mati saat migrasi berjalan.
2. **Provider ada tapi kuncinya kosong → tetap jatuh ke env**, bukan memanggil
   dengan kunci kosong.
3. **Menghapus provider yang masih dipakai model → ditolak**, dan modelnya utuh.
4. **Rute provider & model menolak `support` dengan 403**, dan sesi tanpa role
   dengan 401.
5. **Panggilan memakai baseUrl provider baris itu**, bukan gateway global —
   diperiksa di `resolveAiForUser`, bukan hanya di kliennya.

Berkas yang ikut berubah: `ai-settings`, `ai-settings-route`,
`ai-settings-test-route` (jadi `ai-provider-test-route`), `ai-models`,
`ai-model-routes`, `ai-connection-test`, `tool-loop`, `extension-generate-route`,
`extension-me-route`.

## Ditinggalkan sengaja

- **Panel Koneksi AI tetap terbuka untuk `support`.** Isinya tarif dan poin per
  USD — sama-sama uang — jadi ia pantas dikunci juga, tetapi itu keputusan
  tersendiri dan bukan yang diminta di sini. Dicatat sebagai tindak lanjut.
- **Gerbang model per tenant** — dibatalkan owner sebelum desain ini.
- **Provider bawaan yang sudah dikenal** (Anthropic/OpenAI/DeepSeek dengan
  baseUrl terisi otomatis) — bisa ditambahkan kapan saja di atas skema ini,
  tanpa migrasi lain.

## Celah lama yang ditemukan, di luar lingkup

`resolveAiForUser` hanya memeriksa `user.aiModel.active`, tidak memeriksa ulang
`paidOnly`. Pemeriksaan paket hanya berjalan saat tenant melihat daftar dan saat
memilih; `aiModelId` yang tersimpan tidak pernah dibersihkan saat lisensi
kedaluwarsa. Jadi tenant yang sempat memilih model berbayar lalu paketnya habis
akan terus memakainya — bertentangan dengan niat yang tertulis di
`api/model/route.ts`. Bukan bagian dari pekerjaan ini, tetapi harus dibetulkan.
