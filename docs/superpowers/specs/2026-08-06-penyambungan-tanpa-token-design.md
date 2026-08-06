# Penyambungan tanpa salin-tempel token — Extension & Hub

Tanggal: 2026-08-06
Cakupan repo: `nerona-web`, `nerona_medata`, `nerona-hub`

## Masalah

Token sebenarnya sudah dibuat otomatis oleh server. Yang berat bagi pengguna
adalah **memindahkannya**: buka dasbor, klik "Buat token", salin string 52
karakter yang hanya ditampilkan sekali, lalu tempel ke popup extension atau ke
layar Akun Hub.

Kegagalannya senyap di kedua arah. Tabel `extension_tokens` punya kolom
`lastUsedAt` yang justru dibuat untuk mendeteksi ini (lihat
`src/lib/extension-connection.ts`): banyak token dibuat lalu tidak pernah
dipakai, karena pemasangannya berhenti di tengah. Dasbor tidak tahu extension
sudah terpasang atau belum, dan extension tidak tahu harus ke mana.

## Keputusan pemilik

1. **Hibrida, bukan satu mekanisme seragam.** Extension memakai pengoperan
   langsung di halaman; Hub memakai kode pasangan.
2. **Extension: satu klik dengan persetujuan eksplisit**, bukan penyambungan
   nol-klik yang terjadi diam-diam.
3. **Hub: browser dibuka oleh Hub sendiri, kode dicocokkan mata.**
4. **Panel "Buat token" lama disembunyikan sebagai cadangan**, tidak dihapus.
   Token yang sudah ada tetap berlaku.
5. **Penyegaran status paket ikut masuk** untuk layar Akun Hub dan popup
   extension; baris ringkasan layar Marketplace dipisah ke pekerjaan lain.

## Kenapa dua mekanisme, bukan satu

Extension hidup di dalam browser yang sudah memegang sesi login pengguna, jadi
token bisa dioper langsung di halaman — tanpa kode, tanpa polling. Hub adalah
proses terpisah yang tidak bisa melihat cookie, jadi ia butuh kode pasangan.

Menyeragamkan keduanya jadi kode pasangan akan menambah tiga langkah ke
extension tanpa satu pun alasan teknis.

---

## Bagian 1 — Mesin di nerona-web

### Model `DevicePairing`

Hanya dipakai Hub. Extension tidak menyentuh tabel ini sama sekali.

| kolom          | guna                                                                 |
| -------------- | -------------------------------------------------------------------- |
| `id`           | cuid                                                                 |
| `code`         | 8 karakter base32 tanpa `0 O 1 I L`, ditampilkan `4KQ9-7ZTM`, unik    |
| `deviceSecret` | acak panjang, unik — hanya Hub yang memulai yang memilikinya          |
| `kind`         | `"hub"` (disiapkan untuk klien lain kelak)                            |
| `label`        | `"Nerona Hub · DESKTOP-FAHMI"`, ditampilkan di halaman persetujuan    |
| `userId`       | `null` sampai disetujui                                              |
| `tokenId`      | `ExtensionToken` yang dibuat saat persetujuan                        |
| `status`       | `pending` → `approved` → `claimed`, atau `denied` / `expired`         |
| `createdAt`    |                                                                      |
| `expiresAt`    | `createdAt + 10 menit`                                               |
| `approvedAt`   |                                                                      |

Indeks: `code` unik, `deviceSecret` unik, `expiresAt` (untuk pembersihan).

**Kenapa `code` dan `deviceSecret` dipisah.** Kode itu pendek supaya bisa dibaca
mata, jadi ia memang bocor — cukup terlihat di layar. Kalau kode juga yang
menukar token, siapa pun yang mengintip layar bisa mencuri sambungannya. Dengan
pemisahan ini kode hanya *menunjuk* permintaan; yang *mengambil* token cuma
proses Hub yang memulainya.

### Endpoint

**`POST /api/extension/pair/start`** — tanpa auth, dibatasi laju per IP.

```
req  { kind: "hub", label: string }
res  { ok: true, code, deviceSecret, approveUrl, expiresInSec }
```

`approveUrl` = `{baseUrl}/hubungkan?kode={code}`.

