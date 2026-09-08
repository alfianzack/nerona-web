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
  /**
   * Ikut tampil di beranda. Tanpa penanda ini, item hanya hidup di /faq.
   *
   * Satu daftar dengan penanda, BUKAN dua array. Dua array berarti jawaban
   * yang sama disalin dua kali, dan salinan kedua akan basi tanpa ada yang
   * tahu — persis kegagalan yang docblock di atas melarang untuk angka.
   *
   * Yang ditandai adalah enam pertanyaan yang MENGHALANGI pembelian: kartu
   * kredit, marketplace, privasi gambar, poin, pemasangan, pembayaran. Bukan
   * enam yang paling sering ditanya — beranda bukan tempat menjawab semua
   * pertanyaan, ia tempat menyingkirkan alasan untuk tidak mendaftar.
   */
  beranda?: true;
}

export interface MetadataFaqOptions {
  /**
   * Ongkos satu gambar dalam poin, dari lib/marketing-points.ts. `null` berarti
   * tarifnya belum bisa dihitung — dan patokannya HILANG, bukan ditebak.
   *
   * Diterima sebagai argumen, tidak dibaca di dalam berkas ini: daftar ini
   * murni data dan tidak menyentuh basis data, sehingga tetap bisa diuji tanpa
   * satu mock pun.
   */
  poinPerGambar: number | null;
}

/**
 * Kalimat patokan poin, atau string kosong kalau tarifnya belum diketahui.
 *
 * Angkanya TIDAK boleh diketik ke dalam jawaban. Tarif model adalah baris yang
 * owner sunting dari /admin, jadi angka yang disalin ke sini akan berbeda dari
 * yang benar-benar dipotong dari saldo — lihat docblock marketing-points.ts.
 */
function patokan(poinPerGambar: number | null): string {
  if (poinPerGambar === null || poinPerGambar <= 0) return "";
  return ` Dengan model bawaan hari ini, satu gambar memakai sekitar ${poinPerGambar.toLocaleString("id-ID")} poin — jadi Anda bisa memperkirakan sendiri berapa gambar yang tercakup sebuah paket.`;
}

