# Saluran pembaruan Nerona Hub & Nerona Metadata

Tanggal: 2026-08-07
Menyentuh tiga repo: `nerona-web`, `nerona_medata`, `nerona-hub`.

## Masalah

Dua produk yang dipasang di mesin pengguna tidak punya jalur pembaruan yang
bekerja.

**Nerona Hub** sebenarnya sudah punya seluruh mesinnya — `tauri.conf.json`
menunjuk ke `latest.json`, dan `release.yml` membangun, menandatangani,
mengunggah, lalu menyusun manifesnya. Yang belum ada cuma kredensial owner.

**Nerona Metadata** dipasang lewat *Load unpacked*, jadi Chrome tidak akan
pernah memperbaruinya sendiri. Satu-satunya teguran yang ada muncul di `/unduh`,
dan hanya kalau pengguna kebetulan membukanya.

**Sisi owner**, tiap rilis menuntut mengisi lima kunci `Setting` dengan tangan.

Ada juga satu cacat struktural yang ditemukan saat menyusun desain ini, dan ia
mematikan auto-update Hub tanpa satu pun galat yang menjelaskan kenapa:

> Kedua produk mengunggah ke repo rilis yang sama, sementara endpoint updater
> Hub menunjuk ke `releases/latest/download/latest.json`. GitHub menentukan
> `latest` dari rilis yang paling baru diterbitkan, **lintas produk**. Begitu
> extension ditandai sesudah Hub, `releases/latest` berpindah ke rilis extension
> — yang tidak punya `latest.json` — dan setiap Hub yang sudah terpasang
> berhenti melihat pembaruan.

Terpisah dari itu: `nerona-hub-releases` per hari ini **belum pernah dipakai
sebagai GitHub Release**. Tidak ada satu pun tag; ketiga artefaknya di-*commit*
ke `main`. Jadi `release.yml` maupun `zip.yml` belum pernah benar-benar jalan.

## Keputusan owner

1. Kedua sisi dikerjakan: pengguna mendapat versi baru, **dan** owner cukup
   menandai versi.
2. Chrome Web Store **dicoret**. Extension tidak akan pernah auto-update;
   yang dibangun adalah pemberitahuan yang sulit dilewatkan.
3. Extension memberi tahu lewat **popup + badge ikon**.
4. Versi lama **boleh jalan sampai batas minimum**; di bawahnya diblokir.
5. **Satu repo rilis** dipertahankan, dibedakan **tag berawalan**, dan endpoint
   updater dipindah ke URL yang tidak ikut berpindah.
6. **CI yang mendorong** versi + URL ke nerona-web; kunci `Setting` tetap
   sumber kebenaran, cuma tidak lagi diketik tangan.
7. Dikerjakan sebagai **satu paket**.

## Bagian 1 — Jalur rilis

### Penamaan tag

| Repo | Tag | Contoh |
| --- | --- | --- |
| `nerona-hub` | `hub-v<semver>` | `hub-v0.1.1` |
| `nerona_medata` | `ext-v<semver>` | `ext-v1.1.1` |

Keduanya tetap mengunggah ke `alfianzack/nerona-hub-releases`. Karena namanya
tidak pernah bertabrakan, satu tag hanya pernah berarti satu produk.

Perubahan yang menyertainya:

- `release.yml`: pemicu `hub-v*`; penjaga "versi cocok dengan tag" memotong
  awalan `hub-v`, bukan `v`.
- `zip.yml`: pemicu `ext-v*`; judul rilis menyebut produknya.

### Endpoint updater pindah ke tag yang tidak bergerak

`tauri.conf.json`:

```
https://github.com/alfianzack/nerona-hub-releases/releases/download/hub-latest/latest.json
```

Job `manifes` mengunggah `latest.json` ke rilis berversinya **dan** menimpanya
ke rilis `hub-latest`.

- `hub-latest` dibuat sebagai **prerelease**, supaya lencana "Latest" di halaman
  rilis tetap menempel pada rilis sungguhan.
- Penjaga manifes-separuh-lengkap yang sudah ada tetap berlaku dan berjalan
  **sebelum** penimpaan: `hub-latest` hanya ditimpa oleh manifes lengkap.
  Menimpanya dengan yang cacat berarti mematikan saluran pembaruan yang tadinya
  bekerja, tanpa jejak.

### CI mengisi `/unduh` sendiri

Rute baru di nerona-web:

```
POST /api/releases/publish
Authorization: Bearer ${RELEASE_SECRET}
```

Badan untuk Hub:

```json
{ "produk": "hub", "versi": "0.1.1",
  "aset": { "windows": "https://…/Nerona.Hub_0.1.1_x64_en-US.msi",
            "mac": "https://…/Nerona.Hub_0.1.1_universal.dmg" } }
```

Badan untuk extension:

