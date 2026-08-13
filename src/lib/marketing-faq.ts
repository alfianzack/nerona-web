import { CLAIMABLE_MARKETPLACES } from "./marketplaces";

/**
 * Pertanyaan umum beranda Nerona Metadata.
 *
 * Dipindah keluar dari HomeMetadataOnly karena daftarnya tumbuh dari lima ke
 * sepuluh, dan karena setiap jawaban di sini adalah KLAIM. Aturannya sama
 * dengan yang dijaga ContributorPainSection dan spec marketing-honesty: satu
 * kalimat boleh berdiri di halaman ini hanya kalau ia bisa ditelusuri ke satu
 * baris kode. Sumber tiap jawaban baru ditulis tepat di atas pertanyaannya —
 * kalau kode yang disebut berubah, jawabannya ikut salah, dan memang itu
 * maksudnya.
 *
 * Dua kebiasaan yang sengaja dipakai di seluruh berkas ini:
 *
 * 1. Kalau jawaban yang benar butuh angka yang bisa diubah owner dari
 *    Pengaturan (harga, jatah poin), pertanyaannya menunjuk ke tabel harga
 *    alih-alih menyalin angkanya. Angka yang disalin ke dua tempat akan
 *    berbeda dari yang sebenarnya dalam beberapa minggu.
 * 2. Kalau kode hanya MEMINTA sesuatu ke model tanpa memaksakannya, jawabannya
 *    menyebutkan batas itu (lihat pertanyaan soal merek). Jaminan yang tidak
 *    dijaga kode adalah jaminan yang akan dilanggar di depan pengguna.
 *
 * Satu pertanyaan yang sempat ditulis lalu dibuang: "Apa bedanya Free, Pro,
 * dan Business?". Jawabannya persis isi tabel harga yang berdiri tepat di atas
 * bagian ini di beranda, dan keempat pembedanya (marketplace, jatah poin,
 * reject analyzer, Nerona Hub) datang dari baris Plan di basis data — jadi
 * versi teksnya akan basi tanpa ada yang tahu.
 */

/** Sama persis dengan MARKETPLACE_NAMES di HomeMetadataOnly — satu sumber angka. */
const MARKETPLACE_NAMES = CLAIMABLE_MARKETPLACES.map((m) => m.label).join(", ");

export interface MarketingFaqItem {
  question: string;
  answer: string;
}

