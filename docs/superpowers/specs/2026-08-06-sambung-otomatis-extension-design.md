# Penyambungan otomatis extension saat sudah login

Tanggal: 2026-08-06
Cakupan repo: `nerona-web`

## Masalah

Penyambungan extension sudah tidak lagi menuntut salin-tempel token, tapi masih
menuntut **satu klik di tempat yang benar**: pengguna harus tahu bahwa halaman
`/unduh` ada, membukanya, lalu menekan "Hubungkan extension". Pengguna yang
sudah login dan sudah memasang extension tetap berada dalam keadaan tidak
tersambung sampai ia melakukan ketiganya.

Padahal semua bahan untuk menyambung sudah tersedia di detik halaman itu dimuat:
sesi login ada di cookie, dan extension sudah mengumumkan dirinya lewat `HADIR`
beserta versi dan id instalasinya.

## Pembalikan keputusan pemilik sebelumnya

Spek `2026-08-06-penyambungan-tanpa-token-design.md` keputusan nomor 2 berbunyi:

> **Extension: satu klik dengan persetujuan eksplisit**, bukan penyambungan
> nol-klik yang terjadi diam-diam.

**Keputusan itu dibatalkan oleh dokumen ini.** Pemilik memilih penyambungan
nol-klik pada 2026-08-06. Dicatat terang-terangan supaya pembaca berikutnya
tidak menyangka nol-klik itu kelalaian yang lolos, lalu "memperbaikinya" kembali
ke satu klik.

Yang dipertukarkan: persetujuan eksplisit manusia atas pencetakan kredensial
permanen, ditukar dengan hilangnya seluruh langkah pemasangan yang tersisa.

## Keputusan pemilik

1. **Pemicunya cukup di `/unduh`.** Tidak ada jembatan baru di layout, tidak ada
   endpoint baru. Panel yang sudah ada memanggil dirinya sendiri.
2. **Ikut akun yang sedang login.** Kalau satu browser dipakai berganti akun,
   extension berpindah ke akun terakhir yang membuka `/unduh` — tanpa klik.
3. **Token yatim milik akun lama dibiarkan**, diandalkan tampil di daftar
   perangkat akun itu untuk dicabut sendiri. Lihat "Akibat yang diterima".

## Kondisi pemicu

Menembak **sekali per muat halaman**, saat semua benar:

| syarat | kenapa |
| --- | --- |
| daftar token akun sudah **benar-benar** termuat | `tokens` yang masih `[]` di render pertama tidak bisa dibedakan dari "akun ini belum punya token". Menembak di situ berarti menyambung atas dasar ketidaktahuan |
| `instalasi !== null` | id instalasi dilaporkan `HADIR`; tanpa itu tidak ada apa pun untuk dicocokkan saat mencabut |
| akun yang login **tidak punya** baris token dengan id instalasi itu | inilah wujud keputusan nomor 2 |
| tidak sedang `sibuk`, dan belum pernah menembak di sesi halaman ini | mencegah dua pencetakan dalam satu kunjungan |

Syarat ketiga sengaja **bukan** "extension belum punya token". Yang ditanya
adalah "*akun ini* punya token dari instalasi ini?", bukan "extension punya token
*apa pun*?". Pembedaan itu yang membuat login sebagai akun B menyambungkan
extension ke B, alih-alih membiarkannya diam karena ia masih memegang token A.

Konsekuensi yang ikut cuma-cuma: extension yang masih memegang token dari akun
yang sama tapi dari **instalasi berbeda** (mis. profil Chrome kedua) tetap
disambungkan, karena baris untuk instalasi ini memang belum ada.

### Build lama tetap manual

Extension yang tidak mengirim `instalasi` di `HADIR` tidak ikut otomatis.
Alasannya bukan kehati-hatian umum: `issueExtensionToken` mencabut token lama
dengan mencocokkan **akhiran label** pada id instalasi
(`src/lib/extension-auth.ts`). Tanpa id, tidak ada yang tercabut — dan
penyambungan otomatis tanpa pencabutan berarti satu kredensial penuh baru
tercetak **setiap kali** `/unduh` dibuka. Untuk build itu tombolnya tetap.

## Yang tidak berubah

`hubungkanExtension()` dipanggil apa adanya. Seluruh penjaganya ikut tanpa
ditulis ulang:

- `kirimRef` — dua pemicu dalam satu frame tidak lolos berdua
- batas waktu 10 detik — extension yang diam tidak membuat layar macet
- pencabutan token nganggur saat batas waktu itu tercapai
- pesan `GAGAL` per sebab dari `nerona-connect.js`

Kegagalan otomatis karena itu jatuh ke keadaan yang sudah ada: pesan galat merah
plus tombol "Hubungkan extension" yang masih bisa ditekan. Tidak ada layar buntu
baru, dan tidak ada percobaan ulang berulang — sekali per muat halaman, titik.

## Akibat yang diterima

`issueExtensionToken` membatasi pencabutan pada `userId` yang sama. Saat
extension berpindah dari akun A ke akun B, token A untuk instalasi ini **tidak
ikut dicabut**: extension sudah menimpanya di sisinya, tapi di server ia masih
hidup — kredensial penuh yang tidak dipegang siapa pun.

Diterima, tidak ditutup, dengan alasan:

- terbatas pada pengguna yang benar-benar berganti akun di satu browser;
- terlihat: barisnya tampil di daftar perangkat akun A sebagai
  `Extension · Chrome · <id>` dengan `lastUsedAt` yang berhenti bergerak;
- bisa dicabut sendiri oleh A lewat tombol Putuskan yang sudah ada.

Kalau ternyata berganti akun bukan kasus langka, penutupnya sudah jelas
bentuknya: endpoint `POST /api/extension/self-revoke` yang diautentikasi oleh
token itu sendiri, dipanggil `nerona-connect.js` sebelum ia menimpa tokennya.
Tidak dibangun sekarang.

## Susunan

| berkas | peran |
| --- | --- |
| `src/lib/auto-sambung.ts` | **baru** — kondisi pemicu sebagai fungsi murni |
| `tests/lib/auto-sambung.test.ts` | **baru** — tes kondisi itu |
| `src/components/account/ExtensionConnectPanel.tsx` | memanggilnya dari satu `useEffect` |

Kondisinya ditaruh di modul murni dan bukan sebagai `if` panjang di dalam
komponen karena aturan inilah bagian yang layak diuji, dan komponen ini tidak
punya tes sama sekali. Polanya mengikuti `device-label.ts` dan `unduhan.ts`:
bebas prisma, bebas React, boleh diimpor komponen klien.

## Pengujian

Tes unit atas `bolehSambungOtomatis`, masing-masing satu syarat gagal sendirian:

- daftar token belum termuat → tidak menembak
- `instalasi` null (build lama) → tidak menembak
- akun sudah punya token dari instalasi ini → tidak menembak
- akun punya token extension dari **instalasi lain** → tetap menembak
- sedang sibuk → tidak menembak
- sudah pernah menembak di halaman ini → tidak menembak
- semua syarat terpenuhi → menembak

Yang tidak diuji otomatis, dan harus dicoba dengan tangan: `/unduh` dibuka dalam
keadaan login dengan extension terpasang benar-benar menyambung tanpa klik, dan
berganti akun memindahkannya.
