# Penjaga unggahan: perbaikan otomatis, duplikat, risiko reject, skor keyword

Tanggal: 2026-09-17. Disetujui owner lewat brainstorming pada tanggal yang sama,
termasuk mockup interaktif: https://claude.ai/artifact/BWFyXgKXgMRZrX4RCzBUir

## Masalahnya

Ekstensi punya tiga tombol AI di halaman kontributor: `AI Scoring Agent`
(`content.js:10589`), `Commercial Intent Analyzer` (`content.js:10538`), dan
`Keyword AI` (`content.js:10642`). Ketiganya satu jenis: memanggil AI, membuka
overlay berisi teks, selesai. Kontributor membaca, lalu mengetik ulang sendiri.

Bandingkan dengan Generate Metadata, yang **menulis ke form** marketplace lewat
`setNativeValue`. Itu yang benar benar mengubah keadaan. Tiga tombol tadi tidak.

Dua hal yang paling sering membuat berkas ditolak juga belum tersentuh. Grep di
`content.js` tidak menemukan deteksi duplikat maupun pemeriksaan model release,
padahal "similar content" dan release yang kurang adalah alasan penolakan yang
menghabiskan jatah review tanpa hasil.

## Enam fakta yang membentuk desain ini

1. **`content.js` sudah 10.864 baris.** Kode baru tidak boleh menambah berkas
   itu.
2. **Tidak ada bundler di `nerona_medata`.** Tidak ada `package.json`. Berkas
   dimuat polos dan berurutan lewat daftar `js` di `manifest.json`, berbagi satu
   lingkup global. Jadi modul baru = berkas baru di daftar itu, persis pola
   `marketplaces/*.js`, dan bisa diuji sendiri seperti
   `scripts/suggestion-merge.test.mjs`.
3. **Ada satu titik sempit yang dilewati semua marketplace.**
   `generateMetadataFromImage` (`content.js:5226`) berakhir dengan
   `return finalMetadata` (~L5317), dan baru sesudahnya
   `applyAdobeMetadataToSingleAsset`, `applyMiricanvasMetadataToSingleAsset`,
   `applyGeneric` menulis ke form. Satu sisipan di situ melayani semua
   marketplace.
4. **Prompt `reject` tidak bisa dipakai untuk gambar yang belum dikirim.**
   `prompts.ts:839` berbunyi: "The contributor indicates this asset was REJECTED
   or NOT ACCEPTED by the marketplace UI." Premisnya sudah memaksa jawaban, jadi
   gambar yang baik pun akan dikarangkan alasan penolakan.
5. **`Commercial Intent Analyzer` hampir seluruhnya bagian dari Scoring.** JSON
   keluaran Scoring (`prompts.ts:488-520`) sudah berisi `"commercial_intent"`,
   `"keywords"`, `"avoid_keywords"`, dan `"rejection_risk"`. Kontributor bisa
   membayar dua kali untuk jawaban yang tumpang tindih.
6. **`MetadataLog` (`prisma/schema.prisma:581`) sudah satu baris per gambar,
   lengkap dengan `userId`.** Riwayat duplikat lintas waktu tinggal menambah satu
   kolom, bukan tabel baru.

## Keputusan owner

| Pertanyaan | Jawaban |
|---|---|
| Kapan pemeriksaan risiko dijalankan | **Otomatis tiap gambar muncul di layar** |
| Siapa menghitung ulang skor saat keyword diedit | **Lokal otomatis, plus tombol AI manual** |
| Apa yang terjadi saat Generate menemukan masalah | **Betulkan yang bisa, lalu laporkan** |
| Sejauh mana duplikat dibandingkan | **Sebatch plus riwayat di server** |
| Tiga tombol jadi berapa | **Dua: satu tombol gabungan, `Keyword AI` tetap sendiri** |
| Di mana aturan marketplace disimpan | **Di server (`Setting`), hitungannya tetap lokal** |

### Konsekuensi yang diterima sadar

- **Pemeriksaan otomatis membelanjakan poin tanpa diminta.** Owner memilih ini
  setelah membaca ongkosnya. Tiga rem dipasang tanpa mengubah perilakunya:
  pemicu `IntersectionObserver` (yang tidak digulir tidak dibayar), hasil
  di-cache per sidik gambar (buka ulang halaman gratis), dan antrean konkurensi
  1 (kalau poin habis, yang terbakar sisa satu panggilan, bukan sisa lima
  puluh).
