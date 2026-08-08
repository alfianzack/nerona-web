# Nerona Hub hanya untuk paket Business

Tanggal: 2026-08-07
Cakupan repo: `nerona-web`, `nerona-hub`

## Masalah

Hub tidak punya gerbang paket sama sekali. `/api/extension/me` mengirim nama
paket, tapi Hub tidak pernah memutuskan apa pun darinya — satu-satunya
pemakaian ada di `app/src-tauri/src/akun.rs`, yang cuma menampilkannya. Yang
benar-benar diperiksa hanya tiga: lisensi `active`, daftar `marketplaces`, dan
saldo poin.

Akibatnya setiap lisensi aktif — Free berbayar sekalipun — bisa memakai Hub.

## Keputusan pemilik

1. **Gerbangnya di penyambungan**, bukan di setiap panggilan API. Konsekuensinya
   diterima: lihat "Yang sengaja dibiarkan terbuka".
2. **Pengguna non-Business yang sudah tersambung diputus**, tidak di-grandfather.
3. **Turun paket mencabut akses seketika.** Business → Pro mencabut token Hub
   pada detik perpindahan, bukan menunggu lisensinya habis.
4. **Setelah dicabut, Hub tidak boleh dipakai untuk apa pun** — bukan sekadar
   berhenti mengunggah.

## Bagian 1 — Model data

Kolom `hub Boolean @default(false)` di `Plan` dan `License`, mengikuti
`rejectAnalyzer` yang sudah ada. Bukan enum dan bukan pencocokan nama paket:
nama bisa berubah, dan `PAID_PLAN_NAMES` sudah membuktikan nama paket dipakai di
banyak tempat.

Migrasi menyertakan **dua** backfill, dan keduanya wajib:

| backfill | kenapa |
| --- | --- |
| `Plan.hub = true` untuk baris bernama `Business` | tanpa ini tidak ada paket yang berhak |
| `License.hub = true` untuk lisensi yang paketnya Business | default kolom `false`, jadi tanpa ini **pelanggan Business yang sudah ada ikut terblokir** |

`grantLicense` (`src/lib/admin-grants.ts`) menyalin `plan.hub` ke lisensi di
kedua cabangnya — yang memperbarui lisensi lama maupun yang membuat baru —
persis seperti `marketplaces` dan `rejectAnalyzer` sekarang. `orders.ts` yang
memberi lisensi Free ikut menyalin.

`getExtensionAccountState` mengembalikan `hub`, jadi ia ikut di
`/api/extension/me` untuk dibaca Hub.

## Bagian 2 — Gerbang penyambungan

Di `approvePairing` (`src/lib/device-pairing.ts`), sebelum token dicetak:
kalau `row.kind === "hub"` dan lisensi pemohon tidak punya `hub`, tolak dengan
alasan baru `plan_required`.

Ditaruh di `approvePairing` dan bukan di rutenya karena `userId` di situ sudah
dipastikan berasal dari sesi, dan karena token dicetak di fungsi yang sama —
tidak ada jalan mencetak token yang melewati pemeriksaan ini.

Rute `/api/extension/pair/approve` memetakan `plan_required` ke HTTP 403, dan
halaman persetujuan menampilkan: **"Paket Anda belum termasuk Nerona Hub."**

Pairing berjenis extension tidak tersentuh.

## Bagian 3 — Pencabutan

Satu fungsi, dua pemanggil — supaya tidak ada dua definisi "apa itu token Hub"
yang bisa bergeser sendiri-sendiri:

```
revokeHubTokens(userId): Promise<number>
```

Ia mencari lewat relasi `DevicePairing` (`kind = "hub"` dan `tokenId` terisi),
**bukan** mencocokkan teks label. Label adalah kolom bebas; token extension yang
kebetulan bernama mirip tidak boleh ikut tercabut.

**Pemanggil 1 — turun paket.** Dipanggil di akhir `grantLicense` setiap kali
lisensi hasilnya tidak punya `hub`. Sengaja tidak membandingkan paket lama
dengan paket baru, cukup melihat keadaan akhir: itu membuatnya idempoten dan
ikut menutup jalur yang tidak terpikir — Business kedaluwarsa lalu diberikan
ulang sebagai Pro, atau lisensi dipindah paket dua kali berturut-turut.

**Pemanggil 2 — migrasi sekali jalan.** Skrip yang mencabut token Hub milik
seluruh akun tanpa bendera `hub`. Wajib mendukung `--dry-run` yang mencetak
email dan label perangkat tanpa mengubah apa pun, supaya pemilik bisa mengabari
pelanggan lebih dulu. Mencabut tanpa peringatan adalah cara tercepat mendapat
tiket dukungan.

Kedaluwarsa lisensi **tidak** butuh penanganan apa pun: `active` jadi `false`
dan Hub sudah menolak sendiri dengan `AppError::Inactive`. Yang butuh
penanganan khusus hanya perpindahan paket, karena di situ lisensinya tetap
aktif.

