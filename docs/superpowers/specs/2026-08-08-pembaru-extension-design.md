# Skrip pembaru extension, dan tombol Muat ulang

Tanggal: 2026-08-08
Menyentuh dua repo: `nerona-web`, `nerona_medata`.
Lanjutan dari `2026-08-07-saluran-pembaruan-design.md`.

## Masalah

Memperbarui Nerona Metadata menuntut empat langkah dari pengguna, dan **satu di
antaranya berbahaya**:

1. unduh ZIP dari `/unduh`
2. ekstrak
3. **timpa isi folder `nerona-metadata` yang lama**
4. klik ⟳ Reload di `chrome://extensions`

Langkah 3 tidak sulit karena menimpa folder itu rumit — ia sulit karena pengguna
harus **mengingat folder mana**. Yang salah mengekstrak ke folder baru lalu
memilih *Load unpacked* lagi mendapat **dua extension aktif sekaligus**: keduanya
menyuntik panel ke halaman marketplace, dan yang lama tetap memakai versi basi.
Gejalanya muncul sebagai "panelnya dobel" atau "fiturnya masih yang lama" —
keluhan yang penyebabnya hampir tidak mungkin ditebak dari laporan pengguna.

Yang hapus-lalu-pasang-ulang tidak merusak apa pun, tapi kehilangan
`chrome.storage` beserta tokennya dan harus menyambung lagi.

## Yang tidak bisa dipakai, dan alasannya

- **Chrome Web Store** — dicoret owner (lihat spec 2026-08-07).
- **CRX sendiri + `update_url`** — Chrome memblokir pemasangan di luar Web Store
  untuk pengguna biasa di Windows dan macOS. Hanya bisa lewat kebijakan
  enterprise di tiap mesin, dan sesudahnya Chrome menandai browser pengguna
  "Managed by your organization". Untuk pelanggan perorangan itu terbaca seperti
  sesuatu yang buruk sedang terjadi.
- **Extension memperbarui dirinya sendiri** — tidak mungkin. Extension tidak
  bisa menulis ke disk di luar `chrome.storage`, dan tidak bisa menjalankan
  program. Native Messaging bisa menjembataninya, tapi memasang host native
  (entri registry + `.exe`) **lebih berat** daripada skrip yang hendak
  digantikan.
- **`chrome.runtime.requestUpdateCheck()`** — hanya untuk extension dari Web
  Store.
- **Nerona Hub yang mengerjakannya** — paling rapi, tapi Hub sekarang terbatas
  paket Business, sementara pemakai extension kemungkinan besar mayoritas di Pro.

## Keputusan owner

1. Skrip menangani **pembaruan saja**. Pemasangan pertama tetap lewat `/unduh`.
2. Skrip tahu versi terbaru dari **endpoint publik baru di nerona-web**, bukan
   dari GitHub API — supaya sumber kebenarannya tetap kunci `Setting` yang sama
   dengan `/unduh`, dan versi yang sengaja ditahan ikut tertahan.
3. Tombol Muat ulang **menolak** selama ada batch berjalan, dan penandanya
   **bisa kedaluwarsa** supaya tab yang crash tidak memblokirnya selamanya.

## Bagian 1 — `GET /api/extension/latest`

Publik, tanpa auth. Membalas:

```json
{ "ok": true, "versi": "1.1.2", "url": "https://github.com/…/nerona-metadata-1.1.2.zip" }
```

- Dibaca dari `extension_version` + `extension_download_url`, sumber yang sama
  dengan `/unduh`.
- URL divalidasi `tautanAman` **di sini**. Ini titik render bagi pemakai mesin,
  jadi penjaganya memang di sini — konsisten dengan aturan yang sudah ada.
- Kunci yang belum diisi atau cacat → **503** dengan pesan jelas, bukan URL
  rusak. Skrip harus bisa membedakan "belum ada rilis" dari "server rusak".
- Tanpa auth karena skripnya tidak punya token, dan ZIP-nya sendiri aset rilis
  publik. Yang terungkap hanya nomor versi dan URL yang memang dirancang untuk
  diunduh siapa pun.
- Dijaga rate limit per IP (preset baru `versiPublik`) dan `Cache-Control`,
  supaya endpoint tanpa auth ini tidak jadi jalan membebani basis data.

## Bagian 2 — `perbarui.cmd` + `perbarui.ps1`

Keduanya ikut di dalam ZIP, jadi mereka **hanya ada di folder yang sudah
terpasang** — dan karena itu tidak ada folder yang bisa salah pilih.

`perbarui.cmd` peluncur satu baris, memanggil PowerShell dengan
`-ExecutionPolicy Bypass` supaya kebijakan mesin pengguna tidak menghalangi.
Bypass di baris perintah hanya berlaku untuk proses itu; ia tidak mengubah
setelan mesin.

Urutan di `perbarui.ps1` dipilih supaya **kegagalan separuh jalan tidak pernah
merusak pemasangan yang bekerja**:

1. tentukan folder dari lokasi skrip sendiri
2. **pastikan `manifest.json` ada di folder itu dan `name`-nya "Nerona Metadata"**
   — tanpa penjaga ini, skrip yang tersalin ke tempat lain akan menghapus folder
   sembarang. Ini operasi merusak di disk pengguna; penjaganya wajib.
