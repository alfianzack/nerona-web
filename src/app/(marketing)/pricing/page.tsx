import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PricingSwitcher } from "@/components/marketing/PricingSwitcher";
import { StepsSection } from "@/components/marketing/StepsSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { pricingProducts } from "@/lib/pricing-products";

const PRICING_FAQ = [
  {
    question: "Apakah paket diperpanjang otomatis?",
    answer:
      "Tidak ada tagihan otomatis — kami tidak menyimpan data pembayaran Anda. Menjelang masa aktif berakhir, kami kirim invoice perpanjangan sebagai pengingat; paket baru berlanjut setelah Anda transfer dan pembayaran kami verifikasi. Abaikan invoice itu kalau Anda tidak ingin lanjut.",
  },
  {
    question: "Apakah paket Free diperbarui setiap bulan?",
    answer:
      "Tidak. Free adalah poin percobaan yang diberikan sekali per akun, seumur hidup — tidak di-reset dan tidak bertambah. Setelah habis, pilih paket berbayar untuk melanjutkan.",
  },
  {
    question: "Apa itu poin, dan bagaimana kalau habis?",
    answer:
      "Poin terpakai setiap kali AI bekerja — besarnya tergantung panjang teks yang diproses. Alat berhenti sementara kalau poin habis atau masa aktif paket berakhir; mengaktifkan atau memperpanjang paket menambahkan poin baru ke saldo Anda. Poin yang belum terpakai tidak hangus.",
  },
  {
    question: "Apakah bisa pindah paket di tengah jalan?",
    answer:
      "Bisa — kirim order upgrade kapan saja, tim kami bantu sesuaikan sisa masa aktif Anda.",
  },
];

export default async function PricingPage() {
  // /pricing is the one dual-audience page: marketing copy for visitors, a
  // purchase surface for tenants. A tenant buying points should have the app
  // sidebar, and one path cannot live in two route groups — so they get /paket
  // instead. Deliberately NOT applied to /, /agent, or /metadata: those are
  // pure marketing and are fine to read while signed in.
  //
  // The sidebar links straight to /paket, so this only catches stale entry
  // points: the footer, bookmarks, search results, and the in-page links in
  // (marketing)/page.tsx and (app)/order/page.tsx.
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/paket");
  }

  const { products, discounts } = await pricingProducts();

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

      <StepsSection
        title="Cara pembayaran"
        subtitle="Tanpa tagihan otomatis — setiap perpanjangan menunggu transfer Anda."
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

      <CtaBanner
        title="Masih ragu? Coba dulu tanpa bayar."
        body="Tidak perlu kartu kredit, tidak ada tagihan otomatis. Upgrade hanya saat Anda siap."
        ctaLabel="Buat akun gratis"
        ctaHref="/register"
      />
    </main>
  );
}
