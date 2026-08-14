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
  /** Path di /public, mis. "/contoh/forklift-oranye.png". */
  src: string;
  /**
   * Gerbang per-entri: entri baru dirender setelah berkas gambarnya
   * benar-benar ada di public/.
   *
   * Ada karena metadata dan gambarnya datang terpisah — teksnya bisa disalin
   * dari panel ekstensi seketika, sedangkan berkas karyanya menyusul. Tanpa
   * gerbang ini, entri yang sudah terisi teksnya akan menggambar ikon gambar
   * rusak di bagian yang justru tugasnya membuat halaman terlihat mapan.
   * Gambar yang berkasnya tidak ada tidak pernah gagal dengan rapi.
   */
  imageReady: boolean;
  /** Bahasa Indonesia — menggambarkan karyanya, untuk pembaca layar. */
  alt: string;
  /** Nama marketplace tujuan, mis. "Adobe Stock". */
  marketplace: string;
  /** BAHASA INGGRIS — judul yang benar-benar dihasilkan. */
  title: string;
  /**
   * BAHASA INGGRIS — deskripsi yang benar-benar dihasilkan, kalau ada.
   *
   * Opsional, karena panel ekstensi tidak selalu menampilkannya: pada alur
   * Canva dan Adobe Stock yang terlihat di layar, panelnya mencetak judul dan
   * kata kunci saja. Memaksakan kolom ini berarti mengarang kalimat yang tidak
   * pernah dihasilkan.
   */
  description?: string;
  /**
   * Lama generate dalam detik, kalau sempat diukur.
   *
   * Opsional karena tidak ada yang mencatatnya — bukan di basis data, bukan di
   * panel. Menuliskannya berarti mengukur sendiri dengan jam; menebaknya
   * berarti mengarang.
   */
  seconds?: number;
  /** BAHASA INGGRIS, urutan asli dari AI. Dua belas pertama yang ditampilkan. */
  keywords: string[];
  /** Jumlah kata kunci sebenarnya — tidak boleh lebih kecil dari keywords.length. */
  keywordTotal: number;
  /**
   * Plafon kata kunci marketplace tujuan, kalau generate ini menyentuhnya.
   *
   * Ini bukti terkuat yang bisa diberikan dua contoh sekaligus, dan tidak bisa
   * diberikan satu contoh saja: Canva menerima maksimum 20 kata kunci dan
   * generate-nya berhenti tepat di 20, sementara Adobe Stock yang berplafon
   * jauh lebih tinggi mendapat 33 — sebanyak yang gambarnya memang pantas
   * dapat. Dua angka berbeda dari satu alat memperlihatkan alatnya tahu tujuan
   * unggahnya, bukan memuntahkan daftar yang sama ke mana-mana.
   *
   * Isi HANYA kalau keywordTotal benar-benar menyentuh plafonnya. Kalau
   * angkanya di bawah plafon, mencantumkannya justru terbaca seperti kekurangan.
   */
  keywordCap?: number;
}

/**
 * Contoh sungguhan dari generate yang benar-benar dijalankan owner.
 *
 * Teksnya disalin apa adanya dari panel ekstensi — judul, kata kunci, dan
 * urutannya tidak diubah sama sekali. Perhatikan "rehal" di contoh kedua:
 * istilah penyangga kitab yang hanya muncul kalau AI-nya benar-benar melihat
 * gambarnya. Kata kunci karangan tidak pernah punya istilah senarrow itu, dan
 * itulah kenapa bagian ini bekerja.
 *
 * Keduanya masih `imageReady: false` karena berkas karyanya belum ada di
 * public/contoh/. Selama itu, ProofSection tidak merender apa pun.
 */
export const METADATA_SAMPLES: MetadataSample[] = [
  {
    src: "/contoh/forklift-oranye.png",
    imageReady: true,
    alt: "Ilustrasi vektor forklift oranye bergaya datar, tampak samping",
    marketplace: "Canva",
    title: "Orange Forklift Industrial Vehicle Vector Illustration",
    keywords: [
      "forklift",
      "industrial vehicle",
      "logistics",
      "construction equipment",
      "vector illustration",
      "supply chain",
      "orange",
      "flat design",
      "industrial machinery",
      "business icon",
      "forklift icon",
      "graphic design element",
      "industrial truck",
      "logistics icon",
      "flat vector",
      "simple graphic",
      "yellow forklift",
      "forklift truck",
    ],
    keywordTotal: 20,
    keywordCap: 20,
  },
  {
    src: "/contoh/anak-muslim-belajar.jpg",
    /**
     * Masih ditahan: berkas yang ada baru 220x111 piksel.
     *
     * Karyanya benar dan metadatanya sungguhan, tapi kartu ini merender
     * gambarnya sekitar 600 piksel — pada ukuran itu berkas sekecil ini pecah.
     * Bukti yang pecah melemahkan persis hal yang sedang dibuktikan, jadi satu
     * contoh yang tajam lebih baik daripada dua yang salah satunya buram.
     *
     * Ganti berkasnya dengan ekspor yang lebih besar (sekitar 1400 piksel sisi
     * panjang), lalu ubah baris di bawah jadi true.
     */
    imageReady: false,
    alt: "Ilustrasi sekelompok anak muslim duduk belajar dan menulis bersama",
    marketplace: "Adobe Stock",
    title: "Group of Muslim Children Studying and Writing Together",
    keywords: [
      "muslim children",
      "kids studying",
      "islamic education",
      "reading books",
      "ramadan kids",
      "student group",
      "learning together",
      "writing in notebook",
      "rehal",
      "quran study",
      "islamic school",
      "diverse children",
      "cute illustration",
      "vector art",
      "religious education",
      "glowing lanterns",
      "children character",
      "islamic culture",
      "study group",
      "education concept",
      "back to school",
      "ramadan kareem",
      "muslim lifestyle",
      "traditional decor",
      "cartoon children",
      "islamic studies",
      "youth group",
      "sitting on floor",
      "colorful illustration",
      "book stand",
      "child development",
      "primary school",
      "vector graphics",
    ],
    keywordTotal: 33,
  },
];
