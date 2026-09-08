# Nerona — spesifikasi perbaikan halaman depan

Dokumen kerja untuk merapikan `nerona-web.vercel.app`. Disusun dari tiga masalah utama: halaman terasa monoton, kata-katanya terlalu banyak, dan warnanya berada dalam satu keluarga hue.

---

## 1. Diagnosis singkat

| Masalah | Penyebab sebenarnya |
|---|---|
| Terasa monoton | 13 seksi dengan struktur identik: H2 → subjudul → paragraf → bullet → kartu mockup. Ritmenya tidak pernah berubah, jadi mata berhenti membedakan seksi. |
| Terlalu banyak kata | Setiap seksi menjelaskan hal yang sama tiga kali (subjudul, paragraf, bullet), padahal kartu mockup di sebelahnya sudah membuktikannya sendiri. |
| Kurang berwarna | Bukan kurang banyak warna — kurang beda hue. Navy, putih, dan chip biru pucat semuanya keluarga biru. |

Target: potong 50–60% total kata, 13 seksi → 8, tambah satu warna hangat yang berlawanan dengan navy.

---

## 2. Palet warna

Navy tetap warna brand. Yang ditambahkan adalah satu warna aksi yang hangat.

### Token

| Peran | Hex | Dipakai untuk |
|---|---|---|
| Navy brand | `#131B42` | Latar nav, hero, seksi CTA penutup |
| Navy pekat | `#0B1130` | Band demo video (lebih gelap dari hero, sengaja) |
| Navy kartu | `#18204A` | Kartu/placeholder di atas navy |
| Border navy | `#262F5C` | Garis pemisah di atas navy |
| Amber (aksi) | `#F2A93B` | Semua tombol utama, angka besar, border kartu Pro |
| Amber teks | `#C67F0A` | Teks/angka amber di atas latar terang |
| Amber tint | `#FBEBD2` | Latar badge "Populer" |
| Teks di atas amber | `#20160A` | Label tombol amber — jangan putih |
| Mint | `#2FBF8F` | Titik status, penanda hasil AI |
| Mint tint | `#DBF3EA` | Latar chip kata kunci |
| Mint teks | `#0B5341` | Teks di dalam chip kata kunci |
| Biru aksen | `#4C8DF6` | Eyebrow, ikon, tautan sekunder |
| Putih | `#FFFFFF` | Latar seksi terang, kartu |
| Abu kebiruan | `#F4F7FC` | Latar seksi terang alternatif |
| Teks utama | `#101838` | Judul dan isi di latar terang |
| Teks sekunder | `#5A627E` | Subjudul, keterangan di latar terang |
| Teks di navy | `#B3BBD6` | Isi di latar navy |
| Teks muted navy | `#8E97B8` | Keterangan kecil di latar navy |
| Border terang | `#E1E6F0` | Border kartu di latar terang |

### Aturan pakai

1. **Amber hanya untuk aksi dan angka.** Tombol utama, tiga numeral besar, harga Pro, satu kata di judul hero. Jangan untuk hiasan. Karena tidak dipakai sembarangan, mata langsung tahu mana yang bisa diklik.
2. **Tombol putih di atas navy diganti amber.** Putih juga warna teks di hero, jadi tombol putih tidak menandakan apa pun.
3. **Mint hanya untuk hasil AI.** Chip kata kunci dan titik status. Ini membangun asosiasi: amber = Anda bertindak, mint = Nerona menjawab.
4. **Biru aksen hanya untuk navigasi dan ikon**, bukan untuk chip.
5. **Chip kata kunci jangan biru pucat.** Di versi sekarang chip biru hampir menyatu dengan kartu putihnya, dan itu justru yang memperparah kesan satu-hue.

### Kontras

- `#F2A93B` **tidak lolos** kontras untuk teks di atas putih. Untuk teks amber di latar terang, pakai `#C67F0A`.
- Label tombol amber harus gelap (`#20160A`), bukan putih.
- Jangan pakai teks di bawah `#5A627E` di atas latar terang untuk ukuran 11–12px.

