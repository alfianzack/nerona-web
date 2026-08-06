# Halaman unduh & lisensi Nerona Hub — Desain

Tanggal: 2026-08-03
Status: disetujui owner, siap dibuatkan rencana implementasi
Repo: `nerona-web`

## 1. Ringkasan

Halaman di dalam aplikasi untuk mengunduh Nerona Hub (aplikasi desktop upload
JPEG + metadata ke marketplace, dibangun di repo `nerona-hub`), plus penjagaan
lisensi yang membuat aplikasi itu hanya berfungsi untuk paket Business.

**Berkas installer tidak dijaga; lisensinya yang dijaga.** Siapa pun yang sudah
masuk boleh mengunduh, apa pun paketnya. Yang menentukan bisa-tidaknya dipakai
adalah jawaban server saat aplikasi meminta metadata.

Alasan pembagian itu: sekali installer diunduh, ia bisa disebarkan. Menjaga
berkasnya adalah penjagaan yang terlihat kuat tapi tidak mengikat apa pun, dan
harganya mahal — berkas 5–15 MB harus dialirkan lewat route API, yang di Vercel
menabrak batas respons ±4,5 MB. Lisensi tidak bisa disebarkan.

## 2. Keputusan owner

1. **Unduh terbuka, lisensi yang menentukan.** Bukan berkasnya yang dijaga.
2. **Halaman wajib login.** Bukan halaman publik — masuk grup `(app)`, muncul di
   menu samping, bukan di navigasi marketing.
3. **Penjagaan lewat endpoint terpisah `/api/hub/*`**, bukan lewat token khusus
   dan bukan hanya pemeriksaan di sisi aplikasi.
4. **Pengguna Free/Pro tetap melihat halamannya** lengkap dengan tombol unduh
   yang aktif; yang mereka lihat terkunci adalah keterangan bahwa fiturnya butuh
   Business, disertai jalan upgrade.
5. Nama produknya **Nerona Hub**.

## 3. Halaman `/hub`

Berada di `src/app/(app)/hub/page.tsx`, jadi middleware yang sudah menjaga grup
`(app)` otomatis memantulkan pengunjung yang belum masuk ke `/login`. Tidak ada
penjagaan baru yang perlu ditulis untuk itu.

Isi halaman:

- Penjelasan singkat Nerona Hub: pilih folder JPEG, metadata dibuat otomatis,
  lalu dikirim ke banyak marketplace lewat FTP.
- Dua tombol unduh: **Windows** dan **macOS**. Aktif untuk semua pengguna yang
  sudah masuk, apa pun paketnya.
- Satu blok status lisensi yang berubah menurut paket:

| Paket pengguna | Blok status |
|---|---|
| Business, lisensi aktif | "Lisensimu aktif" + pengingat menempel token dari `/account` + masa berlaku |
| Free / Pro | "Paketmu <nama>. Nerona Hub butuh paket Business." + tombol ke `/paket` |
| Business tapi lisensi kedaluwarsa | "Lisensi Business-mu berakhir <tanggal>." + tombol perpanjang |

Blok itu memakai keadaan akun yang sudah tersedia lewat `getExtensionAccountState`
— tidak perlu query baru.

Menu samping: entri baru di `src/lib/nav.ts`. **`tests/lib/tenant-nav.test.ts`
mengunci isi menu dan akan gagal begitu entri ditambahkan** — tes itu bagian dari
pekerjaan ini, bukan kerusakan yang tidak sengaja.

## 4. Tautan installer disimpan di `Setting`

Tiga kunci, dapat diubah owner dari panel admin tanpa deploy ulang:

| Kunci | Isi |
|---|---|
| `hub_download_windows` | URL installer Windows (mis. GitHub Releases) |
| `hub_download_mac` | URL installer macOS |
| `hub_version` | Nomor versi yang ditampilkan di halaman |

Installer **tidak** ikut ter-commit ke repo: berkas 5–15 MB akan menggembungkan
git selamanya, dan setiap rilis menambah satu salinan lagi. Menyimpan URL-nya di
`Setting` juga berarti merilis versi baru tidak menuntut deploy `nerona-web`.

**Ketika kuncinya kosong, tombolnya menampilkan "Belum tersedia" dan tidak bisa
diklik** — bukan tautan yang menghasilkan 404 saat ditekan. Ini keadaan yang
berlaku sekarang, karena installer-nya memang belum ada.

## 5. Endpoint `/api/hub/*`

Dua route baru. Keduanya memakai token extension yang sudah ada lewat
`resolveExtensionToken` — tidak ada jenis token baru, pengguna Business cukup
mengurus satu token.

### `GET /api/hub/me`

Selalu membalas `200` untuk token yang sah, berisi keadaan akun yang sama seperti
`/api/extension/me` **ditambah** `allowed: boolean`.

Sengaja tidak menolak yang bukan Business: aplikasi desktop harus bisa memberi
tahu **kenapa** ia tidak bisa dipakai. Endpoint yang hanya menjawab 403 memaksa
aplikasi menampilkan "ditolak" tanpa sebab, dan pengguna Pro yang mengunduh lalu
ditolak tanpa penjelasan akan menyimpulkan aplikasinya rusak.

