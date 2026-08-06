import Link from "next/link";
import { redirect } from "next/navigation";
import { AGENT_ENABLED } from "@/lib/features";
import { AgentChatMockup } from "@/components/marketing/mockups/AgentChatMockup";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { agentTiers } from "@/lib/pricing-tiers";

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

export default async function AgentMarketingPage() {
  // Agent sedang tidak dijual; tautan lama mendarat di beranda, bukan 404.
  if (!AGENT_ENABLED) redirect("/");

  const tiers = await agentTiers();

  return (
    <main>
      <section className="relative overflow-hidden bg-canvas px-6 pb-24 pt-20 text-center sm:pt-28">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gold-400 opacity-[0.08] blur-[110px]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-4xl">
          <p className="text-sm font-medium text-brand-blue">Nerona Agent</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-ink sm:text-7xl">
            Asisten AI yang{" "}
            <span className="bg-gradient-to-r from-brand-blue via-brand-orange to-brand-orange bg-clip-text text-transparent">
              chat langsung di WhatsApp.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted sm:text-xl">
            Asisten pribadi untuk pemilik usaha kecil: catat pesanan, cek stok, dan tanya omzet
            toko Anda — semua lewat WhatsApp yang sudah Anda pakai setiap hari.
          </p>
          <div className="mx-auto mt-16 max-w-lg">
            <AgentChatMockup />
          </div>
        </div>
      </section>

      <section className="bg-surface2 px-6 py-24 sm:py-32">
        <div className="mx-auto grid max-w-5xl gap-12 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                {feature.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-canvas px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Yang bisa Anda minta
          </h2>
          <p className="mx-auto mt-3.5 max-w-xl text-center text-base leading-relaxed text-muted">
            Tulis dengan bahasa sehari-hari — Agent yang mengerjakan sisanya.
          </p>
          <ul className="mx-auto mt-10 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            {CAPABILITIES.map((capability) => (
              <li key={capability} className="flex gap-2.5 text-[15px] leading-relaxed text-ink">
                <span className="mt-0.5 font-bold text-emerald-600" aria-hidden="true">
                  ✓
                </span>
                {capability}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <PricingTiers
        id="pricing"
        heading="Harga Nerona Agent"
        subheading="Paket Free memberi poin percobaan sekali per akun. Upgrade untuk poin bulanan."
        tiers={tiers}
      />

      <section className="bg-canvas px-6 py-16 text-center">
        <p className="text-sm text-muted">
          Sudah pelanggan?{" "}
          <Link href="/login" className="font-medium text-brand-blue hover:underline">
            Masuk ke akun Anda
          </Link>
        </p>
      </section>
    </main>
  );
}