export function metadataFaq({ poinPerGambar }: MetadataFaqOptions): MarketingFaqItem[] {
    return [
    {
      question: "Apakah saya perlu kartu kredit untuk mulai?",
      beranda: true,
      answer:
        "Tidak. Paket Free aktif seketika setelah daftar, tanpa data pembayaran apa pun. Free adalah poin percobaan sekali per akun, bukan kuota bulanan.",
    },
    /**
     * Dua nama terakhir diberi keterangan, dan keterangannya DOMAIN — bukan
     * deskripsi.
     *
     * Magnific dan Miricanvas tidak familiar bagi sebagian besar kontributor
     * stock, dan daftar berisi nama yang tidak dikenali membuat seluruh
     * daftarnya terbaca lebih lemah. Yang dipakai untuk menerangkannya adalah
     * satu-satunya hal yang bisa dibuktikan dari kode: pola host di
     * nerona_medata/manifest.json, yaitu contributor.magnific.com dan
     * designhub.miricanvas.com. Menuliskan "platform desain asal Korea" atau
     * sejenisnya berarti mengarang keterangan tentang perusahaan orang lain di
     * halaman jualan kita sendiri.
     *
     * Kalimatnya dirakit dari MARKETPLACE_NAMES, bukan mengetik ulang
     * ketujuhnya: daftar itu diturunkan dari registry, dan mengetiknya di sini
     * berarti nama kedelapan yang ditambahkan nanti tidak pernah muncul.
     */
    {
      question: "Marketplace apa saja yang didukung?",
      beranda: true,
      answer: `${MARKETPLACE_NAMES}. Dua yang terakhir adalah portal kontributor: Magnific di contributor.magnific.com dan Miricanvas di designhub.miricanvas.com.`,
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
     *
     * Sejak 2026-08-21 tidak semua kata kunci datang dari AI: kalau halaman
     * marketplace menawarkan saran sendiri, saran itu dipakai lebih dulu dan sisa
     * slot diisi keluaran AI (marketplaces/suggestion-merge.js di extension).
     * Plafonnya tidak berubah — yang berubah asalnya, jadi pertanyaannya tidak
     * lagi bisa dijawab dengan "semuanya dari AI".
     */
    {
      question: "Berapa kata kunci yang dihasilkan per gambar?",
      answer:
        "Sampai 50, dan jumlahnya mengikuti batas marketplace tujuan: Canva 20, Miricanvas 25, sisanya 50. Kalau halaman unggahnya sendiri sudah menawarkan kata kunci, saran itu dipakai lebih dulu dan sisanya diisi keluaran AI. Duplikat, kata sambung yang berdiri sendiri seperti “for” atau “with”, dan tag sisa format dibuang sebelum kata kuncinya masuk ke formulir.",
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
      beranda: true,
      answer:
        "Berkas asli di komputer Anda tidak pernah dibuka. Yang dikirim adalah salinan kecil dari pratinjau yang sudah tampil di halaman unggah — diperkecil sampai sisi terpanjang 1280 piksel dan dijadikan JPEG di browser Anda, dipakai sekali untuk dibaca AI, lalu tidak disimpan. Yang tersimpan hanya baris riwayat: marketplace, alamat halaman, judul, dan kata kunci hasilnya.",
    },

    /**
     * Ditulis ulang setelah audit halaman: jawaban lamanya menawarkan
     * "memperpanjang paket", sisa dari alur berdurasi yang sudah dibuang. Paket
     * kini dibeli sekali dan aksesnya tanpa tanggal akhir (admin-grants.ts),
     * jadi satu-satunya cara menambah poin setelah aktivasi adalah isi ulang.
     *
     * Patokan angkanya disisipkan, bukan diketik — lihat `patokan` di atas.
     */
    {
      question: "Apa itu poin, dan bagaimana kalau habis?",
      beranda: true,
      answer:
        "Poin terpakai setiap kali AI bekerja — besarnya tergantung gambar dan panjang teks yang diproses." +
        patokan(poinPerGambar) +
        " Alat berhenti sementara kalau poin habis, dan Anda bisa isi ulang kapan saja tanpa berlangganan. Poin yang belum terpakai tidak hangus.",
    },

    /**
     * Sumber: lib/admin-grants.ts memberi lisensi TANPA `validUntil`, dan
     * lib/billing/renewals.ts mematikan perpanjangan secara bawaan. Pertanyaan
     * ini sudah ada di /pricing; ia disalin ke beranda karena beranda punya tabel
     * harganya sendiri, dan pengunjung yang berhenti di beranda tidak pernah
     * membaca jawaban itu.
     */
    {
      question: "Apakah ada tagihan bulanan?",
      answer:
        "Tidak ada. Paket dibeli sekali dan aksesnya berlaku selamanya — tidak ada perpanjangan, tidak ada tagihan berulang, dan kami tidak menyimpan data pembayaran Anda. Yang habis hanya poin, dan itu pun hanya diisi kalau Anda memang mau melanjutkan.",
    },
    {
      question: "Bagaimana cara memasang ekstensinya?",
      beranda: true,
      answer:
        "Unduh folder ekstensi dari halaman Profile Anda, lalu muat lewat Chrome dengan Load unpacked. Belum melalui Chrome Web Store, jadi pembaruan kami beritahukan dari dalam aplikasi.",
    },
    {
      question: "Bagaimana cara pembayarannya?",
      beranda: true,
      answer:
        "Lewat transfer bank. Pilih paket, kirim order, transfer sesuai nominal, lalu unggah bukti transfer — tim kami memverifikasi dan mengaktifkan akun Anda, biasanya di hari yang sama.",
      },

    /**
     * TIDAK ada kebijakan refund tertulis di kode maupun di basis data — dicari
     * di lib/orders.ts, lib/payments/, dan halaman /syarat: kosong. Jadi
     * jawabannya menyebut JALURNYA, bukan janji berjangka waktu. Menuliskan
     * "14 hari" di sini berarti mengarang kebijakan yang tidak dijaga apa pun,
     * dan pembeli menemukannya justru saat ia sudah membayar.
     *
     * Begitu owner menetapkan kebijakannya, jawaban INI yang diubah, dan
     * halaman /syarat ikut diperbarui — dua tempat, sengaja disebut di sini
     * supaya yang kedua tidak terlupa.
     *
     * Tidak ditandai `beranda`: pertanyaan ini dicari orang yang sudah hendak
     * membayar, dan tempatnya di /faq bersama syarat lengkapnya.
     */
    {
      question: "Bagaimana kalau saya minta pengembalian dana?",
      answer:
        "Hubungi tim Nerona lewat halaman Kontak. Karena pembayarannya lewat transfer dan aktivasinya dilakukan tim kami, permintaan pengembalian dana ditangani satu per satu — sebutkan nomor order Anda beserta alasannya, dan kami jawab di hari kerja yang sama.",
    },
  ];
}

/**
 * Enam pertanyaan yang menghalangi pembelian — dipakai beranda.
 *
 * Sebelas item membuat FAQ sendiri hampir sepertiga panjang beranda, dan pada
 * panjang itu bagian yang tugasnya menyingkirkan keberatan justru berubah jadi
 * dinding teks yang dilewati. Sisanya tidak dibuang, hanya pindah ke /faq —
 * dan beranda menautkannya.
 */
export function metadataFaqBeranda(opts: MetadataFaqOptions): MarketingFaqItem[] {
  return metadataFaq(opts).filter((item) => item.beranda);
}
