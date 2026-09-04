import type { Metadata } from "next";
import { LegalPage, Pasal, Daftar } from "@/components/marketing/LegalPage";
import { KONTAK, WA_TAMPIL, waLink } from "@/lib/kontak";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — Nerona",
  description:
    "Data apa yang Nerona kumpulkan, apa yang terjadi pada gambar Anda, dan bagaimana menghapus akun.",
};

/**
 * Kebijakan Privasi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ATURAN BERKAS INI
 * ─────────────────────────────────────────────────────────────────────────
 * Setiap kalimat di halaman ini harus bisa ditunjuk ke kode atau ke skema. Itu
 * aturan yang sudah berlaku untuk halaman pemasaran (lihat spec
 * marketing-honesty dan docblock lib/marketing-faq.ts) dan berlaku LEBIH keras
 * di sini: klaim pemasaran yang meleset merugikan konversi, sedangkan klaim
 * privasi yang meleset adalah pernyataan salah tentang penanganan data orang
 * lain di dokumen yang justru dibaca saat terjadi sengketa.
 *
 * Sumber tiap pasal ditulis tepat di atasnya. Kalau kode yang disebut berubah,
 * pasalnya ikut salah — dan memang itu maksudnya.
 *
 * Yang sengaja TIDAK ditulis: nama badan usaha berbadan hukum, nomor akta, dan
 * alamat kantor. Belum ada yang bisa disebut, dan mengarangnya di sini bukan
 * sekadar tidak jujur.
 */
