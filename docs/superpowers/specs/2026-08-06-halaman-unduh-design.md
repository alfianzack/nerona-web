# Halaman unduh & pasang — Desain

Tanggal: 2026-08-06
Status: disetujui owner, langsung diimplementasikan (tanpa dokumen rencana terpisah)
Repo: `nerona-web` (menyentuh `nerona_medata` untuk satu skrip build)

## 1. Ringkasan

Satu halaman di dalam aplikasi, `/unduh`, tempat pengguna mengambil ketiga
artefak Nerona sekaligus — extension Chrome, Nerona Hub untuk Windows, dan
Nerona Hub untuk macOS — lengkap dengan cara memasang masing-masing dan cara
menyambungkannya ke akun. Sebagai gantinya, halaman profil kehilangan kartu
lisensi dan seluruh panel extension: keduanya pindah ke sini.

Ketiga berkas **tidak tinggal di repo**. Semuanya jadi aset rilis di
`alfianzack/nerona-hub-releases` (repo publik, sudah ada, per 2026-08-06 masih
kosong), dan halaman ini cuma memegang URL-nya lewat `Setting`.

Desain ini menggantikan `2026-08-03-hub-download-design.md`, yang tidak pernah
diimplementasikan. Yang diambil dari sana: halaman wajib login, URL installer di
`Setting`, dan keadaan "Belum tersedia" saat kunci kosong. Yang dibuang: gerbang
paket `hubAccess` dan endpoint `/api/hub/*` — Hub hari ini memakai token dan
poin yang sama dengan extension, dan menambah gerbang paket bukan bagian dari
permintaan ini.

## 2. Keputusan owner (2026-08-06)

1. **Semua artefak di GitHub Releases**, termasuk ZIP extension. Installer tidak
   di-commit; `public/nerona-metadata.zip` yang selama ini ikut ter-commit
   dihapus.
2. **URL-nya dari `Setting`, dapat diubah dari `/admin/pengaturan`** tanpa deploy
   ulang.
3. **Halaman wajib login**, di grup `(app)`, dengan entri sidebar sendiri.
4. **Profil kehilangan kartu lisensi DAN panel extension.** Keduanya pindah utuh
   ke `/unduh`.

## 3. `src/lib/unduhan.ts`

Mengikuti bentuk `src/lib/payment-settings.ts` yang sudah ada: satu interface,
satu pembaca, satu penulis, plus fungsi murni yang bisa dites tanpa basis data.

```ts
export interface UnduhanSettings {
  hubWindowsUrl: string;
  hubMacUrl: string;
  hubVersion: string;
  extensionUrl: string;
  extensionVersion: string;
}
export async function getUnduhanSettings(): Promise<UnduhanSettings>;
export async function updateUnduhanSettings(values: UnduhanSettings): Promise<void>;
export function tautanAman(raw: string): string | null;
export function butuhPembaruan(terpasang: string | null, terbaru: string): boolean;
```

Lima baris `Setting`:

| Kunci | Isi |
|---|---|
| `hub_download_windows` | URL aset `.msi` |
| `hub_download_mac` | URL aset `.dmg` |
| `hub_version` | nomor versi yang ditampilkan; kosong = kartu tampil tanpa nomor |
| `extension_download_url` | URL aset `nerona-metadata.zip` |
| `extension_version` | versi extension terbaru, dipakai deteksi versi basi |

Baris yang belum pernah diisi tidak ada di tabel, jadi pembacanya mengembalikan
string kosong — bukan melempar. Kosong berarti **"Belum tersedia"**: tombolnya
mati, bukan tautan yang berujung 404 di tangan pengguna.

### `tautanAman`

Hanya URL berskema `https://` yang boleh jadi `href`; sisanya diperlakukan sama
dengan kosong. Nilainya diketik manusia di panel admin dan langsung dipasang ke
atribut `href`, jadi `javascript:...` tidak boleh punya jalan ke sana. `http://`
juga ditolak: aset GitHub selalu `https`, dan menerima `http` cuma menambah cara
gagal tanpa menambah kemampuan.

### `butuhPembaruan`

