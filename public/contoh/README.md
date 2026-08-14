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
- **Sekitar 1200–1600px sisi panjang.** Ini batas dua arah, dan dua-duanya
  pernah kena. Ekspor vektor resolusi penuh bisa 11.000px dan 1MB lebih —
  memperberat repo tanpa menambah apa pun, karena halaman tidak pernah
  menampilkannya sebesar itu. Sebaliknya berkas 220px akan pecah: kartunya
  merender gambar sekitar 600px, dan bukti yang pecah melemahkan persis hal
  yang sedang dibuktikan.
- Di bawah ~300KB per berkas. PNG boleh kalau karyanya vektor datar dengan
  warna sedikit; kalau ada gradien atau foto, JPEG jauh lebih kecil.
- Latar transparan boleh — karyanya dimuat penuh ke dalam bingkai, tidak
  diisikan sampai terpotong, jadi tidak ada tepi yang terpenggal dan bagian
  kosongnya menampilkan permukaan kartu.