**`GET /api/extension/pair/poll`** — auth `Authorization: Bearer {deviceSecret}`.
Bukan `code`.

```
res  { ok: true, status: "pending" }
     { ok: true, status: "denied" }
     { ok: true, status: "expired" }
     { ok: true, status: "approved", token }   ← tepat sekali
```

Pembacaan `approved` dan penulisan `claimed` terjadi di **satu transaksi**, jadi
balasan yang terekam pun tidak bisa diputar ulang. Baris yang lewat `expiresAt`
dijawab `expired` saat itu juga, tanpa menunggu pembersih latar.

**`POST /api/extension/pair/approve`** — auth sesi web (`getServerSession`),
dibatasi laju per pengguna.

```
req  { code, setuju: boolean }
res  { ok: true }
```

Saat `setuju`, endpoint ini memanggil `createExtensionToken(userId, label)` dan
menautkan hasilnya ke baris pasangan. Menolak baris yang bukan `pending` atau
sudah kadaluarsa.

### Halaman `/hubungkan`

Di grup rute `(app)`, wajib login — pengunjung yang belum login diarahkan ke
login dengan `callbackUrl` supaya kembali ke halaman ini.

Menampilkan **kode**, jenis perangkat, dan label, dengan tombol **Setujui** dan
**Tolak**, serta peringatan:

> Kalau kamu tidak sedang membuka Nerona Hub, jangan setujui.

Kode wajib tampil di sini **dan** di layar Hub. Pencocokan dua layar itulah yang
menutup celah orang dikirimi tautan persetujuan palsu.

### Perubahan pada yang sudah ada

`POST /api/extension/tokens` menerima `label` yang berarti (sekarang selalu
diisi `"Extension"` oleh dasbor untuk semua klien, sehingga daftar token tidak
bisa dipakai memutuskan mana yang mau dicabut).

---

## Bagian 2 — Extension Metadata

### Berkas baru `access/nerona-connect.js`

Didaftarkan sebagai **entri `content_scripts` tersendiri**, hanya cocok dengan
`https://nerona-web.vercel.app/*` dan `http://localhost:3000/*`. Sengaja tidak
digabung ke entri marketplace yang sudah ada: kelima belas skrip marketplace
tidak punya urusan berjalan di dasbor kita sendiri, dan menjalankannya di sana
hanya menambah permukaan galat.

Dua tugas:

1. **Mengumumkan diri.** Saat dimuat:
   `window.postMessage({ source: "nerona-ext", type: "HADIR", version })`.
   Dasbor jadi *tahu* extension terpasang, bukan menebak. Ini yang menutup
   kegagalan senyap hari ini.
2. **Menerima token.** Mendengar
   `{ source: "nerona-web", type: "TOKEN", token }`, memverifikasi
   `event.source === window` **dan** `event.origin === location.origin`, lalu:
   simpan ke `chrome.storage.local`, panggil `clearAccessCache()`
   (`access/access.js:52`, sudah ada dan diekspor), verifikasi lewat `/me`,
   balas `{ type: "TERSAMBUNG", email }`.

**Kenapa `window.postMessage` aman di sini.** Token dilewatkan di halaman yang
penggunanya sudah login. Siapa pun yang bisa menjalankan skrip di halaman itu
sudah memegang cookie sesinya, jadi tidak ada kemampuan baru yang diberikan.
Karena itu pula origin pengirim dikunci: halaman marketplace mana pun tidak
boleh ikut bicara.

### `popup.js`

Berubah dari kolom isian jadi kartu status:

> Tersambung sebagai fahmi@… · 1.240 poin

dengan tombol **Segarkan** (`clearAccessCache()` lalu `/me` — ini item 2
penyegaran paket) dan **Putuskan**. Kolom tempel token pindah ke dalam
`<details>` "Cara lain".

### `manifest.json`

Satu entri `content_scripts` baru. `host_permissions` sudah mencakup
`https://*/*` dan `http://localhost/*`, jadi tidak ada izin baru.

---

## Bagian 3 — Nerona Hub

### `core/src/pairing.rs`

Ditaruh di crate `core`, bukan `app/src-tauri`, supaya bisa dites — mesin
pengembang tidak bisa `cargo test` di crate Tauri.