```json
{ "produk": "extension", "versi": "1.1.1",
  "aset": { "zip": "https://…/nerona-metadata-1.1.1.zip" } }
```

Aturannya:

- Auth meniru pola `CRON_SECRET` di `api/agent/cron`, tapi **env terpisah**
  (`RELEASE_SECRET`) supaya bocornya satu tidak memberi yang lain. `RELEASE_SECRET`
  yang belum diset = 401 untuk semua orang, bukan pintu terbuka.
- Menulis hanya kunci milik produk yang disebut. `updateUnduhanSettings` diubah
  menerima `Partial<UnduhanSettings>`; `undefined` berarti *jangan sentuh*,
  `""` berarti *kosongkan*. Panel admin yang mengirim seluruh objek tetap
  bekerja apa adanya.
- **URL aset diambil dari yang GitHub laporkan** (`gh release view --json assets`),
  bukan dari nama berkas lokal. GitHub menormalkan spasi jadi titik; URL yang
  dikarang dari nama lokal akan 404 di setiap mesin pengguna. Jebakan ini sudah
  pernah ditutup di job `manifes` dan aturannya sekarang berlaku ke jalur ini
  juga.
- **Rute ini memvalidasi URL sebelum menyimpan** dengan `tautanAman`. Ini bukan
  pembatalan aturan "validasi di titik render" — penjaga render tetap ada apa
  adanya. Bedanya: admin manusia berhak menyimpan nilai setengah jadi, mesin
  tidak pernah punya alasan menulis URL cacat, dan kalau ia menulisnya kita
  ingin CI merah hari itu juga.
- Rute **menolak** upaya menulis `extension_min_version`. Itu kebijakan, bukan
  fakta build.
- Langkah CI-nya gagal lantang kalau balasannya bukan 200.
- `RELEASE_SECRET` diperiksa **sebelum build**, bersama kunci penandatangan.
  Alasannya sama: langkah yang memakainya ada di job `manifes`, setelah build
  macOS universal yang bisa belasan menit, dan menemukannya kosong di sana
  berarti installer terunggah tapi `/unduh` diam-diam menawarkan versi lama.

## Bagian 2 — Extension menyadari dirinya basi

### Kunci Setting keenam

`extension_min_version`, diisi owner di `/admin/pengaturan`, tidak pernah oleh
CI.

### Tidak ada endpoint baru

`/api/extension/me` — yang sudah dipanggil extension — bertambah:

```json
"update": { "latest": "1.1.1", "min": "1.1.0", "url": "https://…/unduh" }
```

`url` menunjuk ke halaman `/unduh`, bukan ke aset langsung: halaman itu yang
memuat petunjuk pemasangannya.

### Extension mengirim versinya

Header `X-Nerona-Ext-Version`, dipasang di satu tempat:
`access/nerona-web-client.js`.

### Badge butuh detak

Sekarang tidak ada apa pun yang berjalan berkala di `background.js`; cache akses
hanya disegarkan saat ada yang meminta. Badge yang menunggu itu baru muncul
setelah pengguna membuka popup, yang menghapus seluruh gunanya.

- Izin `alarms` ditambahkan ke `manifest.json`.
- Satu alarm 6 jam, plus `chrome.runtime.onStartup` dan `onInstalled`.
- Ikon dapat badge `!` oranye; judulnya "Versi baru tersedia".
- Badge dibersihkan begitu versinya sudah mutakhir.

### Spanduk popup

Di atas popup: kedua nomor versi dan satu tombol yang membuka `/unduh`.

### Gerbang minimum, dua lapis

Meniru cara kedaluwarsa sudah bekerja:

- `assertAccess` menolak lebih dulu di sisi klien, supaya pengguna tidak
  terlanjur membakar poin. Diperiksa di jalur segar **dan** jalur cache: kalau
  hanya di jalur segar, extension basi tetap bekerja selama TTL 15 menit dan
  pengguna melihat 403 dari server tanpa penjelasan.
- `/api/extension/generate` yang berwenang: 403
  `{ error: "outdated", min, latest, url }`.
- Batch di `content.js` **berhenti** pada galat `outdated` alih-alih mengulang
  50 kegagalan yang identik. Tidak ada poin yang terbakar — server menolak
  sebelum menagih — jadi yang dicegah kebisingan, bukan kerugian.

Tiga aturan kegagalannya, eksplisit karena semuanya menyangkut mengunci orang
dari pekerjaannya:

1. `extension_min_version` **kosong = tidak ada gerbang**. Kebijakan yang belum
   ditetapkan tidak boleh mengunci siapa pun.
2. Header versi **tidak ada dianggap `0.0.0`**, jadi di bawah minimum apa pun.
   Ini benar — permintaan tanpa versi memang datang dari salinan yang terbit
   sebelum perubahan ini. Akibatnya harus disebut terang: **hari owner mengisi
   kunci minimum, setiap salinan lama berhenti bekerja sampai dipasang ulang.**
   Itu memang gunanya; ia bukan tombol yang boleh ditekan iseng. Panel admin
   memuat peringatan ini di sebelah kolomnya.