### Alternatif jika amber tidak cocok dengan logo

Dua warna lain yang juga berlawanan dengan navy:

- Coral `#F2624B` — lebih tegas, lebih berani.
- Lime `#B6D94C` — lebih techy, lebih dingin.

Kalau logo Nerona sudah punya warna kuat, warna itu yang jadi warna aksi dan palet ini menyesuaikan.

---

## 3. Struktur halaman: 13 seksi → 8

### Yang dihapus atau digabung

| Seksi sekarang | Tindakan |
|---|---|
| Hero | Pertahankan, revisi (§4) |
| Kenapa unggahan Anda tertahan | Pangkas jadi satu paragraf tiga kalimat |
| Satu klik. 7 marketplace. | Ganti dengan tiga angka besar |
| Ini hasilnya, apa adanya. | Gabung dengan "Kata kunci yang konsisten" |
| Kata kunci yang konsisten. | Gabung ke atas |
| Pekerjaan yang sama, dari dua sisi. | **Hapus seluruhnya** |
| Dibuat untuk unggahan massal. | Gabung dengan reject analyzer, dua kolom |
| Ditolak? Cari tahu kenapa. | Gabung ke atas |
| Mulai dalam tiga langkah | Pindah ke band demo video |
| Harga Nerona Metadata | Pertahankan, revisi framing (§6) |
| Kehabisan poin? Isi ulang. | Jadi satu baris di bawah kartu harga |
| Pertanyaan umum (11 item) | Pangkas ke 6 item, accordion tertutup |
| Coba gratis hari ini | Pertahankan |

Prioritas pemotongan: **tabel "Pekerjaan yang sama, dari dua sisi" dulu.** Empat barisnya hanya mengulang seksi 2, 3, 7, dan 8. Ini pemotongan terbesar dan paling aman.

### Urutan dan latar seksi baru

Latar yang bergantian adalah alat ritme utama — itu yang membuat mata tahu seksi baru dimulai, tanpa perlu memperbesar H2.

| # | Seksi | Latar | Lebar konten |
|---|---|---|---|
| 1 | Nav + hero (2 kolom: teks + kartu contoh) | `#131B42` | Kolom teks ±435px |
| 2 | Band demo: video autofill, caption 6 kata | `#0B1130` | Lebar penuh |
| 3 | Tiga angka besar | `#FFFFFF` | Grid 3 kolom |
| 4 | Kenapa unggahan tertahan | `#FFFFFF` | Sempit, ±445px |
| 5 | Ini hasilnya (3 kartu: foto, vektor, 3D) | `#F4F7FC` | Grid 3 kolom |
| 6 | Batch + reject analyzer | `#FFFFFF` | 2 kolom |
| 7 | Harga + isi ulang | `#F4F7FC` | Grid 3 kolom |
| 8 | FAQ (6 item, accordion) | `#FFFFFF` | Sempit |
| 9 | CTA penutup | `#131B42` | Tengah |

Navy hanya jadi pembuka, band demo, dan penutup. Kalau seluruh halaman navy, kesan monoton tidak akan hilang seberapa pun warnanya ditambah.

### Variasi kepadatan

Bukan hanya isinya yang berubah — kepadatannya juga. Beberapa seksi harus terasa hampir kosong. Ruang kosong itulah yang membuat seksi padat masih terbaca.