export const METADATA_FAQ: MarketingFaqItem[] = [
  {
    question: "Apakah saya perlu kartu kredit untuk mulai?",
    answer:
      "Tidak. Paket Free aktif seketika setelah daftar, tanpa data pembayaran apa pun. Free adalah poin percobaan sekali per akun, bukan kuota bulanan.",
  },
  {
    question: "Marketplace apa saja yang didukung?",
    answer: `${MARKETPLACE_NAMES}.`,
  },

  /**
   * Sumber: nerona_medata/content.js — pengambilan gambar hanya lewat elemen
   * gambar di halaman (`img[src]`, dipakai di picker maupun batch), lalu
   * digambar ulang ke canvas. Tidak ada satu pun jalur yang membaca elemen
   * video, dan tidak ada adapter marketplace video di nerona_medata/marketplaces/.
   * Vecteezy punya perlakuan tersendiri di dua tempat: aturan judul dan
   * penyaring kata kunci di content.js (VECTEEZY_TITLE_MIN_WORDS,
   * sanitizeVecteezyKeywords) serta petunjuk khusus di buildMetadataPrompt.
   */
  {
    question: "Bisa dipakai untuk vektor, atau cuma foto?",
    answer:
      "Bisa. Yang dibaca alat ini adalah gambar pratinjau yang sudah tampil di halaman unggah, jadi vektor, ilustrasi, dan render 3D diperlakukan sama seperti foto — Vecteezy bahkan punya aturan judul dan kata kuncinya sendiri di dalam alat. Video belum didukung: yang dibaca ekstensi adalah gambar di halaman, dan berkas video tidak muncul sebagai gambar.",
  },

  /**
   * Sumber: src/lib/extension/prompts.ts. Kedua prompt metadata (quick dan
   * advanced) menyebut "English." lalu menutup dengan "Keywords must be
   * readable English only"; prompt reject analyzer dan commercial intent
   * menambahkan "English only for JSON string values". Tidak ada opsi bahasa di
   * mana pun — pencarian "language" di content.js dan popup.js kosong.
   */
  {
    question: "Metadata yang dihasilkan berbahasa apa?",
    answer:
      "Inggris, selalu. Adobe Stock dan Shutterstock menilai metadata dalam bahasa Inggris, jadi prompt produksi kami meminta bahasa Inggris untuk judul, deskripsi, dan setiap kata kunci — tidak ada saklar bahasa yang bisa mengubahnya. Antarmuka Nerona tetap bahasa Indonesia; yang berbahasa Inggris hanya isi metadatanya.",
  },

  /**
   * Sumber: prompts.ts meminta "exactly 50 strings", lalu content.js memotong
   * sesuai tujuan di getMarketplaceKeywordMax — Canva 20 (komentarnya menyebut
   * chip ke-21 ditolak diam-diam), Miricanvas 25, sisanya 50. Pembuangan
   * duplikat, kata sambung yang berdiri sendiri, dan tag placeholder ada di
   * isBlockedMarketplaceKeyword + KEYWORD_STANDALONE_STOPWORDS.
   */
  {
    question: "Berapa kata kunci yang dihasilkan per gambar?",
    answer:
      "Sampai 50, dan jumlahnya mengikuti batas marketplace tujuan: Canva 20, Miricanvas 25, sisanya 50. Duplikat, kata sambung yang berdiri sendiri seperti “for” atau “with”, dan tag sisa format dibuang sebelum kata kuncinya masuk ke formulir.",
  },

  /**
   * Sumber: prompts.ts. Prompt quick melarang "Do NOT invent locations, brands,
   * events, identities, statistics, or copyrighted terms"; prompt advanced
   * menutup daftar kata kuncinya dengan "no duplicates, spam, misleading tags,
   * copyrighted brands, celebrity names, or invented facts".
   *
   * Peringatan di kalimat terakhir bukan basa-basi: penyaring kata kunci di
   * content.js (isBlockedMarketplaceKeyword) memeriksa duplikat, stopword,
   * placeholder, dan kata kasar — TIDAK ada daftar merek di dalamnya. Jadi yang
   * kita punya adalah instruksi ke model, bukan penjaga di kode, dan kalimatnya
   * harus mengaku begitu.
   */
  {
    question: "Apakah nama merek atau logo ikut jadi kata kunci?",
    answer:
      "Tidak seharusnya. Prompt kami melarang merek berhak cipta, nama selebritas, dan mengarang lokasi atau peristiwa yang tidak terlihat di gambar — persis yang bikin metadata ditolak. Yang perlu Anda tahu: itu instruksi ke AI, bukan daftar-hitam merek di sisi kami, jadi kalau ada logo yang benar-benar terlihat di karya Anda, periksa sekali sebelum kirim.",
  },

  /**
   * Sumber, tiga tempat:
   * - nerona_medata/content.js: NERONA_VISION_MAX_EDGE = 1280 dan
   *   imageElementToInlineDataViaCanvas — gambar diambil dari elemen di
   *   halaman, diperkecil, lalu dijadikan JPEG di browser.
   * - src/app/api/extension/generate/route.ts: gambar dipakai sekali untuk satu
   *   panggilan AI dan diteruskan apa adanya. Tidak ada penulisan berkas, tidak
   *   ada kolom basis data, tidak ada penyimpanan objek di seluruh jalur itu.
   * - src/lib/metadata-log.ts: satu-satunya yang tersimpan setelahnya —
   *   marketplace, pageUrl, title, keywords, keywordCount.
   */
  {
    question: "Gambar saya diunggah ke server Nerona?",
    answer:
      "Berkas asli di komputer Anda tidak pernah dibuka. Yang dikirim adalah salinan kecil dari pratinjau yang sudah tampil di halaman unggah — diperkecil sampai sisi terpanjang 1280 piksel dan dijadikan JPEG di browser Anda, dipakai sekali untuk dibaca AI, lalu tidak disimpan. Yang tersimpan hanya baris riwayat: marketplace, alamat halaman, judul, dan kata kunci hasilnya.",
  },

  {
    question: "Apa itu poin, dan bagaimana kalau habis?",
    answer:
      "Poin terpakai setiap kali AI bekerja — besarnya tergantung gambar dan panjang teks yang diproses. Alat berhenti sementara kalau poin habis; mengaktifkan atau memperpanjang paket menambahkan poin baru. Poin yang belum terpakai tidak hangus.",
  },
  {
    question: "Bagaimana cara memasang ekstensinya?",
    answer:
      "Unduh folder ekstensi dari halaman Profile Anda, lalu muat lewat Chrome dengan Load unpacked. Belum melalui Chrome Web Store, jadi pembaruan kami beritahukan dari dalam aplikasi.",
  },
  {
    question: "Bagaimana cara pembayarannya?",
    answer:
      "Lewat transfer bank. Pilih paket, kirim order, transfer sesuai nominal, lalu unggah bukti transfer — tim kami memverifikasi dan mengaktifkan akun Anda, biasanya di hari yang sama.",
  },
];