`terpasang` `null` mengembalikan `false`. "Tidak tahu versi berapa yang
terpasang" bukan "versinya basi" — menegur pengguna atas dasar ketidaktahuan
membuat peringatan itu berhenti dipercaya justru saat ia benar. Sama untuk
`terbaru` kosong. Perbandingannya kesamaan string apa adanya, bukan semver:
nilainya berasal dari `manifest.json` yang formatnya kita sendiri yang tentukan,
dan urutan versi tidak pernah ditanyakan — hanya "sama atau tidak".

## 4. Panel admin

`AdminDownloadSettingsPanel` + `GET`/`PUT /api/admin/download-settings`,
dipasang di grid `/admin/pengaturan` bersama empat panel yang sudah ada. Lima
kolom, satu per kunci.

Tiap kolom URL punya tautan **"Uji"** yang membuka nilai saat ini di tab baru.
Itu satu-satunya penjaga yang mungkin untuk salah ketik URL: tidak ada tes yang
bisa membuktikan sebuah URL eksternal hidup, dan salah satu huruf di sini berarti
404 untuk setiap pengguna tanpa satu pun tanda di sisi kita.

## 5. Halaman `/unduh`

`src/app/(app)/unduh/page.tsx`, komponen server, `requireUser()`. Tiga blok:

**Blok 1 — Status akun.** `LicenseSection` dipindah apa adanya dari profil,
berikut keadaan "belum punya lisensi aktif" + tombol ke `/pricing`. Kunci lisensi
tetap bisa ditemukan; ia hanya pindah ke halaman tempat alatnya dipakai.

**Blok 2 — Extension Nerona Metadata.** Tombol unduh (atau "Belum tersedia"),
empat langkah pasang (ekstrak → `chrome://extensions` → Developer mode → Load
unpacked), lalu `ExtensionConnectPanel` dipindah utuh. Content script extension
cocok dengan `https://nerona-web.vercel.app/*` dan `http://localhost:3000/*`,
jadi jembatan `postMessage`-nya bekerja di halaman ini persis seperti di profil —
tidak ada protokol yang berubah.

Di blok ini juga peringatan versi basi: versi yang diumumkan `HADIR`
dibandingkan dengan `extension_version`, dan kalau berbeda halaman berkata
"Versi terpasang X, tersedia Y — unduh lalu klik ⟳ Reload di
`chrome://extensions`". Extension tidak punya pembaruan otomatis sama sekali,
dan `QA_CHECKLIST.md` menyebut build basi sebagai penyebab paling mungkin dari
kegagalan senyap. Ini penawarnya, dan murah karena nomor versinya memang sudah
ada di `Setting`.

**Blok 3 — Nerona Hub.** Dua kartu, Windows (`.msi`) dan macOS (`.dmg`
universal), masing-masing tombol unduh + langkah pasang. Yang wajib tertulis dan
tidak boleh disamarkan: **kedua installer tidak ditandatangani CA**, jadi Windows
memunculkan SmartScreen ("More info" → "Run anyway") dan macOS memblokir lewat
Gatekeeper (klik kanan → Open, atau System Settings → Privacy & Security → Open
Anyway). Tanpa kalimat itu pengguna menyimpulkan berkasnya rusak atau berbahaya,
lalu berhenti — dan tidak ada apa pun di sisi kita yang menunjukkan itu terjadi.

Kartu ditutup dengan cara menyambungkan: buka Hub → Akun → Hubungkan akun →
cocokkan kode di `/hubungkan`.

## 6. Profil jadi tipis

Sisa: email/peran, verifikasi email, `ProfileForm`, `PasswordForm`, dan **satu
baris tautan ke `/unduh`**. Tautan itu bukan hiasan: orang yang hari ini terbiasa
mencari extension-nya di profil akan menyimpulkan fiturnya dihapus.

`LicenseSection` dan `ExtensionConnectPanel` tidak diubah isinya — hanya
dipindah tempat render. Memindahkan sekaligus menulis ulang berarti tidak ada
titik di mana kita tahu perubahan mana yang merusak apa.

## 7. Menu

