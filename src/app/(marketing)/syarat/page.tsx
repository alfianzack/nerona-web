import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Pasal, Daftar } from "@/components/marketing/LegalPage";
import { KONTAK, WA_TAMPIL, waLink } from "@/lib/kontak";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan — Nerona",
  description:
    "Ketentuan pemakaian Nerona: apa yang Anda beli, kebijakan pengembalian dana, dan batas tanggung jawab.",
};

/**
 * Syarat & Ketentuan, termasuk kebijakan pengembalian dana.
 *
 * Kebijakan refund sengaja berdiri sebagai pasal di sini alih-alih jadi halaman
 * ketiga: orang mencarinya persis saat membaca ketentuan pembelian, dan halaman
 * terpisah untuk tiga paragraf hanya menambah tempat yang bisa basi sendiri.
 *
 * Dua pasal yang paling penting dan paling mudah terlewat kalau dokumen ini
 * disalin dari template:
 *
 * 1. "Metadata dibuat AI" — pemakainyalah yang bertanggung jawab memeriksa
 *    sebelum mengirim ke marketplace. Ini bukan sekadar perisai hukum; FAQ
 *    beranda sudah mengakui hal yang sama, karena penyaring kata kunci di
 *    ekstensi memeriksa duplikat dan stopword tapi TIDAK punya daftar merek.
 *    Kalau kedua halaman tidak menyebut hal yang sama, yang satu berbohong.
 * 2. "Bergantung pada halaman marketplace" — ekstensi mengisi formulir milik
 *    pihak lain yang bisa berubah kapan saja tanpa pemberitahuan. Menjanjikan
 *    ketersediaan tanpa syarat itu berarti menjanjikan sesuatu yang tidak ada
 *    di tangan kami.
 */
