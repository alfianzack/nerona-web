import { redirect } from "next/navigation";
import { AGENT_ENABLED } from "@/lib/features";
import { AgentChatMockup } from "@/components/marketing/mockups/AgentChatMockup";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { agentTiers } from "@/lib/pricing-tiers";
import { Band } from "@/components/ui/Band";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";

const FEATURES = [
  {
    title: "Chat langsung di WhatsApp Anda.",
    body: "Satu nomor WhatsApp Nerona melayani semua pengguna Nerona Agent. Hubungkan nomor Anda sekali, lalu mulai chat seperti biasa. Agent hanya menjawab nomor yang sudah terdaftar — jadi ini asisten pribadi Anda, bukan chatbot untuk pembeli.",
  },
  {
    title: "Ingat percakapan dan bisnis Anda.",
    body: "Nerona Agent mengingat catatan dan fakta penting tentang bisnis Anda dari percakapan sebelumnya, jadi Anda tidak perlu mengulang.",
  },
];

/**
 * Every line here must map to a tool the agent actually has (lib/agent/tools.ts:
 * list_products, add_product, record_sale, list_recent_orders,
 * get_sales_summary, update_order_status) or to its memory. Nothing aspirational
 * — a capability listed without a tool behind it is a refund request.
 */
const CAPABILITIES = [
  "Catat penjualan lengkap dengan nama pembeli dan tanggal transaksi",
  "Tambah produk baru atau perbarui harganya",
  "Cek daftar produk aktif beserta harga dan stok",
  "Lihat order terakhir beserta itemnya",
  "Tandai order lunas atau batalkan order",
  "Minta ringkasan omzet harian, mingguan, atau bulanan",
];

/**
 * Halaman ini mati secara bawaan, jadi yang dikerjakan hanya pemindahan ke
 * lapisan token dan primitive — bukan rancang ulang. Sebabnya: begitu saklarnya
 * dinyalakan lagi, halaman harus langsung sepakat dengan halaman publik yang
 * lain, bukan muncul sebagai peninggalan yang tampil beda sendiri.
 *
 * Tiga hal yang dibuang, sama persis dengan yang dibuang di hero beranda:
 *
 * 1. Gradien pada teks judul. Judulnya sekarang satu warna, dan perhentian
 *    tengah gradien lamanya toh sama dengan perhentian akhirnya.
 * 2. Blob emas kabur di belakang judul, beserta pemotongan luapan yang
 *    satu-satunya alasan keberadaannya adalah blob itu. Emas juga tidak lagi
 *    muncul di halaman publik sama sekali.
 * 3. Centang emoji hijau di daftar kemampuan. Bentuk dan bobotnya berbeda di
 *    tiap sistem operasi, dan hijaunya adalah warna keempat di halaman yang
 *    seharusnya cuma punya satu aksen.
 */
export default async function AgentMarketingPage() {
  // Agent sedang tidak dijual; tautan lama mendarat di beranda, bukan 404.
  if (!AGENT_ENABLED) redirect("/");

  const tiers = await agentTiers();

  return (
    <main>
      <Band align="center">
        <p className="text-body-lg font-semibold text-accent">Nerona Agent</p>

        <h1 className="mx-auto mt-3 max-w-[17ch] text-balance text-display-1 text-ink">
          Asisten AI yang chat langsung di WhatsApp.
        </h1>

        <p className="mx-auto mt-5 max-w-[42ch] text-balance text-lead text-muted">
          Asisten pribadi untuk pemilik usaha kecil: catat pesanan, cek stok, dan tanya omzet
          toko Anda — semua lewat WhatsApp yang sudah Anda pakai setiap hari.
        </p>

        <div className="mx-auto mt-16 max-w-lg">
          <AgentChatMockup />
        </div>
      </Band>

      <Band tone="sunken">
        <div className="grid gap-12 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <h2 className="text-balance text-title-2 text-ink">{feature.title}</h2>
              <p className="mt-3 text-body-lg text-muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band align="center">
        <h2 className="text-balance text-display-2 text-ink">Yang bisa Anda minta</h2>
        <p className="mx-auto mt-5 max-w-[44ch] text-balance text-lead text-muted">
          Tulis dengan bahasa sehari-hari — Agent yang mengerjakan sisanya.
        </p>

        {/* Yang rata tengah cuma judul pitanya; daftarnya tetap rata kiri supaya
            keenam barisnya bisa dibaca menurun. */}
        <ul className="mx-auto mt-12 grid max-w-3xl gap-x-10 gap-y-4 text-left sm:grid-cols-2">
          {CAPABILITIES.map((capability) => (
            <li key={capability} className="flex items-start gap-2.5 text-body text-ink">
              <Icon name="check" className="mt-[3px] h-4 w-4 flex-none text-accent" />
              {capability}
            </li>
          ))}
        </ul>
      </Band>

      <PricingTiers
        id="pricing"
        heading="Harga Nerona Agent"
        subheading="Paket Free memberi poin percobaan sekali per akun. Upgrade untuk poin bulanan."
        tiers={tiers}
      />

      {/* Tanpa padding atas: pita harga di atasnya sudah menyumbang satu pita
          penuh di bawah isinya. */}
      <section className="px-6 pb-band text-center">
        {/* Tautan biasa, bukan TextLink: TextLink memasang kurung sudut di
            belakang anaknya karena ia dibuat untuk aksi kedua sebuah hero.
            Di tengah kalimat, tanda itu terbaca seperti salah ketik. */}
        <p className="text-body text-muted">
          Sudah pelanggan?{" "}
          <Link href="/login" className="text-accent transition hover:underline">
            Masuk ke akun Anda
          </Link>
        </p>
      </section>
    </main>
  );
}
