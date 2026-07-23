import Link from "next/link";

const PRODUCTS = [
  {
    href: "/metadata",
    icon: "🖼️",
    title: "Nerona Metadata",
    body: "Judul, deskripsi, dan kata kunci dibuat otomatis dengan AI, langsung terisi ke formulir unggah Adobe Stock, Shutterstock, dan lainnya.",
    go: "Pelajari Metadata →",
    stripe: "bg-gradient-to-b from-brand-sky to-brand-blue",
    chip: "bg-brand-blue/15",
    goColor: "text-[#3B65C4]",
  },
  {
    href: "/agent",
    icon: "💬",
    title: "Nerona Agent",
    body: "Asisten AI yang chat langsung di WhatsApp — catat pesanan, ingat pelanggan, dan bantu jawab pertanyaan toko Anda 24 jam.",
    go: "Pelajari Agent →",
    stripe: "bg-gradient-to-b from-gold-400 to-brand-orange",
    chip: "bg-brand-orange/15",
    goColor: "text-[#C25717]",
  },
];

export function ProductCards() {
  return (
    <section className="bg-canvas px-6 pb-16">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2">
        {PRODUCTS.map((product) => (
          <Link
            key={product.href}
            href={product.href}
            className="group relative block overflow-hidden rounded-3xl bg-gradient-to-b from-surface to-surface2 p-7 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10 transition hover:-translate-y-0.5 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <span
              className={`absolute inset-y-0 left-0 w-1.5 ${product.stripe}`}
              aria-hidden="true"
            />
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${product.chip}`}
              aria-hidden="true"
            >
              {product.icon}
            </span>
            <h3 className="mt-4 text-xl font-semibold text-ink">{product.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{product.body}</p>
            <span className={`mt-4 inline-block text-[13px] font-semibold ${product.goColor}`}>
              {product.go}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