- **Rumus lokal tidak bisa menilai relevansi.** Keyword baru yang diketik
  kontributor tidak diberi skor relevansi karangan, ia ditandai `belum dinilai`
  dan tidak ikut menaikkan atau menurunkan bagian relevansi.
- **Mengedit teks keyword membuang nilai relevansi lamanya.** Termasuk untuk
  perbaikan salah ketik kecil. Ini disengaja: angka lama sudah tidak berlaku
  untuk teks yang lain.
- ~~**Prompt `scoring` dan `commercial_intent` berubah**, jadi golden test
  `tests/lib/extension-prompts.test.ts` akan merah dan diperbarui dengan
  sadar.~~
  **Batal, dan itu kabar baik (2026-09-17).** Saat implementasi terlihat bahwa
  mengubah kedua prompt itu akan mengubah hasil untuk ekstensi yang SUDAH
  terpasang di komputer orang, tanpa mereka memperbarui apa pun. Jadi keduanya
  dibiarkan utuh dan fitur baru `skor` ditambahkan di sebelahnya. Golden test
  tetap hijau, tidak ada yang perlu diperbarui, dan kalau panel baru bermasalah
  masih ada jalan mundur. Prompt lama boleh dicabut kalau nanti terbukti tidak
  ada lagi yang memanggilnya.

## Pemecahan pekerjaan

| Kode | Fitur | Bentuk akhirnya |
|---|---|---|
| **A** | Perbaikan otomatis metadata | Lebur ke Generate Metadata, tanpa tombol baru |
| **B** | Penjaga duplikat | Lebur ke Generate Metadata, hasilnya tampil di badge C |
| **C** | Risiko reject per gambar | Badge otomatis di kanan bawah gambar |
| **D** | Skor gambar + skor per keyword | Satu tombol gabungan, panel dengan keyword yang bisa diedit |

## Berkas baru di ekstensi

Empat **mesin murni**: tanpa DOM, tanpa `chrome.*`, masuk keluar cuma data.
Inilah yang diuji dengan `node --test`.

| Berkas | Isinya |
|---|---|
| `guard/aturan.js` | Aturan per marketplace dan bobot skor. Ambil dari server, simpan di `chrome.storage`, punya salinan bawaan |
| `guard/perbaikan.js` | `(metadata, marketplace, aturan)` ke `{metadata, perubahan[], sisa[]}` |
| `guard/sidik.js` | Elemen gambar ke sidik dHash 64 bit lewat canvas, plus jarak Hamming |
| `guard/skor.js` | `(keywords, visualBrief, title, aturan)` ke `{total, per keyword, sebab}` |

Dua berkas UI yang menyentuh halaman marketplace: `ui/badge-risiko.js` (C) dan
`ui/panel-skor.js` (D). Keduanya memanggil mesin di atas, tidak menghitung
sendiri. Semuanya masuk daftar `js` di `manifest.json` **sebelum** `content.js`,
seperti `marketplaces/*.js` sekarang.

## Bentuk data

### `Setting`, satu kunci baru

Kunci `extension_guard_rules`, berisi JSON: versi aturan, lalu per marketplace
batas panjang judul, batas jumlah keyword, daftar kata terlarang, dan bobot
empat bagian skor. Pola yang sama dengan harga poin dan prompt kustom: baca DB,
jatuh ke env, jatuh ke bawaan.

Nomor versi wajib ikut, karena skor yang disimpan harus bisa dibaca ulang dengan
aturan yang benar. Kalau bobot diubah dari panel admin bulan depan, skor lama
tidak boleh diam diam berpindah arti.

### `MetadataLog`, satu kolom baru

```prisma
imageHash String?   // dHash 64 bit sebagai hex 16 karakter
@@index([userId, imageHash])
```

Pencarian duplikat: kecocokan persis dicari lewat indeks, lalu 2.000 sidik
terbaru milik kontributor itu dibandingkan di memori dengan jarak Hamming. Dua
ribu perbandingan 64 bit itu murah, dan ini menghindari pencarian jarak di SQL
yang rumit dan lambat.

### Migrasi

Kolom nullable, indeks komposit, tidak ada backfill (baris lama memang tidak
punya sidik).

**AWAS:** `.env.local` menunjuk Supabase **produksi**, jadi `prisma:migrate`
mengubah produksi langsung. Jalankan dengan sadar, dan hanya setelah owner tahu.