- Band demo (#2): nol paragraf. Hanya video dan caption 6 kata.
- Tiga angka (#3): nol paragraf. Hanya numeral dan label satu kata.
- Prosa (#4): kolom sempit, tanpa bullet, tanpa kartu.

---

## 4. Hero — perbaikan spesifik

Masalah pada versi sekarang:

1. **Tidak menyebut bahwa ini ekstensi Chrome.** Pembaca wajar mengira ini aplikasi web, lalu baru tahu di langkah 2 bahwa harus unduh folder dan muat lewat developer mode. Ini titik drop-off terbesar di halaman dan sekarang diungkap paling bawah.
2. **Judul wrap jadi 5 baris.** "untuk" berdiri sendiri di satu baris, "otomatis." di baris lain. Measure-nya terlalu sempit untuk ukuran font sebesar itu.
3. **Kartu contoh menggantung di bawah tengah**, meninggalkan ruang kosong besar di kanan atas.
4. **Gradient navy melintang diagonal tanpa arah yang jelas** dan bagian kanan-atasnya keruh.

Perbaikan:

- Tambah eyebrow `Ekstensi Chrome` di atas judul, warna `#4C8DF6`, uppercase, letter-spacing `.08em`, mono.
- Lebarkan measure judul sampai wrap jadi 2–3 baris, atau turunkan ukurannya. Line-height `1.22`.
- Naikkan kartu contoh agar sejajar tengah dengan kolom teks. Grid `1.05fr 1fr`, gap 26px.
- Buat navy flat, atau kalau tetap gradient: vertikal dan halus saja.
- Tombol utama jadi amber.
- CTA sekunder "Lihat harga" harus mengarah ke anchor yang benar (lihat §7).

Copy hero (tidak berubah, sudah bagus):

> **Metadata untuk kontributor stock, ditulis otomatis.**
> Judul, deskripsi, dan kata kunci diisikan langsung ke formulir unggah marketplace Anda.
> Tanpa kartu kredit · 10 poin gratis

---

## 5. Copy pangkas — siap tempel

Aturan umum: **subjudul atau bullet, jangan dua-duanya.** Kartu mockup di sebelahnya sudah menunjukkan isinya.

### Seksi 3 — tiga angka

Ganti seluruh seksi "Satu klik. 7 marketplace." dengan tiga numeral:

```
7          50                    ≈2
marketplace  gambar per batch    poin per gambar
```

Informasi yang sama, sepersepuluh kata.

### Seksi 4 — kenapa unggahan tertahan

Sekarang: tiga blok kutipan dengan paragraf masing-masing. Ganti dengan:

> **Kenapa unggahan Anda tertahan**
> Bukan karyanya yang lambat — pekerjaan sesudahnyalah yang lambat. Satu gambar butuh judul, deskripsi, dan puluhan kata kunci. Lalu diulang, per marketplace.

Tiga blok kutipan yang lama tidak hilang nilainya — cuma tidak butuh satu seksi penuh.

### Seksi 5 — ini hasilnya

Sekarang contoh city skyline yang sama tampil tiga kali di halaman (hero, "Ini hasilnya", "Kata kunci yang konsisten"). Itu membuatnya terlihat seperti Anda hanya punya satu hasil bagus.

Ganti dengan **tiga contoh dari tiga jenis karya**, karena FAQ Anda sudah mengklaim ketiganya jalan:

| Kartu | Jenis | Marketplace | Titik warna |
|---|---|---|---|
| 1 | Foto | Adobe Stock | `#4C8DF6` |
| 2 | Vektor | Canva | `#2FBF8F` |
| 3 | Render 3D | Shutterstock | `#F2A93B` |

Latar thumbnail dibedakan per jenis (dingin untuk foto, hijau untuk vektor, hangat untuk 3D) supaya tiga kartu itu tidak terlihat seperti template sama yang diulang.

> **Ini hasilnya, apa adanya**
> Tiga karya, metadata yang benar-benar dihasilkan Nerona.

### Seksi 6 — batch + reject analyzer

Dua seksi jadi satu, dua kolom sejajar, satu kalimat masing-masing:

> **Dibuat untuk unggahan massal**
> Sampai 50 gambar sekali jalan, progres per gambar.

> **Ditolak? Cari tahu kenapa**
> Tempel alasan penolakan, Nerona menunjuk perbaikannya.

Contoh besaran pemotongan: versi sekarang untuk reject analyzer punya paragraf 30 kata plus tiga bullet, padahal kartu analisis penolakan di sebelahnya sudah menunjukkan semuanya.

### Seksi 9 — CTA penutup

> **Coba gratis hari ini**
> 10 poin, cukup untuk menilai hasilnya.

---

## 6. Harga — perbaikan framing

### Masalah

Pro memberi 600 poin untuk Rp 89.000 → sekitar **Rp 148/poin**. Bundel isi ulang termurah **Rp 43/poin**. Siapa pun yang membandingkan akan merasa poin di paket ditandai 3× lebih mahal, dan itu terbaca sebagai jebakan, bukan penawaran.

Ditambah lagi, "sekali bayar, berlaku selamanya" di sebelah mata uang yang bisa habis terasa kontradiktif sampai dijelaskan — dan penjelasannya sekarang ada dua seksi di bawahnya.

### Perbaikan

Terjemahkan poin ke jumlah gambar **di kartunya**, dan posisikan paket sebagai pembelian akses:

| Paket | Harga | Baris di kartu |
|---|---|---|
| Free | Gratis | 10 poin · ≈5 gambar |
| Pro | Rp 89.000 | Akses permanen + 600 poin ≈ 300 gambar |
| Business | Rp 159.000 | 1.500 poin ≈ 750 gambar + reject analyzer |

Satu baris kecil di bawah kartu, menggantikan seluruh seksi "Kehabisan poin?":

> Poin habis? Isi ulang dari Rp 43/poin — tanpa langganan.

Catatan "≈ 2 poin per gambar" sekarang berada jauh di bawah kartu, jadi angkanya tetap abstrak justru di tempat keputusan dibuat.

### Free plan terlalu kecil

10 poin ≈ 5 gambar tidak bisa mendemonstrasikan hal yang Anda jual. Pitch-nya 500 gambar; percobaannya lima gambar, satu marketplace, dan tidak bisa menyentuh mode batch sama sekali. Pertimbangkan 20 poin.

---

## 7. FAQ — 11 item → 6

Sekarang FAQ saja hampir sepertiga panjang halaman, beberapa jawaban 4–5 kalimat, dan semuanya terbuka.

**Accordion, tertutup semua secara default.** Ikon `+` warna `#4C8DF6`.

### Enam yang dipertahankan

1. **Perlu kartu kredit?**
   Tidak. Paket Free aktif seketika setelah daftar. Free adalah poin percobaan sekali per akun, bukan kuota bulanan.

2. **Marketplace apa saja?**
   Adobe Stock, Shutterstock, Vecteezy, Canva, Dreamstime, Magnific, Miricanvas.

3. **Gambar saya diunggah ke server?**
   Berkas asli di komputer Anda tidak pernah dibuka. Yang dikirim adalah salinan kecil dari pratinjau yang sudah tampil di halaman unggah, dipakai sekali lalu tidak disimpan. Yang tersimpan hanya baris riwayat.

4. **Apa itu poin?**
   Poin terpakai setiap kali AI bekerja — sekitar 2 poin per gambar. Poin yang belum terpakai tidak hangus, dan bisa diisi kapan saja tanpa berlangganan.

5. **Cara memasang ekstensinya?**
   Unduh folder ekstensi dari halaman Profile, lalu muat lewat Chrome dengan Load unpacked. Belum melalui Chrome Web Store.

6. **Bagaimana pembayarannya?**
   Transfer bank. Pilih paket, kirim order, unggah bukti transfer — tim kami aktifkan, biasanya di hari yang sama.

### Lima yang dipindah ke halaman `/faq` terpisah

- Bisa dipakai untuk vektor atau cuma foto
- Metadata yang dihasilkan berbahasa apa
- Berapa kata kunci per gambar
- Apakah nama merek atau logo ikut jadi kata kunci
- Apakah ada tagihan bulanan (sudah terjawab di kartu harga)

### Satu yang perlu ditambah

**Kebijakan refund.** Dengan transfer manual dan "berlaku selamanya", ini hal pertama yang dicari pembeli yang hati-hati, dan sekarang tidak ada di halaman mana pun.

### Contoh pemangkasan jawaban

Sebelum (3 kalimat panjang):

> Inggris, selalu. Adobe Stock dan Shutterstock menilai metadata dalam bahasa Inggris, jadi prompt produksi kami meminta bahasa Inggris untuk judul, deskripsi, dan setiap kata kunci — tidak ada saklar bahasa yang bisa mengubahnya. Antarmuka Nerona tetap bahasa Indonesia; yang berbahasa Inggris hanya isi metadatanya.

Sesudah:

> Inggris, selalu — Adobe Stock dan Shutterstock menilai metadata dalam bahasa Inggris. Antarmuka Nerona tetap Indonesia.

---

## 8. Checklist teknis

- [ ] CTA sekunder di hero mengarah ke `#pricing`, sementara nav memakai `/pricing` dan anchor lain `#fitur` / `#faq`. **Pastikan id `#pricing` benar-benar ada di halaman depan.**
- [ ] `next/image` pada contoh gambar meminta `w=3840` untuk slot yang lebarnya beberapa ratus piksel. **Set prop `sizes` dengan benar** — ini kemungkinan besar penyebab LCP lambat di mobile.
- [ ] `<title>` sekarang hanya "Nerona". Ganti jadi deskriptif, mis. `Nerona Metadata — metadata AI untuk kontributor stock`.
- [ ] Pastikan OG image ada.
- [ ] `<img>` logo punya `alt` kosong. Isi.
- [ ] Set `lang="id"` pada `<html>`.
- [ ] Pastikan chip kata kunci punya gap sungguhan — di ekstraksi teks halaman, chip-nya menyambung ("city skylinegolden hour"). Sering ini cuma artefak scraping, tapi kadang gap-nya memang hilang.
- [ ] Samakan label CTA. Sekarang ada empat: "Coba Gratis", "Mulai gratis", "Mulai Gratis", "Buat akun gratis". Pilih satu.
- [ ] Beri keterangan satu kata untuk **Magnific** dan **Miricanvas** — dua nama ini tidak familiar bagi sebagian besar kontributor.
- [ ] Ganti domain `vercel.app` ke domain sendiri, dan email kontak dari Gmail pribadi ke email domain. Untuk produk berbayar dengan transfer manual, dua hal ini berpengaruh besar pada kepercayaan.

---

## 9. Di luar halaman — tiga hal yang lebih menentukan konversi

Ini bukan soal tata letak, tapi tiga hal ini lebih berpengaruh daripada seluruh isi dokumen di atas.

### Demo tanpa daftar

Halaman Anda menulis "Nilai sendiri kata kuncinya sebelum Anda mendaftar", tapi pembaca hanya bisa menilai satu contoh yang Anda pilih sendiri. Izinkan drop satu gambar di halaman depan dan dapatkan metadata sungguhan, dibatasi satu per pengunjung. Keberatan utama pembaca adalah "AI-nya benar-benar bagus atau tidak", dan semua isi halaman sekarang hanya klaim Anda sendiri.

### Bukti sosial

Nol testimoni, tidak ada jumlah kontributor, email Gmail pribadi, domain `vercel.app`, dan pembayaran transfer manual. Itu banyak ketidakfamiliaran yang menumpuk untuk orang yang hendak mengirim Rp 89.000 ke orang yang belum dikenal.

### Friksi ekstensi

"Load unpacked" lewat developer mode menakutkan bagi non-teknis. Minimal: rekaman layar pendek untuk langkah pemasangan, dan sebutkan apakah Edge/Brave jalan. Kalau bisa, kejar Chrome Web Store — status "belum di Web Store" sendiri adalah pukulan kepercayaan.

---

## 10. Urutan pengerjaan

Dari dampak tertinggi per jam kerja:

1. Hapus tabel "Pekerjaan yang sama, dari dua sisi" — satu penghapusan, nol risiko.
2. Tambah eyebrow "Ekstensi Chrome" di hero.
3. Tambah baris "≈ 300 gambar" di kartu harga.
4. Ganti tombol putih jadi amber; ganti chip biru jadi mint.
5. Buat seksi tengah berlatar terang, navy hanya di hero dan penutup.
6. FAQ jadi accordion, pangkas ke 6 item.
7. Gabung seksi 3+7 dan 4+5.
8. Rekam video autofill, pasang sebagai band lebar penuh setelah hero.
9. Bangun demo satu gambar tanpa daftar.
