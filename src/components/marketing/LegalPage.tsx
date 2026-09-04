import { Band } from "@/components/ui/Band";

/**
 * Kerangka halaman legal — Syarat & Ketentuan, Kebijakan Privasi.
 *
 * Ada sebagai komponen karena kedua halaman itu memakai bentuk yang sama persis,
 * dan karena bentuk itu punya satu aturan yang tidak boleh berbeda di antara
 * keduanya: TANGGAL BERLAKU harus terlihat di kepala halaman. Dokumen legal
 * tanpa tanggal tidak bisa dirujuk saat terjadi sengketa — tidak ada yang bisa
 * membuktikan syarat mana yang berlaku ketika pembelian terjadi.
 *
 * Tanggalnya diketik, bukan dihitung dari `new Date()`. Tanggal yang selalu
 * "hari ini" adalah kebalikan dari yang dibutuhkan dokumen ini: ia membuat
 * setiap versi terlihat baru dan tidak satu pun bisa dirujuk. Kalau isinya
 * diubah, tanggalnya ikut diubah tangan — dan memang itu maksudnya.
 *
 * Lebarnya dibatasi 68ch. Halaman ini isinya paragraf panjang, dan lebar pita
 * pemasaran (980px) menghasilkan baris yang terlalu panjang untuk dibaca
 * berurutan.
 */
export function LegalPage({
  title,
  berlakuSejak,
  intro,
  children,
}: {
  title: string;
  berlakuSejak: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="bg-canvas">
      <Band>
        <div className="max-w-[68ch]">
          <p className="font-mono text-label uppercase text-muted">
            Berlaku sejak {berlakuSejak}
          </p>
          <h1 className="mt-4 text-balance text-display-1 text-ink">{title}</h1>
          <p className="mt-6 text-body-lg text-muted">{intro}</p>

          <div className="mt-14 space-y-12">{children}</div>
        </div>
      </Band>
    </main>
  );
}

/**
 * Satu pasal. Judulnya ikut jadi jangkar (`id`) supaya satu pasal bisa
 * ditautkan langsung — yang dibutuhkan tiap kali dukungan menjawab pertanyaan
 * dengan menunjuk satu ketentuan, bukan seluruh halaman.
 */
export function Pasal({
  id,
  judul,
  children,
}: {
  id: string;
  judul: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-title-1 text-ink">{judul}</h2>
      <div className="mt-4 space-y-4 text-body text-muted [&_a]:text-accent [&_a:hover]:underline [&_strong]:text-ink [&_strong]:font-medium">
        {children}
      </div>
    </section>
  );
}

/** Daftar bernomor titik, dipakai di kedua halaman untuk rincian yang berurut. */
export function Daftar({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className="mt-[0.6em] h-1 w-1 flex-none rounded-full bg-muted" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