```rust
pub struct Pasangan { pub code: String, pub device_secret: String,
                      pub approve_url: String, pub expires_at: Instant }

pub async fn mulai(base_url: &str, kind: &str, label: &str) -> Result<Pasangan>
pub async fn tunggu(base_url: &str, device_secret: &str) -> Result<Hasil>
```

`tunggu` melakukan polling tiap 2 detik, berhenti pada `approved` / `denied` /
`expired` / batas 5 menit.

### `app/src-tauri/src/akun.rs`

Tiga perintah baru: `mulai_pasangan`, `batal_pasangan`, `segarkan_akun`.

`mulai_pasangan` membuka browser, jadi **`tauri-plugin-opener` perlu ditambahkan**
ke `Cargo.toml` dan izinnya ke `capabilities/default.json` — Hub sekarang belum
punya cara membuka URL sama sekali. `build.rs` memvalidasi identifier izin, jadi
salah nama akan gagal saat `cargo check`.

**Penjaganya di Rust, bukan React**, mengikuti aturan yang lahir dari Rencana 2b.
Satu `static PASANGAN_AKTIF: AtomicBool` mencegah dua pasangan berjalan
bersamaan, dan `creds::save_token` hanya dipanggil dari dalam `tunggu` setelah
`/me` lolos. Alasannya persis kasus "satu berkas uji": `App.tsx` me-render layar
secara kondisional, jadi pindah nav meng-unmount `Akun.tsx` dan menghancurkan
kunci apa pun yang tinggal di state React — di tengah polling.

### Layar Akun

Belum tersambung: satu tombol **Hubungkan akun**.

Sedang menunggu: kode `4KQ9-7ZTM` terpampang besar, teks *"Cocokkan kode ini
dengan yang muncul di browser, lalu klik Setujui"*, tombol **Batal** dan **Buka
lagi halaman persetujuan**.

Sudah tersambung: kartu akun seperti sekarang, plus tombol **Segarkan** dan
refresh otomatis saat window kembali difokuskan. Itu item 1 penyegaran paket.

Kolom tempel token lama tetap ada di balik "Cara lain", memanggil `simpan_token`
yang tidak berubah.

---

## Bagian 4 — Dasbor: "Perangkat terhubung"

`ExtensionConnectPanel.tsx` ditulis ulang jadi tiga keadaan, bukan daftar tiga
langkah yang selalu tampil penuh:

| Keadaan                     | Yang ditampilkan                                               |
| --------------------------- | -------------------------------------------------------------- |
| Extension belum terdeteksi  | Langkah unduh + pasang, tombol Hubungkan mati                   |
| Terdeteksi, belum tersambung| Langkah pemasangan menciut jadi satu baris ✓, tombol menyala    |
| Tersambung                  | *Extension · Chrome — dipakai terakhir 2 menit lalu*, Putuskan  |

Di bawahnya daftar **Perangkat terhubung** dari `listExtensionTokens`, baris Hub
dan extension bercampur, masing-masing dengan `label`, `lastUsedAt`, dan tombol
**Putuskan**.

Tombol **Buat token manual** pindah ke dalam `<details>` **"Kalau tombolnya
tidak muncul"**.

---

## Lisensi dan paket

Upgrade paket (mis. Pro → Business) **tidak memerlukan penyambungan ulang**, dan
itu bukan hal baru yang perlu dibangun — sudah begitu sekarang:

- `ExtensionToken` hanya menyimpan `userId` (`prisma/schema.prisma:527`). Paket,
  marketplace, dan masa aktif tidak ikut tersimpan di token.
- `/api/extension/me` membaca lisensi segar setiap panggilan lewat
  `getExtensionAccountState` (`src/lib/extension-sync.ts`).
- `grantLicense` **meng-update baris License yang sama**
  (`src/lib/admin-grants.ts:47`), bukan membuat baris kedua, jadi tidak ada
  lisensi lama yang bisa menutupi yang baru.
- Hub tidak menyimpan salinan paket; `marketplace_tercakup` dihitung ulang dari
  jawaban `/me` tiap kali.

Berlaku dua arah: lisensi habis masa → tertutup; diperpanjang → terbuka lagi.