export default function PrivasiPage() {
  return (
    <LegalPage
      title="Kebijakan Privasi"
      berlakuSejak="4 September 2026"
      intro={`Halaman ini menjelaskan data apa yang ${KONTAK.nama} kumpulkan, kenapa, dan apa yang benar-benar terjadi pada gambar yang Anda proses. Ditulis sependek mungkin dan tanpa kalimat yang tidak kami jalankan.`}
    >
      {/*
        Sumber, tiga tempat — sama dengan yang dirujuk jawaban FAQ "Gambar saya
        diunggah ke server Nerona?":
        - nerona_medata/content.js: NERONA_VISION_MAX_EDGE = 1280 dan
          imageElementToInlineDataViaCanvas.
        - src/app/api/extension/generate/route.ts: gambar dipakai sekali untuk
          satu panggilan AI lalu diteruskan apa adanya. Tidak ada penulisan
          berkas, kolom basis data, maupun penyimpanan objek di jalur itu.
        - src/lib/metadata-log.ts: satu-satunya yang tersimpan setelahnya.
      */}
      <Pasal id="gambar" judul="Apa yang terjadi pada gambar Anda">
        <p>
          <strong>Berkas asli di komputer Anda tidak pernah kami buka.</strong> Ekstensi Nerona
          membaca gambar pratinjau yang sudah tampil di halaman unggah marketplace, memperkecilnya
          sampai sisi terpanjang 1280 piksel, dan mengubahnya jadi JPEG — semuanya di dalam peramban
          Anda, sebelum apa pun dikirim.
        </p>
        <p>
          Salinan kecil itu dikirim satu kali untuk dibaca AI, lalu dilepas. Kami tidak menuliskannya
          ke berkas, tidak menyimpannya di kolom basis data, dan tidak menaruhnya di penyimpanan
          objek mana pun.
        </p>
        <p>Yang tersimpan setelah proses selesai hanya baris riwayat:</p>
        <Daftar
          items={[
            "nama marketplace tujuan",
            "alamat halaman unggah",
            "judul yang dihasilkan",
            "kata kunci yang dihasilkan, dan jumlahnya",
          ]}
        />
        <p>
          Baris itu ada supaya Anda bisa membukanya kembali di halaman Riwayat Metadata. Deskripsi
          yang dihasilkan tidak ikut tersimpan.
        </p>
      </Pasal>

      {/*
        Sumber: src/lib/ai-providers.ts + tabel AiProvider — panggilan AI
        diteruskan ke gateway pihak ketiga dengan baseUrl dan kunci yang
        tersimpan di sana. Menyembunyikan keberadaan pihak ketiga adalah
        kelalaian yang paling sering ditemukan di kebijakan privasi produk AI.
      */}
      <Pasal id="pihak-ketiga" judul="Pihak ketiga yang ikut memproses">
        <p>
          Nerona tidak melatih atau menjalankan modelnya sendiri. Salinan gambar dan teks yang
          diproses diteruskan ke penyedia layanan AI pihak ketiga untuk dibaca, dan hasilnya
          dikembalikan ke Anda. Penyedia itu punya kebijakan penyimpanan datanya sendiri, di luar
          kendali kami.
        </p>
        <p>
          Kalau Anda memproses karya yang terikat perjanjian kerahasiaan dengan klien, pertimbangkan
          itu sebelum memakai alat ini — sama seperti alat AI lain mana pun.
        </p>
      </Pasal>

      {/* Sumber: model User, License, PointTransaction, Order, OrderRequest di prisma/schema.prisma. */}
      <Pasal id="akun" judul="Data akun yang kami simpan">
        <Daftar
          items={[
            <>
              <strong>Email</strong> — untuk masuk, verifikasi, dan pemulihan kata sandi.
            </>,
            <>
              <strong>Kata sandi</strong> — disimpan sebagai hash, tidak pernah dalam bentuk aslinya.
              Kami tidak bisa membacanya.
            </>,
            <>
              <strong>Nama, nama usaha, dan nomor telepon</strong> — hanya kalau Anda mengisinya.
            </>,
            <>
              <strong>Paket, saldo poin, dan riwayat pemakaian poin</strong> — supaya tagihan dan
              saldo bisa ditelusuri kedua pihak.
            </>,
            <>
              <strong>Order dan bukti transfer</strong> — foto bukti transfer yang Anda unggah
              tersimpan di basis data kami sampai order selesai diverifikasi.
            </>,
          ]}
        />
        <p>
          Kami tidak menyimpan data kartu kredit karena kami tidak pernah menerimanya — pembayaran
          lewat transfer bank atau QRIS.
        </p>
      </Pasal>

      <Pasal id="penggunaan" judul="Untuk apa data itu dipakai">
        <p>
          Menjalankan layanan, dan hanya itu: mengaktifkan paket, menghitung poin, memverifikasi
          pembayaran, menjawab pertanyaan Anda, dan mengirim email yang berkaitan dengan akun
          (verifikasi, pemulihan kata sandi, status order).
        </p>
        <p>
          <strong>Kami tidak menjual data Anda</strong>, tidak menukarnya, dan tidak memakainya untuk
          iklan.
        </p>
      </Pasal>

      {/* Sumber: next-auth (model Session + cookie sesi), middleware.ts. */}
      <Pasal id="cookie" judul="Cookie">
        <p>
          Satu jenis saja: cookie sesi yang menjaga Anda tetap masuk. Tidak ada cookie iklan dan
          tidak ada pelacak pihak ketiga. Menghapusnya akan mengeluarkan Anda dari akun, tidak lebih.
        </p>
      </Pasal>

      <Pasal id="hak-anda" judul="Hak Anda atas data Anda">
        <p>
          Anda boleh meminta salinan data Anda, meminta koreksi, atau meminta akun beserta seluruh
          datanya dihapus. Kirim permintaan dari email yang terdaftar ke{" "}
          <a href={`mailto:${KONTAK.email}`}>{KONTAK.email}</a> dan kami kerjakan.
        </p>
        <p>
          Yang perlu Anda tahu sebelum meminta penghapusan: menghapus akun menghapus juga saldo poin
          dan riwayat metadata Anda, dan keduanya tidak bisa dikembalikan.
        </p>
      </Pasal>

      <Pasal id="perubahan" judul="Perubahan kebijakan ini">
        <p>
          Kalau kebijakan ini berubah, tanggal berlaku di kepala halaman ikut berubah. Perubahan yang
          menyangkut cara kami memperlakukan gambar atau data akun akan kami beritahukan lewat email
          ke pengguna aktif — bukan hanya dengan menyunting halaman ini diam-diam.
        </p>
      </Pasal>

      <Pasal id="kontak-privasi" judul="Menghubungi kami">
        <p>
          Pertanyaan soal privasi, permintaan data, atau permintaan penghapusan:{" "}
          <a href={`mailto:${KONTAK.email}`}>{KONTAK.email}</a> atau WhatsApp{" "}
          <a href={waLink(KONTAK.waNomor, "Halo Nerona, saya mau bertanya soal privasi data.")}>
            {WA_TAMPIL}
          </a>
          .
        </p>
      </Pasal>
    </LegalPage>
  );
}