### Cache di ekstensi

`chrome.storage.local`, kunci sidik gambar, isi hasil risiko plus versi aturan
dan waktu. Dibuang kalau versi aturan berubah.

## Jalur panggilan

### A dan B numpang di panggilan yang sudah ada

`callGenerate` (`content.js:4695`) kirim `imageHash`. Server menjawab metadata
**dan** kabar duplikat sekaligus. Tidak ada perjalanan jaringan tambahan.

**Koreksi saat implementasi, 2026-09-17:** rute `/api/extension/generate` ternyata
tidak menulis `MetadataLog` sama sekali. Baris riwayat ditulis endpoint terpisah
`/api/extension/metadata-log`, yang dipanggil ekstensi sesudah metadata jadi.
Jadi tugasnya dibagi: **generate membaca** duplikat (satu query berindeks,
dijalankan berbarengan dengan panggilan AI), **metadata-log menulis** sidiknya.
Hasilnya sama, tetap nol permintaan tambahan.

Aturan marketplace sendiri dikirim menumpang di `/api/extension/me`, rute yang
sudah dipanggil ekstensi saat cek akun, dengan alasan yang sama seperti `update`
dan `allMarketplaces` yang sudah lebih dulu menumpang di sana.

A jalan di dalam `generateMetadataFromImage`, **setelah**
`normalizeKeywordsForStock` selesai, tepat sebelum `return finalMetadata`, supaya
keduanya tidak bertengkar.

### Yang dibetulkan mesin, dan yang cuma ditandai

Dibetulkan (jawabannya cuma satu):

- judul melebihi batas, dipotong di batas kata terdekat, bukan di tengah kata
- keyword kembar dibuang
- kata terlarang dibuang (`canva` di Canva termasuk, walau prompt sudah
  melarangnya ia masih kadang lolos)
- keyword melebihi batas, dipotong dari ekor karena ekor yang paling tidak
  penting
- kategori kosong diisi dari usulan AI

Ditandai saja (lebih dari satu cara membetulkan, jadi itu keputusan manusia):
deskripsi kosong, keyword jauh di bawah target, judul yang jadi janggal setelah
dipotong, dan duplikat gambar.

**Duplikat tidak pernah menahan generate.** Metadata tetap dibuat dan tetap masuk
form. Kadang mengirim beberapa variasi memang disengaja, dan menahan pekerjaan
orang karena tebakan mesin ongkosnya lebih besar daripada manfaatnya.

Laporannya masuk ke panel `Progress Generate Metadata` yang sudah ada
(`content.js:5378`), satu ekor per baris gambar: `3 dibetulkan, 1 perlu dilihat`,
bisa diklik. Untuk generate satu gambar, lewat toast yang sudah ada.

Kalau aturan dari server belum sempat terambil, dipakai salinan bawaan. Kalau itu
pun tidak ada, A dilewati dan **dikatakan terus terang** di panel, bukan diam
diam dianggap lolos.

### C memakai prompt baru, bukan `reject`

Prompt `risiko` bertanya: kalau gambar ini dikirim ke marketplace ini, apa yang
paling mungkin membuatnya ditolak, dan seberapa yakin. Prompt harus menyatakan
bahwa "tidak ada" itu jawaban yang benar dan sering.

```
{ "risiko": "aman|perlu dilihat|berisiko",
  "alasan": [{"sebab": "", "yakin": "rendah|sedang|tinggi", "tindakan": ""}],
  "butuhRelease": true|false }
```

Cap token sekitar 500, bukan 1024 seperti `reject`. `reject` menulis judul,
deskripsi, dan 12 sampai 40 keyword usulan; `risiko` tidak menulis metadata sama
sekali. Karena C jalan otomatis per gambar, ukuran jawaban langsung jadi tarif
per gambar.

`reject` lama **tetap hidup dan tidak berubah** di halaman aset yang sudah
dikirim (`scopeEligibleForRejectAnalyzer`). C adalah pemicu baru di tempat baru,
yaitu halaman upload sebelum kirim.

### D: satu panggilan, tiga jawaban

Prompt gabungan mengembalikan skor keseluruhan, tujuan komersial, dan **skor
relevansi per keyword**. Yang ketiga itu yang baru, dan tanpa itu hitung ulang
lokal tidak punya titik berangkat.

Skor terdiri dari empat bagian, bobotnya dari `Setting`:

