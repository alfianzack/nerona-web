/**
 * Contoh keluaran sungguhan untuk halaman jualan.
 *
 * Satu entri = satu foto milik Anda sendiri, berdampingan dengan metadata yang
 * Nerona benar-benar hasilkan untuk foto itu. Bagian ProofSection membacanya;
 * selama array ini kosong, bagian itu tidak dirender sama sekali, jadi halaman
 * tidak pernah memajang bingkai gambar kosong sambil menunggu asetnya.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * KENAPA ISINYA WAJIB HASIL SUNGGUHAN
 * ─────────────────────────────────────────────────────────────────────────
 * Ini satu-satunya bagian di halaman yang membiarkan pengunjung menilai mutu AI
 * dengan matanya sendiri. Kontributor stock berpengalaman membaca dua belas kata
 * kunci dan langsung tahu apakah alatnya paham gambar atau cuma menebak; itulah
 * yang membuat bagian ini bekerja, dan itu juga yang hilang begitu kata kuncinya
 * dikarang. Kata kunci karangan selalu terlalu rapi — tidak ada istilah niche,
 * tidak ada frasa panjang, tidak ada satu pun kata yang hanya masuk akal kalau
 * si penulis benar-benar melihat fotonya.
 *
 * Aturan ini bukan selera. Repo ini punya kebijakan tertulis (lihat
 * docs/superpowers/specs/2026-07-29-marketing-honesty-design.md dan komentar di
 * lib/marketplaces.ts): setiap klaim di halaman pemasaran harus bisa dibuktikan
 * dari kode atau basis data, dan kalau ragu, KURANGI. Satu contoh yang benar
 * lebih kuat daripada empat yang disusun dari angan-angan — dan jauh lebih aman
 * daripada dituduh memasarkan keluaran yang tidak pernah ada.
 *
 * Yang juga tidak boleh: foto stock milik orang lain, foto hasil pencarian, dan
 * keluaran alat pesaing. Foto di sini terbit di domain Anda sendiri, jadi
 * lisensinya harus benar-benar milik Anda.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * BAHASA
 * ─────────────────────────────────────────────────────────────────────────
 * `title`, `description`, dan `keywords` WAJIB berbahasa Inggris — salin apa
 * adanya, jangan diterjemahkan. Prompt produksi di lib/extension/prompts.ts
 * menuliskan "English only" tiga kali karena Adobe Stock dan Shutterstock memang
 * menuntutnya. Contoh berbahasa Indonesia memberi tahu kontributor berpengalaman
 * bahwa karyanya akan ditolak marketplace.
 *
 * `alt` justru sebaliknya: bahasa Indonesia, karena itu teks antarmuka yang
 * dibacakan pembaca layar kepada pengunjung Indonesia. Isinya menggambarkan
 * FOTONYA ("Sawah terasering berundak saat kabut pagi"), bukan mengulang judul
 * metadata — pembaca layar sudah akan membaca judulnya beberapa baris kemudian.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DARI MANA MENGAMBIL SETIAP KOLOM
 * ─────────────────────────────────────────────────────────────────────────
 * Jalankan Nerona seperti biasa atas foto Anda sendiri, lalu salin hasilnya:
 *
 * - `title`, `description`, `keywords`  → dari panel ekstensi, saat metadata itu
 *   baru selesai dibuat. Deskripsi TIDAK tersimpan di basis data (model
 *   MetadataLog hanya menyimpan judul, kata kunci, dan jumlahnya), jadi ambil
 *   ketiganya sekaligus sebelum panelnya ditutup.
 * - `marketplace`, `keywordTotal`      → bisa dicocokkan belakangan di halaman
 *   Riwayat Metadata (/riwayat-metadata), yang menyimpan nama marketplace dan
 *   keywordCount untuk setiap generate.
 * - `seconds`                          → hitung sendiri saat generate berjalan;
 *   tidak ada yang mencatatnya. Tulis apa adanya, termasuk pecahannya.
 *
 * Jangan mengurutkan ulang `keywords`. Prompt memintanya "most important first",
 * dan dua belas yang ditampilkan adalah dua belas pertama — urutan itu bagian
 * dari yang sedang dibuktikan.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * GAMBARNYA
 * ─────────────────────────────────────────────────────────────────────────
 * Taruh berkasnya di public/contoh/ dan tulis `src` sebagai path absolut dari
 * akar situs, mis. "/contoh/sawah-terasering.jpg". ProofSection merendernya lewat
 * next/image dengan width/height eksplisit, jadi Next.js yang mengurus ukuran
 * turunan dan format modern — tapi berkas sumbernya tetap perlu wajar:
 *
 * - Lanskap, sekitar 1200–1600px sisi panjang. Lebih besar dari itu hanya
 *   memperberat repo; halaman tidak pernah menampilkannya sebesar itu.
 * - JPEG berkualitas wajar, usahakan di bawah ~300KB per berkas.
 * - Bidikan dipotong 4:3 di layar sempit, dan di layar lebar diisikan penuh ke
 *   kolomnya dengan bagian yang berlebih terpotong. Jadi hindari foto yang
 *   subjek pentingnya menempel di tepi bingkai.
 */

export interface MetadataSample {
  /** Path di /public, mis. "/contoh/sawah-terasering.jpg". */
  src: string;
  /** Bahasa Indonesia — menggambarkan foto, untuk pembaca layar. */
  alt: string;
  /** Nama marketplace tujuan, mis. "Adobe Stock". */
  marketplace: string;
  /** Lama generate dalam detik; pecahannya jangan dibulatkan. */
  seconds: number;
  /** BAHASA INGGRIS — judul yang benar-benar dihasilkan. */
  title: string;
  /** BAHASA INGGRIS — deskripsi yang benar-benar dihasilkan. */
  description: string;
  /**
   * BAHASA INGGRIS, urutan asli dari AI. Dua belas pertama yang ditampilkan;
   * sisanya boleh ikut ditulis, tapi tidak wajib.
   */
  keywords: string[];
  /** Jumlah kata kunci sebenarnya — tidak boleh lebih kecil dari keywords.length. */
  keywordTotal: number;
}

/**
 * Sengaja kosong sampai owner mengisinya dengan foto dan keluaran sungguhan.
 * Kosong berarti bagiannya tidak muncul; itu keadaan yang benar, bukan cacat.
 */
export const METADATA_SAMPLES: MetadataSample[] = [];