3. baca alamat server dari `access/access-config.js` dengan regex — **bukan**
   ditulis ulang di skrip, supaya tidak ada dua nilai yang bisa berbeda
4. tanya `/api/extension/latest`; kalau versinya tidak lebih baru, berhenti dan
   laporkan sudah mutakhir
5. unduh ZIP ke folder temp
6. ekstrak ke temp, lalu **periksa hasil ekstraknya** memuat `manifest.json`
   dengan versi yang dijanjikan
7. baru setelah itu: hapus `access/`, `marketplaces/`, `icons/` lama, lalu timpa
8. cetak "buka popup Nerona lalu klik Muat ulang", lalu `pause`

Langkah 7 menghapus ketiga subfolder lebih dulu supaya berkas yang **dihapus** di
versi baru tidak tertinggal sebagai sisa. Berkas di akar semuanya tertimpa.

Perbandingan versi memakai ruas angka, sama seperti `bandingkanVersi` — bukan
kesamaan string.

**Batasan yang disengaja: Windows saja.** `.cmd`/`.ps1` tidak berarti apa-apa di
macOS, dan `.command` tanpa tanda tangan diblokir Gatekeeper. Pengguna Mac tetap
memakai jalur manual. Menyebut batasnya lebih baik daripada mengirim skrip yang
gagal aneh di sana.

Keduanya ditambahkan ke daftar-putih `FILES` di `scripts/build-zip.js`. Daftar
itu daftar-putih, jadi berkas baru tidak ikut kecuali disebut dengan sengaja.

## Bagian 3 — Tombol Muat ulang di spanduk popup

Diletakkan **di dalam spanduk pembaruan**, di sebelah "Buka halaman unduh".
Alasannya: setelah skrip jalan, extension masih melaporkan versi lama karena
belum dimuat ulang — jadi spanduknya justru masih tampil. Di situlah tombolnya
relevan, dan tidak perlu keadaan UI baru untuk memunculkannya.

Klik → tanya penanda batch ke service worker → kalau bersih,
`chrome.runtime.reload()`. Untuk extension unpacked, memuat ulang berarti Chrome
membaca ulang folder dari disk, jadi `chrome://extensions` tidak perlu dibuka
sama sekali.

Menutup lalu membuka Chrome juga membuatnya terbaca ulang, jadi pengguna yang
melewatkan tombol ini tetap mendapatkannya nanti.

## Bagian 4 — Penanda batch aktif

`chrome.runtime.reload()` **membunuh semua yang sedang berjalan**. Ditekan di
tengah batch 50 gambar, generate yang sedang di udara hilang — dan poin untuk
yang sudah terkirim ke server **sudah terpakai** tanpa hasil yang pernah sampai
ke form. Kerugian yang tidak bisa dibatalkan.

Content script **tidak bisa** menyentuh `chrome.storage.session`: bawaannya hanya
untuk konteks terpercaya, dan membukanya butuh `setAccessLevel` dari service
worker. Jadi content script berkirim pesan, dan **service worker yang memegang
penandanya** — penjaga tidak tinggal di lapisan yang ikut hancur saat halaman
berpindah, pelajaran yang sama yang sudah berlaku di Hub.

Pesan: `NERONA_BATCH_MULAI`, `NERONA_BATCH_DENYUT` (tiap 30 detik),
`NERONA_BATCH_SELESAI` (di `finally`), dan `NERONA_BATCH_STATUS` untuk popup.

Penandanya **bukan boolean tapi tenggat**: `{ hingga: <waktu> }`, diperpanjang
tiap denyut, dianggap kedaluwarsa setelah **90 detik** (tiga denyut terlewat).
Tab yang crash di tengah batch karena itu tidak memblokir tombol selamanya — ia
bebas sendiri dalam satu setengah menit. `storage.session` bertahan walau Chrome
mematikan service worker-nya, dan bersih sendiri saat browser ditutup.

## Yang terbukti dan yang tidak

Bisa dites (nerona-web, Vitest): rute `/api/extension/latest` — bentuk balasan,
503 saat kunci kosong atau URL cacat, rate limit, header cache.

**Tidak** bisa dibuktikan agen, dan tidak akan diklaim:

- `nerona_medata` tidak punya infrastruktur tes; skrip PowerShell hanya bisa
  diperiksa sintaksnya, tidak dijalankan ujung-ke-ujung.
- Bahwa `perbarui.cmd` benar-benar menimpa folder dan Chrome membaca hasilnya
  setelah `chrome.runtime.reload()` — ini menuntut Chrome sungguhan dengan
  extension terpasang.
- Bahwa penanda batch benar-benar memblokir tombol saat batch nyata berjalan.

Ketiganya gerbang owner.

## Yang sengaja tidak dikerjakan

- **Skrip untuk macOS.** Lihat batasan di Bagian 2.
- **Pemasangan pertama lewat skrip.** Keputusan owner; `/unduh` tetap jalurnya.
- **Rollback otomatis kalau versi baru rusak.** Folder lama tidak disimpan.
  Pemulihannya: unduh ulang versi mana pun dari `/unduh`.