| Bagian | Dihitung siapa | Hitung ulang lokal |
|---|---|---|
| Relevansi keyword terhadap gambar | AI | Tidak, butuh mata |
| Keunikan antar keyword | Lokal | Ya, seketika |
| Bentuk frasa, imbang head dan long-tail | Lokal | Ya, seketika |
| Kepatuhan aturan marketplace | Lokal | Ya, seketika |

Rumus yang sudah terbukti jalan di mockup dan jadi acuan implementasi:

- **Kembar**: dua keyword dianggap kembar kalau kata pentingnya (lebih dari 2
  huruf) beririsan 0,66 atau lebih terhadap yang lebih pendek. Ambang itu
  menangkap `business meeting` dan `business meeting team`, tapi tidak menyatukan
  `office team` dengan `modern office`.
- **Keunikan** = `100 - (jumlah kembar / jumlah keyword) * 140`, dibatasi 0.
- **Bentuk** = 100 kalau porsi frasa 2 sampai 4 kata ada di 0,4 sampai 0,75;
  di luar itu turun 200 poin per satuan jarak.
- **Kepatuhan** = 100, dikurangi 25 per kata terlarang, 10 per keyword lebih dari
  4 kata, 30 kalau jumlah keyword melebihi batas.
- **Total** = rata rata berbobot. Kalau belum ada satu pun keyword yang dinilai
  AI, total dihitung dari tiga bagian lokal saja dengan bobot dinormalkan ulang,
  dan panel mengatakannya.

Skor ditampilkan sebagai **bilangan bulat dengan label** (`72, cukup`), tidak
pernah `72,4`. Ketelitian satu angka di belakang koma itu bohong halus pada
penilaian yang sifatnya perkiraan.

Tombol `Tulis ke form` memasukkan keyword hasil suntingan lewat
`fillKeywordsField` yang sudah ada. Tanpa tombol ini, D cuma jadi panel saran
yang keempat.

Nama tombol gabungannya **`Skor Gambar`**, berbahasa Indonesia mengikuti bahasa
kerja proyek. `AI Scoring Agent` dan `Commercial Intent Analyzer` dicopot,
`Keyword AI` tetap dengan namanya sekarang.

## Layar

Bentuknya sudah disetujui lewat mockup interaktif di atas. Yang mengikat:

- Badge menempel di **kanan bawah** gambar. Tengah gambar adalah area klik milik
  marketplace, dan sudut kanan bawah yang paling jarang dipakai. Klik badge tidak
  boleh diteruskan ke gambar.
- Enam keadaan badge, masing masing menyebut **sebab dan tindakan**, bukan "tidak
  ada data": menunggu antrean, memeriksa, selesai, dijeda karena poin menipis,
  gagal (bisa diulang), dan mati karena saklar dimatikan.
- Keadaan dibedakan **ikon dan kata, bukan cuma warna**.
- Tanda duplikat dari B numpang di badge yang sama, supaya kontributor tidak
  perlu melihat dua tempat untuk satu pertanyaan.
- Tiap baris keyword di panel D membawa **sebabnya**, bukan cuma angkanya:
  `kembar dengan business meeting`, `kata terlarang: canva`, `terlalu panjang`,
  `belum dinilai AI`.

Warna, huruf, dan radius dari `DESIGN.md` bahasa Presisi: navy `#16233D`, aksen
`#3B65C4`, Inter untuk teks, IBM Plex Mono untuk angka dan label, kartu 12px,
kontrol 8px. Kontras yang sudah dihitung dan dipakai di mockup: muted 5,99:1,
success 5,48:1, warning 5,02:1, danger 6,28:1, putih di navy 15,65:1.

## Rem dan gerbang

- **Saklar mati di popup**, centang seperti `saranKeyword` yang sudah ada
  (`popup.html:64`), menyala secara bawaan. Fitur yang membelanjakan uang orang
  secara otomatis harus bisa dimatikan tanpa mencopot ekstensi.
- **Berhenti saat poin menipis.** Di bawah ambang, antrean berhenti sendiri dan
  badge mengatakannya, bukan diam diam menghabiskan sisa saldo sampai generate
  metadata (pekerjaan utamanya) ikut gagal. Ambangnya satu nilai di
  `extension_guard_rules`, bukan angka tertanam di kode, supaya bisa disetel
  tanpa rilis ekstensi. Nilai awalnya diusulkan saat implementasi dan disetujui
  owner di situ, karena ia bergantung pada ongkos nyata per gambar yang baru
  terukur setelah prompt `risiko` jadi.
