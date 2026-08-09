# Sekali bayar, akses selamanya, poin yang dibeli ulang

Tanggal: 2026-08-09
Cakupan repo: `nerona-web`

## Perubahan

Pilihan durasi 1/3/6/12 bulan dihapus. Satu pembelian memberi **lisensi tanpa
tanggal akhir** plus poin sejatah satu bulan. Sesudah itu satu-satunya yang
dibeli ulang adalah poin.

| | lama | baru |
| --- | --- | --- |
| yang dibeli | akses 1/3/6/12 bulan | akses selamanya, sekali |
| harga Pro | Rp 49.000/bulan × durasi − diskon | **Rp 79.000 sekali** |
| harga Business | Rp 109.000/bulan × durasi − diskon | **Rp 169.000 sekali** |
| poin saat aktivasi | jatah bulanan × durasi | jatah **1 bulan** |
| pendapatan berulang | perpanjangan lisensi | **top-up poin** |

Top-up jadi: 500 = Rp 29.000, 1.100 = Rp 59.000, 2.500 = Rp 99.000.

## Keputusan owner

1. Lisensi **tidak pernah berakhir**. Poin satu-satunya yang dibeli ulang.
2. Lisensi 1/3/6/12 bulan yang sudah berjalan **dibiarkan habis** pada waktunya.
3. Perpanjangan otomatis **dimatikan**, kodenya ditinggal.
4. Harga sekali bayar memakai angka di atas.
5. Halaman harga menampilkan **harga sekali bayar + isi poin + akses selamanya**,
   bukan "/bulan".

## Yang memudahkan: seumur hidup sudah ada

Lisensi `Free` sudah dibuat **tanpa `validUntil`**, dan `getExtensionAccountState`
sudah membaca `validUntil == null` sebagai aktif tanpa batas. Jadi "seumur hidup"
bukan konsep baru — ia keadaan yang sudah didukung seluruh sistem dan baru
dipakai satu paket.

Akibatnya perubahan ini menghapus lebih banyak kode daripada menambah.

## Bagian 1 — Lisensi permanen

`grantLicense` menerima `permanen?: boolean`. Saat `true`, `validUntil` ditulis
`null` alih-alih `activationExpiryFrom(...)`.

**Bukan** dengan membiarkan `validUntil` `undefined`: di sana `??` sudah jatuh ke
tanggal kedaluwarsa, dan menyalahartikan "tidak disebut" sebagai "tanpa batas"
akan membuat setiap pemberian manual admin ikut jadi permanen tanpa ada yang
memintanya.

`durationMonths` tetap ditulis `1` — kolomnya dipakai kelipatan poin, dan poin
yang diberikan memang sejatah satu bulan.

## Bagian 2 — Order tanpa durasi

`createOrder` berhenti menerima `durationMonths` dari klien. Order paket selalu
berarti satu pembelian; kolomnya tetap ditulis `1` supaya baris lama dan baru
punya bentuk yang sama.

Harga diambil langsung dari `Plan.priceMonthly` **tanpa dikalikan apa pun**.

`PLAN_DURATIONS` dan penghitung diskon **tidak dihapus**: order dan lisensi lama
masih menyimpan durasinya, dan halaman riwayat masih menampilkannya. Yang hilang
cuma pemakaiannya untuk pembelian baru.

## Bagian 3 — Halaman harga dan checkout

Pemilih durasi dibuang. Kartu paket menampilkan satu harga, jumlah poin yang
disertakan, dan kalimat akses selamanya.

Panel harga admin kehilangan tiga kolom diskon durasi; yang tersisa harga per
paket.

## Bagian 4 — Perpanjangan otomatis dimatikan

Kunci `Setting` baru `auto_renew_enabled`. Kosong atau apa pun selain `"1"`
berarti **mati**, dan `generateDueRenewals` berhenti di baris pertama.

Bawaannya mati, dan itu disengaja: alur baru tidak punya yang perlu diperpanjang,
jadi keadaan aman adalah tidak melakukan apa-apa. Kunci yang lupa diisi tidak
boleh menagih siapa pun.

Kodenya ditinggal utuh — kalau arah ini berubah, yang perlu dikerjakan cuma
mengisi satu kunci.

## Yang sengaja tidak dikerjakan

- **`Plan.priceMonthly` tidak diganti nama.** Artinya berubah jadi harga sekali
  bayar, dan namanya jadi berbohong. Mengganti nama kolom menyentuh migrasi dan
  belasan berkas untuk keuntungan yang hari ini murni kosmetik — dicatat sebagai
  utang, bukan diabaikan.
- **Lisensi lama tidak dikonversi.** Mereka habis pada waktunya lalu pemiliknya
  masuk alur baru.
- **Harga tidak dipasang oleh kode ini.** Ia langkah cutover terakhir, sesudah
  checkout barunya hidup — memasangnya lebih dulu membuat pembeli 12 bulan
  membayar 79.000 × 12.

## Konsekuensi yang diterima

Pengguna yang jarang generate praktis berhenti membayar setelah pembelian
pertama: Pro memberi 300 generate, dan 20 gambar sebulan berarti 15 bulan
sebelum perlu membeli poin.

Paket masuk 2,3–3,3 kali lebih mahal per poin daripada top-up. Itu disengaja —
yang dibayar adalah akses selamanya, bukan poinnya — dan halaman harga wajib
mengatakannya, karena tanpa itu ia terbaca sebagai paket masuk yang buruk.

Business harus dibenarkan oleh Nerona Hub, bukan jatah poinnya.

## Yang terbukti dan yang tidak

Bisa dites: lisensi baru tanpa `validUntil`, poin sejatah satu bulan, harga tidak
dikalikan durasi, order menolak durasi dari klien, dan `generateDueRenewals`
berhenti saat saklarnya mati.

**Tidak** bisa dibuktikan agen: bahwa halaman harga dan checkout benar-benar
merender bentuk barunya — repo ini tidak punya harness render komponen.