export default function SyaratPage() {
  return (
    <LegalPage
      title="Syarat & Ketentuan"
      berlakuSejak="4 September 2026"
      intro={`Ketentuan pemakaian layanan ${KONTAK.nama}. Ditulis dengan bahasa biasa — kalau ada yang tidak jelas, tanyakan sebelum membeli, bukan sesudah.`}
    >
      <Pasal id="layanan" judul="1. Apa yang Anda beli">
        <p>
          Nerona menyediakan ekstensi Chrome dan aplikasi desktop yang membuat metadata — judul,
          deskripsi, dan kata kunci — untuk karya yang Anda unggah ke marketplace stock.
        </p>
        <p>
          <strong>Paket dibeli sekali dan aksesnya berlaku selamanya.</strong> Tidak ada tagihan
          bulanan, tidak ada perpanjangan otomatis, dan kami tidak menyimpan data pembayaran Anda.
          Yang habis adalah poin, dan poin diisi ulang hanya kalau Anda memang mau melanjutkan.
        </p>
      </Pasal>

      {/* Sumber: lib/points.ts (ledger append-only), lib/plan-points.ts (poin
          dikreditkan per aktivasi), lib/agent/pricing.ts (ongkos dihitung dari
          token yang benar-benar terpakai). */}
      <Pasal id="poin" judul="2. Poin">
        <p>
          Poin terpakai setiap kali AI bekerja. Besarnya dihitung dari jumlah token yang
          benar-benar diproses, jadi gambar dan teks yang lebih besar memakai lebih banyak poin.
        </p>
        <Daftar
          items={[
            "Poin yang belum terpakai tidak hangus dan tidak punya tanggal kedaluwarsa.",
            "Poin tidak bisa dipindahkan antar-akun dan tidak bisa diuangkan.",
            "Kalau poin habis, alat berhenti sementara — akses paket Anda tidak hilang.",
            "Kalau sebuah proses gagal karena kesalahan di sisi kami, poinnya kami kembalikan ke saldo Anda.",
          ]}
        />
      </Pasal>

      <Pasal id="pembayaran" judul="3. Pembayaran dan aktivasi">
        <p>
          Pembayaran lewat transfer bank atau QRIS. Untuk transfer bank, Anda mengirim order,
          mentransfer sesuai nominal, lalu mengunggah bukti transfer — kami memverifikasi dan
          mengaktifkan akun Anda, biasanya di hari yang sama.
        </p>
        <p>
          Kalau lebih dari <strong>2 × 24 jam</strong> kerja akun Anda belum aktif padahal bukti
          sudah diunggah, hubungi kami di{" "}
          <a href={waLink(KONTAK.waNomor, "Halo Nerona, order saya belum aktif.")}>{WA_TAMPIL}</a>.
        </p>
      </Pasal>

      {/*
        SATU-SATUNYA PASAL DI HALAMAN INI YANG BUKAN TURUNAN DARI KODE.
        Ia adalah keputusan bisnis, dan bentuknya dipilih supaya adil di kedua
        arah: pembeli terlindung kalau ternyata alatnya tidak cocok untuknya,
        sementara Nerona tidak menanggung biaya AI yang sudah benar-benar
        keluar. Ubah angkanya kalau owner memutuskan lain — dan kalau diubah,
        tanggal berlaku di kepala halaman ikut diubah.
      */}
      <Pasal id="pengembalian" judul="4. Pengembalian dana">
        <p>
          Paket Free ada supaya Anda bisa menilai hasilnya sebelum membayar. Pakai itu dulu — itu
          alasan paket Free ada.
        </p>
        <Daftar
          items={[
            <>
              <strong>Paket, dalam 7 hari:</strong> kalau belum ada satu poin pun dari paket itu yang
              terpakai, kami kembalikan penuh.
            </>,
            <>
              <strong>Paket, setelah poinnya dipakai:</strong> tidak bisa dikembalikan. Biaya AI-nya
              sudah benar-benar keluar dan tidak bisa ditarik lagi.
            </>,
            <>
              <strong>Isi ulang poin:</strong> tidak bisa dikembalikan setelah poin masuk ke saldo —
              tapi poin itu tidak hangus, jadi ia tetap bisa dipakai kapan saja.
            </>,
            <>
              <strong>Salah transfer atau bayar dua kali:</strong> selalu kami kembalikan penuh,
              tanpa batas waktu.
            </>,
          ]}
        />
        <p>
          Permintaan pengembalian dikirim dari email terdaftar Anda ke{" "}
          <a href={`mailto:${KONTAK.email}`}>{KONTAK.email}</a>, dan dana dikembalikan ke rekening
          asal pembayaran.
        </p>
      </Pasal>

      {/* Sumber: lib/extension/prompts.ts melarang merek berhak cipta dan fakta
          karangan, TAPI isBlockedMarketplaceKeyword di content.js tidak punya
          daftar merek. Jadi yang ada adalah instruksi ke model, bukan penjaga di
          kode — dan pasal ini harus mengaku begitu, persis seperti FAQ beranda. */}
      <Pasal id="tanggung-jawab-anda" judul="5. Tanggung jawab Anda atas metadata">
        <p>
          Metadata dibuat AI, dan AI bisa keliru.{" "}
          <strong>Periksa hasilnya sebelum Anda kirim ke marketplace.</strong> Prompt kami melarang
          merek berhak cipta, nama selebritas, dan mengarang lokasi atau peristiwa — tapi itu
          instruksi kepada model, bukan daftar-hitam yang dijaga kode kami. Yang Anda kirim adalah
          tanggung jawab Anda.
        </p>
        <p>
          Anda juga menyatakan bahwa karya yang Anda proses memang berhak Anda unggah ke marketplace
          tujuan.
        </p>
      </Pasal>

      <Pasal id="ketersediaan" judul="6. Ketersediaan layanan">
        <p>
          Ekstensi Nerona bekerja dengan mengisi formulir unggah milik marketplace. Halaman-halaman
          itu bukan milik kami dan bisa berubah kapan saja tanpa pemberitahuan. Kalau sebuah
          marketplace mengubah halamannya dan dukungan untuk situs itu sementara rusak, kami
          memperbaikinya secepat yang kami bisa — tapi kami tidak bisa menjanjikan bahwa itu tidak
          akan pernah terjadi.
        </p>
        <p>
          Kami juga tidak menjanjikan bahwa marketplace mana pun akan menerima karya Anda. Keputusan
          itu sepenuhnya milik mereka.
        </p>
      </Pasal>

      <Pasal id="pemakaian-wajar" judul="7. Pemakaian yang wajar">
        <p>Satu akun untuk satu orang. Yang tidak diperbolehkan:</p>
        <Daftar
          items={[
            "membagikan akun ke banyak orang atau menjual kembali akses",
            "membongkar, memodifikasi, atau mendistribusikan ulang ekstensi maupun aplikasi Nerona",
            "memakai layanan untuk konten yang melanggar hukum",
          ]}
        />
        <p>
          Akun yang melanggar bisa kami nonaktifkan. Kalau itu terjadi, poin yang belum terpakai
          tetap kami kembalikan nilainya.
        </p>
      </Pasal>

      <Pasal id="batas-tanggung-jawab" judul="8. Batas tanggung jawab">
        <p>
          Tanggung jawab Nerona atas kerugian apa pun yang berkaitan dengan layanan ini terbatas pada
          jumlah yang Anda bayarkan kepada kami dalam 12 bulan terakhir. Kami tidak bertanggung jawab
          atas kehilangan pendapatan akibat penolakan marketplace atau akun marketplace yang
          ditangguhkan.
        </p>
      </Pasal>

      <Pasal id="perubahan-syarat" judul="9. Perubahan ketentuan">
        <p>
          Kalau ketentuan ini berubah, tanggal berlaku di kepala halaman ikut berubah, dan perubahan
          yang menyangkut harga atau hak akses kami beritahukan lewat email.{" "}
          <strong>Akses yang sudah Anda beli tidak akan kami cabut karena perubahan ketentuan.</strong>
        </p>
      </Pasal>

      <Pasal id="hukum" judul="10. Hukum yang berlaku">
        <p>
          Ketentuan ini tunduk pada hukum Republik Indonesia. Kalau ada perselisihan, mari
          diselesaikan lewat pembicaraan lebih dulu — hubungi kami dan hampir semua hal bisa
          dibereskan di sana.
        </p>
      </Pasal>

      <Pasal id="kontak-syarat" judul="Menghubungi kami">
        <p>
          <a href={`mailto:${KONTAK.email}`}>{KONTAK.email}</a> · WhatsApp{" "}
          <a href={waLink(KONTAK.waNomor, "Halo Nerona, saya mau bertanya.")}>{WA_TAMPIL}</a>
        </p>
        <p>
          Lihat juga <Link href="/privasi">Kebijakan Privasi</Link>.
        </p>
      </Pasal>
    </LegalPage>
  );
}