## Bagian 4 — Hub terkunci setelah token dicabut

Sebagian besar sudah tertutup tanpa perubahan apa pun. `run_batch`
(`core/src/pipeline.rs`) memanggil `api.me()` di **baris pertama**, sebelum
tahap generate maupun tahap unggah:

```rust
let account = api.me().await?;
validate(q, catalog, &account, cfg)?;
```

Semua jalur yang berarti bermuara ke sana — `mulai_batch`, `lanjutkan_batch`,
`kirim_semua`, `ulangi_yang_gagal`, dan `kirim_berkas_uji`. Token yang dicabut
menghentikan semuanya, **termasuk pengiriman FTP atas metadata yang sudah
terlanjur jadi dan sudah terbayar poin**.

Yang tersisa dan tidak menyentuh server sama sekali:

- tes koneksi FTP (`app/src-tauri/src/marketplace.rs`)
- menyimpan kredensial dan setelan marketplace
- melihat, mengedit, menghapus antrean lokal

Karena itu ditambahkan **kunci di tingkat cangkang**: Hub memanggil
`/api/extension/me` saat dibuka, dan bila jawabannya 401 seluruh navigasi
dikunci ke layar Akun — Marketplace, Antrean, dan Riwayat tidak bisa dibuka.

**Hanya 401 yang mengunci. Galat jaringan tidak pernah mengunci.** `AppError`
sudah membedakan `Unauthorized` dari `Network`, jadi pembedaannya tersedia dan
tidak perlu ditebak. Mengunci aplikasi karena wifi putus akan mencabut alat dari
pelanggan yang sah di tengah pekerjaan — kegagalan yang jauh lebih mahal
daripada seseorang sempat menekan Tes koneksi.

Kunci layar ini **kenyamanan, bukan penjaga**. Penjaga uangnya tetap
`run_batch` di Rust, sesuai aturan repo bahwa setiap penjaga yang menyangkut
poin atau tindakan tak-terbalikkan wajib tinggal di `core/`.

## Bagian 5 — Tampilan

- `pricing-tiers.ts`: baris fitur **"Nerona Hub (aplikasi desktop)"** dengan
  `included: plan.hub`, sejajar dengan baris reject analyzer yang sudah ada.
- Kartu Hub di `/unduh` menyebut syarat paketnya bagi yang belum berhak.
  Unduhannya sendiri **tidak** diblokir: memblokir berkas yang toh tidak berguna
  tanpa akun cuma menambah satu cara gagal tanpa menambah satu pun perlindungan.

## Yang sengaja dibiarkan terbuka

**Token yang ditempel manual.** Layar Akun Hub menerima token yang disalin dari
dasbor, dan `ExtensionToken` tidak menyimpan jenis klien — jadi server tidak
bisa membedakan token yang dipakai Hub dari token yang dipakai extension.
Pemegang Pro yang mau mengakali bisa mengakali.

Ini konsekuensi langsung dari keputusan nomor 1, dicatat supaya pembaca
berikutnya tahu ini keputusan dan bukan kelalaian. Penutupnya sudah jelas
bentuknya kalau kelak diperlukan: kolom jenis klien di `ExtensionToken`, diisi
saat pairing, diperiksa `/api/extension/generate`.

**Pesan 401 tidak menjelaskan sebab.** Hub hanya menerima 401; token yang
dicabut karena turun paket dan token yang dicabut karena pengguna menekan
"Putuskan" terlihat persis sama. Layar Akun akan berkata "akun terputus", bukan
"paket Anda tidak lagi termasuk Hub". Menutup ini butuh endpoint yang mau
menerima token mati lalu menjelaskan sebabnya — pekerjaan tersendiri.

## Pengujian

Menumpang berkas tes yang sudah ada, `tests/lib/device-pairing.test.ts`:

- pairing `kind: "hub"` untuk lisensi tanpa `hub` → ditolak `plan_required`, dan
  **tidak ada `ExtensionToken` yang tercipta**
- pairing `kind: "hub"` untuk lisensi dengan `hub` → lolos seperti biasa
- pairing extension tidak terpengaruh oleh bendera apa pun

Tes baru untuk `revokeHubTokens`:

- mencabut token yang lahir dari pairing Hub
- **tidak** mencabut token extension milik akun yang sama
- tidak mencabut apa pun untuk akun yang lisensinya punya `hub`
- aman dijalankan dua kali (idempoten)

Tes untuk `grantLicense`: turun dari Business ke Pro mencabut token Hub akun itu;
naik dari Pro ke Business tidak mencabut apa pun.

Yang tidak diuji otomatis dan harus dicoba dengan tangan: Hub yang tokennya
dicabut benar-benar terkunci ke layar Akun, dan Hub yang jaringannya putus
**tidak** terkunci.