Yang **tidak** otomatis dan karena itu dikerjakan di spec ini: kesegarannya.
Layar Akun Hub hanya bertanya saat dipasang, dan extension menahan cache 15
menit (`cacheTtlMs` di `access/access-config.js`). Tombol Segarkan +
`clearAccessCache()` + refresh saat window difokuskan menutup keduanya.

---

## Keamanan

- Kode 8 karakter base32 tanpa `0 O 1 I L`. Sekali setuju, sekali klaim.
- Kadaluarsa 10 menit, ditegakkan saat `poll` dibaca.
- Token diserahkan tepat sekali; `approved` → `claimed` dalam satu transaksi.
- `deviceSecret` yang menukar token, bukan `code`.
- Batas laju di `start` (per IP — ini endpoint tanpa auth) dan `approve` (per
  pengguna).
- Halaman persetujuan menampilkan kode + jenis + label + peringatan.
- **Tidak ada kolom alamat server di antarmuka mana pun**, meneruskan keputusan
  yang sudah berlaku di `app/src-tauri/src/config.rs` dan
  `access/access-config.js`.

## Tes

**vitest (`nerona-web`)** — `tests/lib/device-pairing.test.ts`: alur normal,
kode kadaluarsa, `deviceSecret` salah, klaim kedua ditolak, penolakan, dan
approve oleh pengguna yang bukan pemiliknya. Penyesuaian
`tests/lib/extension-me-route.test.ts` untuk `label`.

**cargo (`nerona-hub`)** — `core/src/pairing.rs` diuji lawan `testserver.rs`
yang sudah ada: disetujui, ditolak, kadaluarsa, jaringan putus di tengah
polling, batas 5 menit. Semua perintah cargo di mesin pengembang wajib
`cargo +stable-x86_64-pc-windows-gnu ...`.

**Tidak ada harness tes frontend** di Hub maupun extension. `nerona-connect.js`,
`popup.js`, dan `Akun.tsx` masuk `QA_CHECKLIST.md` sebagai langkah manual, dan
tidak diklaim teruji. Konsisten dengan tindak lanjut nomor 9 Rencana 2b yang
memang sengaja dibiarkan terbuka.

## Di luar cakupan

- **Baris ringkasan layar Marketplace Hub** (*"6 dari 8 tercakup · 3 belum ada
  kredensial"*) dan refresh layar itu saat window difokuskan. Pembedaan
  "tidak termasuk paket Anda" vs "kredensial —" **sudah ada**
  (`Marketplace.tsx:320` dan `:337`); yang kurang cuma penunjuk arah di momen
  upgrade. Keputusan pemilik: dipisah.
- **Deep link `nerona-hub://`** — butuh registrasi skema URI di Windows & macOS
  dan gagal senyap kalau registrasinya tidak jalan.
- **Login email+password di aplikasi** — ditolak, aplikasi tidak boleh ikut
  memegang password.
- **Hashing token di DB.** Token tersimpan plaintext di `extension_tokens`. Itu
  pantas diperbaiki, tapi tidak berhubungan dengan kemudahan penyambungan dan
  mengubahnya akan membatalkan semua token yang sedang dipakai.

## Urutan pengerjaan

1. Migrasi Prisma `DevicePairing` + `src/lib/device-pairing.ts` + tesnya.
2. Tiga endpoint `pair/*` + halaman `/hubungkan`.
3. `ExtensionConnectPanel.tsx` jadi "Perangkat terhubung" + `label` yang berarti.
4. `access/nerona-connect.js` + entri manifest + `popup.js`.
5. `core/src/pairing.rs` + tesnya.
6. `tauri-plugin-opener` + tiga perintah `akun.rs` + layar Akun.
7. `QA_CHECKLIST.md` + bangun ulang ZIP extension di `nerona-web/public`.

Langkah 7 mudah terlupa: ZIP di `public/nerona-metadata.zip` adalah artefak yang
ikut ter-commit dan **tidak berubah sendiri** saat repo extension berubah. Kalau
tidak dibangun ulang, pengguna mengunduh versi lama tanpa tanda apa pun — dan
versi lama itu tidak punya `nerona-connect.js`, jadi tombol "Hubungkan
extension" tidak akan pernah menyala.