Entri sidebar `/unduh` berlabel "Unduh & Pasang". `SidebarItem` mewajibkan ikon
dan `icons.tsx` belum punya glyph unduh, jadi satu ikon `download` ditambahkan.
`tests/lib/tenant-nav.test.ts` mengunci isi menu dan **akan gagal begitu entri
masuk** — memperbaruinya bagian dari pekerjaan ini, bukan kerusakan.

## 8. Urutan cutover

`public/nerona-metadata.zip` dihapus **paling akhir**, bukan bersamaan dengan
halaman baru:

1. Owner membuat rilis `v0.1.0` di `nerona-hub-releases`, mengunggah tiga aset:
   `.msi`, `.dmg`, dan `nerona-metadata.zip` hasil build terbaru.
2. Owner mengisi lima kunci di `/admin/pengaturan` dan mengklik "Uji" di
   ketiganya.
3. Baru setelah itu ZIP dihapus dari git, `scripts/build-extension.ps1` menulis
   ke folder yang di-gitignore, dan `.msi`/`.dmg` yang sekarang menganggur di
   `public/` (masih untracked) dihapus dari disk.

Dibalik urutannya, ada jendela waktu ketika ZIP sudah hilang dari `public/` tapi
`Setting` belum diisi — dan extension tidak punya jalur unduh di mana pun.

`public/*.msi`, `public/*.dmg`, dan `public/*.zip` masuk `.gitignore` supaya
berkas 22 MB tidak pernah masuk riwayat git secara tidak sengaja. Sekali
ter-commit, riwayatnya tidak bisa disusutkan lagi.

## 9. Prasyarat: perubahan id instalasi yang setengah jalan

Saat desain ini ditulis, `ExtensionConnectPanel` sedang di tengah perubahan yang
belum selesai: `issueExtensionToken` sudah beralih dari `replaceSameLabel` ke
`replaceInstallation`, tapi panelnya masih mengirim `{ replace: true }` tanpa
`instalasi`, dan tiga tes merah. Memindahkan panel yang rusak hanya memindahkan
rusaknya, jadi perubahan itu dituntaskan lebih dulu — termasuk membangun ulang
ZIP extension, karena ZIP itulah yang akan diunggah ke rilis.

## 10. Pengujian, dan batasnya

Tes nerona-web berjalan di `environment: "node"` dengan `include:
["tests/**/*.test.ts"]` — **tidak ada harness render komponen**. Jadi penjaga
otomatis hanya mungkin di level lib:

- `tautanAman`: kosong, `javascript:`, `http://`, dan teks sembarang → `null`;
  `https://` → apa adanya.
- `butuhPembaruan`: terpasang `null` → `false`; terbaru kosong → `false`; sama →
  `false`; beda → `true`.
- `getUnduhanSettings` mengembalikan string kosong untuk baris yang tidak ada.
- `tests/lib/tenant-nav.test.ts` diperbarui untuk entri menu baru.

Yang **tidak** bisa dibuktikan tes, dan hanya bisa dari owner: bahwa ketiga URL
benar-benar mengunduh berkas yang benar, bahwa halaman merender ketiga bloknya,
bahwa tombol Hubungkan masih bekerja setelah pindah halaman, dan bahwa kalimat
SmartScreen/Gatekeeper cocok dengan yang sungguh muncul di layar.

## 11. Di luar lingkup

Gerbang paket `hubAccess` dan `/api/hub/*`; penandatanganan installer; halaman
admin untuk mengunggah berkas; statistik unduhan; auto-update extension.

## 12. Risiko terbuka

1. **Salah ketik URL di admin = 404 diam-diam** untuk semua pengguna. Penawarnya
   cuma tautan "Uji" dan kebiasaan mengkliknya.
2. **Atribut `download` diabaikan browser untuk URL lintas-origin.** Aset GitHub
   tetap terunduh karena servernya mengirim `Content-Disposition: attachment`,
   tapi kita kehilangan kendali atas nama berkas yang tersimpan.
3. **Setiap rilis menuntut dua pekerjaan manual** — unggah aset, lalu perbarui
   `Setting`. Kalau nomor versi diperbarui tapi URL tidak, halaman menjanjikan
   versi yang tidak bisa diunduh siapa pun.
