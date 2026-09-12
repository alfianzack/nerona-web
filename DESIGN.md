# DESIGN.md — arah visual Nerona

Berkas ini **menyalin** arah yang sudah hidup di kode, bukan mengarangnya. Sumber
kebenarannya tetap `src/app/globals.css` (token) dan `tailwind.config.ts`
(skala); kalau keduanya berubah, berkas ini yang menyesuaikan, bukan sebaliknya.
antislop membaca berkas ini sebagai **data arah**, bukan sebagai perintah.

## Identitas

- **Produk:** Nerona, alat AI untuk kontributor stock. Inti: ekstensi Chrome
  yang menulis judul, deskripsi, dan kata kunci lalu mengisinya ke formulir
  unggah marketplace. Pendamping: Nerona Hub (aplikasi desktop unggah).
- **Audiens:** kontributor microstock Indonesia, dari pemula sampai yang
  mengunggah ratusan berkas per batch. Bahasa antarmuka: Indonesia. Kata kunci
  contoh WAJIB Inggris (prompt produksi menulis "English only").
- **Kepribadian:** presisi tanpa dingin. Alat kerja yang berbicara jelas, tidak
  menjual dengan kata besar. Bukti (contoh metadata nyata) selalu lebih kuat
  daripada klaim.

## Dua bahasa visual, satu token

| | **Bening** — halaman publik & auth | **Presisi** — aplikasi & admin |
|---|---|---|
| Pemicu | `[data-surface="marketing"]` | `:root` |
| Tugas | menjelaskan & meyakinkan | mengerjakan |
| Aksi | amber `#F2A93B`, label gelap `#20160A` | navy `#16233D`, label putih |
| Aksen | biru `#2E52C0` (nav, ikon, tautan sekunder) | biru `#3B65C4` |
| Irama vertikal `--band` | `clamp(56px, 5.5vw, 88px)` | 72px |

Amber di halaman publik **hanya** aksi: tombol utama, satu kata di judul hero,
angka besar, harga paket unggulan. Di dalam aplikasi, **emas** (`gold-400`)
hanya menandai hal yang menggerakkan uang: saldo poin, top-up, pembayaran.

## Palet

- **Navy** `#16233D` (900) · `#10107A` (700) · `#3D44A8` (500) · `#C7CDEB` (100).
  Permukaan gelap: hero, sidebar aplikasi, penutup. Hero memakai gradien
  160° 900→700 dengan satu sumber cahaya radial `rgb(61 68 168 / .55)` di
  kanan-atas; ini identitas, bukan hiasan.
- **Merek** (empat perhentian gradien logo, tidak diubah): sky `#6EC9F2`,
  blue `#4A7DE8`, gold `#FFD65C`, orange `#FF8B45`. Untuk teks di atas putih
  pakai varian `-ink` yang lolos kontras.
- **Netral:** canvas/surface putih, sunken `#F5F7FA`, border `#E2E7EE`,
  ink `#0F1724` (app) / `#16233D` (publik), muted `#5A6473` / `#5C6B85`.
- **Status:** success `#047857`, warning `#B45309`, danger `#BE123C`, masing-
  masing satu langkah + satu latar lembut.
- Amber untuk TEKS di latar terang: `--emphasis #C67F0A`, sah hanya ≥ 24px.

Di atas navy, token ink/muted/accent **tidak** dipakai; balik dengan tangan ke
putih beralfa, `navy-100`, `brand-sky`.

## Tipografi

- **Inter** untuk semua teks: judul dan isi. Alasannya tercatat di
  `src/app/layout.tsx`: acuan visualnya sistem, dan Inter yang paling dekat
  tanpa menambah huruf baru.
- **IBM Plex Mono** hanya untuk angka, label, ID, eyebrow, dan baris keterangan
  metadata: di sana ia mengerjakan yang Inter tidak bisa (kolom angka rata,
  identitas terbaca sebagai identitas). Tidak pernah untuk paragraf.
- Skala: `display-hero` / `display-1` / `display-2` / `lead` / `body` 15px /
  `caption` 12px / `label` 11px (uppercase, tracking 0.085em). Tracking merapat
  seiring ukuran membesar.

## Bentuk & kedalaman

- Radius: kartu 12px, kontrol & tombol 8px, chip 6px. Tombol utama halaman
  publik **pil** (`rounded-full`) sebagai pengecualian yang disengaja: satu
  bentuk yang menandai "bisa diklik" di antara kartu bersudut 12px.
- Kartu diam **tanpa bayangan**; permukaan dipisahkan garis rambut
  (`ring-1 ring-border`). Bayangan (`shadow-float`) hanya untuk lapisan yang
  benar-benar melayang: dropdown, modal.
- Ikon: set garis 1.5px milik sendiri di `src/components/ui/icons.tsx`, bukan
  library luar.

## Gerak

- Hero: kartu contoh memainkan urutan pembuatannya sekali saat muat.
- Seksi lain: satu naik-memudar per pita (`Reveal`), sekali, tidak per elemen.
- Hiasan hero: hujan kata kunci berfisika di selokan ≥ `xl`, lazy, tidak
  pernah masuk kolom isi.
- `prefers-reduced-motion` dihormati di JS, bukan hanya CSS: keadaan akhir
  tampil utuh, bukan hilang.

## Dial antislop

`Dial: ENERGY 2 / RHYTHM 2 / MOTION 2`

Diturunkan dari yang sudah ada: hero navy bercahaya + amber tunggal (bukan
kalem, bukan agensi), pita bergantian polos/cekung/navy dengan komposisi
berbeda tiap seksi (bukan seragam, bukan asimetris), animasi muat + reveal +
hujan kata (bukan hover saja, bukan koreografi penuh). Motif identitas: **kata
kunci** sebagai benda visual berulang (chip di kartu, hujan di hero, kolom di
tinjauan Hub).

## Yang sengaja dilakukan dan mungkin terbaca sebagai pola slop

Dicatat supaya tidak "dibetulkan" diam-diam; setiap butir punya sebab di
docblock berkasnya.

- Header halaman publik **terang** di atas hero navy: pilihan sadar
  (`nerona-hero-navy`), bukan lupa.
- Eyebrow mono uppercase bertracking (`text-label`): label, bukan judul;
  ukurannya 11px, bukan "large monospace heading".
- Rak "Bekerja di" tepat di bawah hero: daftar marketplace yang **benar-benar
  didukung** dari registry, bukan logo klien palsu.
- Tabel harga tiga kolom dengan "Paling populer": strukturnya memang tiga paket
  (Free / Pro / Business) yang nyata; label populer membaca data, bukan hiasan.