### `POST /api/hub/generate`

Bentuk permintaan dan jawabannya identik dengan `/api/extension/generate`
(feature, marketplace, image.dataBase64 → content, usage, pointsBalance), dengan
satu syarat tambahan **sebelum** AI dipanggil dan **sebelum** poin dipotong:

```
kalau bukan Business → 403 { ok: false, error: "hub_not_allowed" }
```

Urutan pemeriksaan: token sah → lisensi aktif → **hubAccess** → saldo poin →
rate limit → panggil AI → potong poin.

`hubAccess` diperiksa sebelum poin karena menolak setelah memotong poin berarti
pengguna membayar untuk penolakan.

**`/api/extension/generate` tidak disentuh sama sekali.** Extension milik
pengguna Pro harus tetap hidup persis seperti sekarang; ini yang membuat
endpoint terpisah dipilih ketimbang menambahkan syarat ke jalur yang sudah ada.

## 6. Kolom `hubAccess`

Boolean di `Plan` dan `License`, mengikuti pola `rejectAnalyzer` yang sudah ada:
nilainya hidup di `Plan`, disalin ke `License` saat lisensi dibuat, dan bisa
diubah admin per lisensi.

```prisma
model Plan {
  hubAccess Boolean @default(false)
}

model License {
  hubAccess Boolean @default(false)
}
```

Seed: `Business` → `true`, `Free`/`Pro` → `false`.

**Bukan mencocokkan `plan.name === "Business"`.** Nama paket adalah teks yang
bisa diubah admin dari panel; begitu seseorang mengubahnya jadi "Bisnis" atau
"Business Plus", penjagaannya diam-diam berhenti bekerja tanpa satu pun tes yang
gagal. Kolom boolean membuat niatnya eksplisit dan tahan ganti nama.

`getExtensionAccountState` diperluas mengembalikan `hubAccess`, sama seperti ia
sudah mengembalikan `rejectAnalyzer`.

## 7. Pengujian

- **Gerbang paket di level fungsi**, bukan lewat HTTP: Business lolos; Free dan
  Pro ditolak; Business dengan lisensi kedaluwarsa ditolak; Business dengan
  lisensi `revoked` ditolak.
- **Poin tidak terpotong saat ditolak** — diuji dengan memastikan `spendPoints`
  tidak terpanggil pada jalur `hub_not_allowed`. Ini aturan yang paling mudah
  rusak diam-diam saat urutan pemeriksaan diubah nanti.
- **`/api/hub/me` tetap 200 untuk non-Business** dengan `allowed: false` —
  menguncinya supaya tidak ada yang "merapikannya" jadi 403 di kemudian hari.
- **Tiga keadaan blok status halaman** dari bagian 3.
- **Tombol saat `Setting` kosong** menampilkan "Belum tersedia" dan tidak bisa diklik.
- `tests/lib/tenant-nav.test.ts` diperbarui untuk entri menu baru.

## 8. Di luar lingkup

Penandatanganan installer, auto-update, halaman admin untuk mengunggah berkas
installer, statistik unduhan, dan penjagaan berkas installer itu sendiri.

## 9. Konsekuensi untuk repo `nerona-hub`

Aplikasi desktop harus memanggil **`/api/hub/me` dan `/api/hub/generate`**, bukan
padanan `/api/extension/*` yang tertulis di
`nerona-hub/docs/superpowers/plans/2026-08-03-uploader-engine.md` Tugas 5.
Perubahannya kecil — hanya jalur URL di `core/src/api.rs` — tapi harus dikerjakan,
plus penanganan `403 hub_not_allowed` sebagai pesan "paketmu belum Business",
bukan sebagai galat umum.

`/api/extension/metadata-log` **tetap dipakai apa adanya**: pencatatan riwayat
tidak perlu dijaga paket, dan memecahnya jadi dua jalur hanya akan memecah
riwayat pengguna di `/riwayat-metadata`.

## 10. Risiko terbuka

1. **Installer belum ada.** Halaman ini akan hidup dengan kedua tombol dalam
   keadaan "Belum tersedia" sampai repo `nerona-hub` menghasilkan build. Itu
   keadaan yang benar, bukan cacat — tapi owner harus tahu halaman ini tidak
   langsung berguna saat dirilis.
2. **Aplikasi desktop bisa ditambal.** Seseorang yang mengubah aplikasi agar
   memanggil `/api/extension/generate` akan lolos gerbang ini. Kerugiannya
   terbatas — ia memakai poinnya sendiri yang sudah dibayar — dan menutupnya
   menuntut jenis token terpisah, yang sudah dipertimbangkan dan ditolak karena
   memaksa pengguna Business mengurus dua token.
3. **Lisensi lama tidak punya `hubAccess`.** Migrasi memberi `false` sebagai
   nilai awal, jadi pelanggan Business yang lisensinya dibuat sebelum ini akan
   ditolak sampai ada backfill. Backfill wajib ikut dalam rencana implementasi,
   bukan dikerjakan manual belakangan.
