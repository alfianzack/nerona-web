import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PricingSwitcher } from "@/components/marketing/PricingSwitcher";
import { StepsSection } from "@/components/marketing/StepsSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { pricingProducts } from "@/lib/pricing-products";
import { TopupSection } from "@/components/marketing/TopupSection";
import { getTopupPackages } from "@/lib/topup";

const PRICING_FAQ = [
  {
    question: "Apakah ada tagihan bulanan?",
    answer:
      "Tidak ada. Paket dibeli sekali dan aksesnya berlaku selamanya — tidak ada perpanjangan, tidak ada tagihan berulang, dan kami tidak menyimpan data pembayaran Anda. Yang habis hanya poin, dan itu pun hanya diisi kalau Anda memang mau melanjutkan.",
  },
  {
    question: "Apakah paket Free diperbarui setiap bulan?",
    answer:
      "Tidak. Free adalah poin percobaan yang diberikan sekali per akun, seumur hidup — tidak di-reset dan tidak bertambah. Setelah habis, pilih paket berbayar untuk melanjutkan.",
  },
  {
    question: "Apa itu poin, dan bagaimana kalau habis?",
    answer:
      "Poin terpakai setiap kali AI bekerja — besarnya tergantung panjang teks yang diproses. Pembelian paket menyertakan poin awal; kalau habis, alat berhenti sementara sampai Anda isi ulang. Poin yang belum terpakai tidak hangus, dan isi ulang bisa kapan saja tanpa berlangganan.",
  },
  {
    question: "Kalau sudah beli, apakah akses saya bisa hilang?",
    answer:
      "Tidak karena waktu. Akses tidak punya tanggal kedaluwarsa, jadi alat tetap bisa dipakai selama poin Anda ada. Pelanggan lama yang masih memakai paket berdurasi tetap berjalan sampai masa aktifnya habis.",
  },
  {
    question: "Apakah bisa naik paket setelah membeli?",
    answer:
      "Bisa — kirim order paket yang lebih tinggi kapan saja, dan tim kami bantu menyesuaikannya.",
  },
];


/**
 * Halaman harga publik — tetap tanpa sidebar, termasuk untuk yang sudah masuk.
 *
 * Dulu di sini ada pengalihan ke /paket bagi user yang sudah login, dengan
 * alasan tenant yang membeli sebaiknya punya sidebar. Hasilnya: mengklik
 * "Harga" di menu atas justru melompat ke halaman ber-sidebar — sesuatu yang
 * tidak diminta dan membingungkan, karena menu atas dan sidebar adalah dua
 * konteks yang berbeda. Keduanya kini hidup berdampingan: /pricing untuk siapa
 * saja lewat menu atas, /paket sebagai permukaan pembelian di dalam aplikasi.
 * Isinya sama-sama dari pricingProducts(), jadi harganya tidak mungkin berbeda.
 */
export default async function PricingPage() {
  const [{ products, discounts }, session, topupPackages] = await Promise.all([
    pricingProducts(),
    getServerSession(authOptions),
    getTopupPackages(),
  ]);
  const signedIn = Boolean(session?.user);

  return (
    <main className="bg-canvas">
      <section className="relative overflow-hidden px-6 pb-20 pt-16 sm:pt-20">
        <div
          className="pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full bg-gold-400 opacity-[0.12] blur-[100px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-brand-blue opacity-30 blur-[100px]"
          aria-hidden="true"
        />
        <div className="relative">
          <h1 className="text-balance text-center text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
            Harga sederhana,{" "}
            <span className="bg-gradient-to-r from-brand-blue via-brand-orange to-brand-orange bg-clip-text text-transparent">
              coba dulu tanpa bayar.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-muted">
            Setiap produk Nerona memberi poin percobaan gratis sekali per akun — pakai untuk
            menilai sendiri, lalu pilih paket kalau cocok.
          </p>
          <div className="mt-9">
            <PricingSwitcher products={products} discounts={discounts} />
          </div>
        </div>
      </section>

      <TopupSection packages={topupPackages} />

      <StepsSection
        title="Cara pembayaran"
        subtitle="Tanpa tagihan otomatis dan tanpa perpanjangan — bayar sekali, lalu isi poin bila perlu."
        variant="cards"
        steps={[
          {
            title: "Pilih paket & kirim order",
            body: "Klik paket yang Anda mau — order tercatat dan detail rekening tujuan langsung muncul.",
          },
          {
            title: "Transfer & unggah bukti",
            body: "Transfer sesuai nominal, lalu unggah foto bukti transfer di halaman order Anda.",
          },
          {
            title: "Aktif setelah verifikasi",
            body: "Tim kami memverifikasi pembayaran dan paket Anda aktif — biasanya di hari yang sama.",
          },
        ]}
      />

      <FaqSection items={PRICING_FAQ} className="bg-canvas" />

      {/* Mengajak orang yang sudah punya akun untuk "Buat akun gratis" jelas keliru,
          dan sejak pengalihan ke /paket dilepas, mereka memang sampai di sini. */}
      {signedIn ? (
        <CtaBanner
          title="Sudah menentukan pilihan?"
          body="Buka Paket & Harga di dalam aplikasi untuk membeli atau memperpanjang, lengkap dengan saldo poin Anda."
          ctaLabel="Buka Paket & Harga"
          ctaHref="/paket"
        />
      ) : (
        <CtaBanner
          title="Masih ragu? Coba dulu tanpa bayar."
          body="Tidak perlu kartu kredit, tidak ada tagihan otomatis. Upgrade hanya saat Anda siap."
          ctaLabel="Buat akun gratis"
          ctaHref="/register"
        />
      )}
    </main>
  );
}