3. Perbandingan versi butuh **urutan**, bukan kesamaan.

### `bandingkanVersi`

`butuhPembaruan` sekarang membandingkan string apa adanya, dengan alasan yang
tercatat: formatnya kita sendiri yang tentukan, jadi yang ditanya cuma
sama-atau-tidak. Untuk "minimum" itu tidak cukup.

Ditambahkan `bandingkanVersi(a, b)` yang membandingkan ruas angka, dipakai di
**kedua** tempat. Satu perubahan perilaku yang disengaja: pengguna yang memasang
build lebih **baru** dari yang tercatat tidak lagi ditegur.

Yang dipertahankan dari perilaku lama: `"?"` dan string kosong tetap berarti
*tidak tahu*, dan tidak tahu tidak pernah berarti basi.

## Bagian 3 — Yang terbukti dan yang tidak

Bisa dites sungguhan (nerona-web, Vitest, `environment: node`):

- `bandingkanVersi` dan `butuhPembaruan` di atasnya.
- Auth, validasi, dan penulisan parsial rute `/api/releases/publish`, termasuk
  penolakan atas `extension_min_version`.
- Bentuk blok `update` di `/api/extension/me`.
- Gerbang minimum di `/api/extension/generate`, termasuk ketiga aturan kegagalan.

**Tidak** bisa dibuktikan agen, dan tidak akan diklaim:

- `nerona_medata` tidak punya infrastruktur tes sama sekali — hanya `node --check`.
- nerona-web tidak punya harness render komponen: spanduk popup, badge, dan
  kolom admin tidak terverifikasi.
- `gh` tidak terpasang di mesin ini dan tidak ada tag yang bisa dijalankan dari
  sini. Seluruh rantai rilis — `hub-latest`, unggahan, panggilan publikasi,
  auto-update Hub ujung-ke-ujung — baru terbukti saat owner menandai versi
  pertamanya.

Sisi Hub tidak butuh satu baris Rust pun: endpoint updater adalah konfigurasi,
dan tombol "Periksa pembaruan" sudah ada.

## Langkah cutover owner

Berurutan; nomor 5 adalah pembuktiannya.

1. **Kunci updater Tauri.** `npx tauri signer generate`. Tempel public key ke
   `plugins.updater.pubkey` di `tauri.conf.json` (sekarang masih
   `GANTI_DENGAN_PUBLIC_KEY_UPDATER`). Simpan private key + passphrase sebagai
   secret `TAURI_SIGNING_PRIVATE_KEY` dan `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
   di repo `nerona-hub`.
2. **`RELEASES_TOKEN`.** PAT dengan `contents:write` atas
   `alfianzack/nerona-hub-releases`, disimpan sebagai secret di **kedua** repo
   produk.
3. **`RELEASE_SECRET`.** Satu nilai acak, dipasang sebagai env di Vercel
   (nerona-web) **dan** sebagai secret di kedua repo produk.
4. **Bersihkan repo rilis.** Hapus ketiga biner yang ter-*commit* di `main`
   `nerona-hub-releases`. Mereka tetap ada di riwayat git; menulis ulang riwayat
   itu pilihan owner, bukan syarat.
5. **Tandai versi pembuktian:** `hub-v0.1.1` lalu `ext-v1.1.1`. Yang harus
   terjadi: kedua rilis terbit dengan asetnya, `hub-latest` berisi `latest.json`
   yang lengkap, dan `/unduh` menampilkan kedua versi baru **tanpa ada yang
   menyentuh `/admin/pengaturan`**. Setelah itu pasang `hub-v0.1.1` di satu
   mesin, tandai `hub-v0.1.2`, dan buktikan tombol Periksa pembaruan menemukannya.

`extension_min_version` sengaja **tidak** diisi di cutover. Ia baru diisi saat
ada perubahan yang benar-benar memutus kompatibilitas — dan mengisinya
mengunci setiap salinan lama.

## Yang sengaja tidak dikerjakan

- **Chrome Web Store.** Dicoret owner.
- **Pemasangan ulang extension satu klik.** Tidak mungkin: Chrome menghapus
  `chrome.storage` saat extension di-uninstall, jadi token tidak bisa selamat
  lewat hapus-pasang. Menimpa folder lalu menekan Reload mempertahankannya, dan
  itulah jalur yang dianjurkan `/unduh`. Menyematkan `key` di manifest untuk
  memaku ID tidak menolong: ia justru membuat Chrome menolak memuat salinan
  kedua dari path lain.
- **Pemeriksaan versi untuk Hub.** Tauri updater sudah menanganinya.
- **Menulis ulang riwayat `nerona-hub-releases`.** Keputusan owner.