- **Cakupan dibatasi** ke halaman kontributor yang sudah dikenali
  `marketplace-resolve.js`, bukan semua gambar di semua situs.

## Uji

1. **Mesin murni, `node --test`**, pola `scripts/suggestion-merge.test.mjs`:
   perbaikan (judul kepanjangan dipotong di batas kata, kata terlarang, kembar,
   batas jumlah, kategori kosong), kembar pada ambang 0,66 termasuk pasangan yang
   **tidak** boleh dianggap kembar, skor empat bagian termasuk jalur "belum ada
   relevansi", dan sidik dHash (gambar sama menghasilkan sidik sama, gambar beda
   berjarak besar).
2. **`nerona-web`, vitest**: pembacaan `Setting` dengan jatuhnya ke env dan
   bawaan, pencarian duplikat (persis dan jarak dekat), dan golden test prompt
   yang diperbarui dengan sadar.
3. **Layar**: potret badge di enam keadaan dan panel D, diukur, plus **uji
   klik-tembus**: badge tidak boleh menutupi tombol milik marketplace dan tidak
   boleh menelan klik yang seharusnya sampai ke halaman. Ini bagian Delivery
   Gate, dibuktikan dengan bukti, bukan centang.

## Di luar lingkup

- Mengubah `reject` lama atau memindahkannya.
- Menilai mutu teknis gambar secara lokal (noise, fokus, resolusi) tanpa AI.
- Menarik alasan penolakan sungguhan dari marketplace untuk dibandingkan dengan
  tebakan C. Itu yang akan membuat C bisa dikalibrasi, dan itu proyek sendiri.
- Menyatukan `Keyword AI` ke panel gabungan. Ia menjawab pertanyaan lain (tren
  bulan depan), bukan pertanyaan tentang gambar ini.

## Urutan kerja

1. Mesin murni plus tesnya, tanpa menyentuh UI: `perbaikan`, `sidik`, `skor`,
   `aturan`.
2. `Setting` dan pembacanya di `nerona-web`, dengan bawaan yang sama persis
   dengan salinan bawaan di ekstensi.
3. A dan B: kolom `MetadataLog`, migrasi, `imageHash` di `callGenerate`,
   sisipan di `generateMetadataFromImage`, laporan di panel progress.
4. C: prompt `risiko`, saklar popup, `IntersectionObserver`, antrean konkurensi
   1, cache, badge enam keadaan.
5. D: prompt gabungan, golden test diperbarui, panel skor, tulis ke form, tombol
   `Commercial Intent Analyzer` dicopot.

Nomor 1 dan 2 tidak mengubah apa pun yang dilihat kontributor, jadi aman
dikerjakan lebih dulu dan dipakai untuk memastikan rumusnya benar sebelum ada
satu pun piksel yang berubah.

## Jebakan yang sudah diketahui

- `.env.local` menunjuk Supabase produksi (lihat Migrasi).
- Golden test prompt akan merah begitu prompt gabungan masuk. Itu diharapkan,
  perbarui dengan sadar dan jangan hapus tesnya.
- `content.js` mengandung bita non-UTF8, jadi `grep -l` bisa menganggapnya biner
  dan diam. Pakai `grep -a`.
- **dHash menyamakan gambar yang nyaris rata.** Terbukti di harness 2026-09-17:
  enam gambar gradien yang berbeda warna semuanya menghasilkan sidik
  `ffffffffffffffff`, karena dHash cuma membandingkan terang piksel dengan
  tetangga kanannya dan arah gradiennya sama. Untuk foto ini hampir tidak
  pernah terjadi, tapi kontributor vektor dan desain datar bisa kena: dua
  ilustrasi berlatar polos bisa tertuduh duplikat, dan cache risiko bisa
  menyajikan hasil gambar lain. Kalau itu muncul, penawarnya murah (bandingkan
  juga rasio sisi dan rata-rata terang sebelum menyebut duplikat), tapi jangan
  dikerjakan sebelum ada keluhan nyata.
- Menggambar ulang daftar keyword pada tiap ketikan akan melempar kursor keluar
  dari kotak yang sedang diketik. Di mockup ini dipecah: yang bergerak tiap
  ketikan hanya angka dan meter, daftar dibangun ulang saat `blur`.
