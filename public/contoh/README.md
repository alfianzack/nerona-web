# Karya contoh untuk bagian bukti di halaman depan

Dua entri di `src/lib/marketing-samples.ts` sudah berisi metadata sungguhan —
judul dan seluruh kata kuncinya disalin apa adanya dari panel ekstensi. Yang
belum ada tinggal berkas karyanya.

## Yang perlu ditaruh di folder ini

| Berkas | Karyanya |
|---|---|
| `forklift-oranye.png` | Ilustrasi vektor forklift oranye bergaya datar (yang di-generate untuk Canva) |
| `anak-muslim-belajar.png` | Ilustrasi sekelompok anak muslim duduk belajar dan menulis bersama (yang di-generate untuk Adobe Stock) |

Nama berkasnya harus persis seperti di tabel, karena `marketing-samples.ts`
sudah menunjuk ke sana.

## Setelah berkasnya ditaruh

Buka `src/lib/marketing-samples.ts`, ubah `imageReady: false` menjadi
`imageReady: true` pada entri yang berkasnya sudah ada. Boleh satu per satu —
entri yang masih `false` cuma dilewati, tidak merusak apa pun.

Gerbang itu ada karena gambar yang berkasnya tidak ada **tidak gagal dengan
rapi**: peramban menggambar ikon rusak, tepat di bagian yang tugasnya membuat
halaman terlihat mapan. Memeriksa keberadaan berkas secara otomatis sengaja
tidak dipakai — isi `public/` dilayani CDN dan tidak dijamin ikut ke sistem
berkas fungsi serverless, jadi pemeriksaan semacam itu bisa benar di mesin
lokal tapi salah di produksi.

## Syarat berkasnya

- Karya milik sendiri. Berkas ini terbit di domain Nerona, jadi lisensinya
  harus benar-benar milik Anda.
- Lanskap, sekitar 1200–1600px sisi panjang. Lebih besar hanya memperberat
  repo; halaman tidak pernah menampilkannya sebesar itu.
- Di bawah ~300KB per berkas. PNG boleh kalau karyanya vektor datar dengan
  warna sedikit; kalau ada gradien atau foto, JPEG jauh lebih kecil.
- Subjek pentingnya jangan menempel di tepi bingkai. Di layar sempit
  gambarnya dipotong 4:3, dan di layar lebar diisikan penuh ke kolomnya
  dengan bagian berlebih terpotong.
