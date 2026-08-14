import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { Band } from "@/components/ui/Band";
import { MarketplaceMark } from "./marketplace-logos";

/**
 * Deretan marketplace: lambang merek mendahului namanya, kalau lambangnya ada.
 *
 * Sebelumnya bagian ini hanya deretan nama sebagai teks abu-abu. Adobe Stock,
 * Shutterstock, Canva, dan Dreamstime punya lambang yang dikenali seketika;
 * ditulis sebagai kata, mereka tidak meminjamkan otoritas apa pun ke halaman.
 *
 * Namanya tetap ditulis untuk SEMUA, bukan hanya yang tak punya lambang. Dua
 * sebab. Pertama, tiga dari tujuh memang belum punya lambang, dan baris berisi
 * empat gambar plus tiga kata telanjang terbaca seperti aset yang gagal dimuat
 * — sedangkan tujuh pasang lambang-dan-nama terbaca sebagai satu daftar utuh.
 * Kedua, lambang yang tersedia adalah lambang perusahaan, bukan wordmark
 * produknya: lambang Adobe menandakan Adobe, bukan Adobe Stock. Namanya yang
 * menyelesaikan kalimat itu.
 *
 * Warnanya diwarisi, bukan ditambal. Karena lambangnya path inline yang
 * mengambil warna teks induknya, seluruh baris ini teduh dalam satu nada tanpa
 * satu pun penyaring warna — dan berubah bersama saat kursor lewat.
 *
 * Dua bentuk:
 *
 * - `strip` — rak tipis tepat di bawah hero. Pengakuan cepat sebelum
 *   pengunjung menggulir sekali pun.
 * - `band`  — bagian penuh dengan irama pemasaran, untuk halaman yang
 *   memang menaruh deretan ini sebagai bagian tersendiri.
 */
export function MarketplaceRow({ variant = "band" }: { variant?: "band" | "strip" }) {
  const strip = variant === "strip";

  const items = (
    <ul
      className={
        strip
          ? "flex flex-wrap items-center justify-center gap-x-7 gap-y-3"
          : "mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-5"
      }
    >
      {CLAIMABLE_MARKETPLACES.map((marketplace) => (
        <li
          key={marketplace.key}
          className="flex items-center gap-2.5 text-muted transition hover:text-ink"
        >
          <MarketplaceMark marketplaceKey={marketplace.key} />
          <span className={strip ? "text-body font-medium" : "text-body-lg font-semibold"}>
            {marketplace.label}
          </span>
        </li>
      ))}
    </ul>
  );

  /**
   * Rak tipis, bentuk yang sama persis dengan TrustBar supaya keduanya terbaca
   * sebagai satu keluarga kalau kebetulan berdampingan.
   *
   * Sengaja BUKAN Band. Irama pemasaran memberi 104px di atas dan di bawah, dan
   * dengan itu deretan logo berhenti jadi penopang lalu berubah jadi layar
   * penuh kedua sebelum pengunjung sempat menggulir sekali pun. Yang dibutuhkan
   * di bawah hero cuma rak yang menutupnya.
   *
   * Labelnya ikut memendek jadi dua kata dan pindah ke samping: pada rak
   * setipis ini, kalimat pengantar sepanjang satu baris penuh memakan tempat
   * yang seharusnya jadi milik lambangnya.
   */
  if (strip) {
    return (
      <div className="border-t border-border bg-canvas px-6">
        <div className="mx-auto flex max-w-band flex-col items-center gap-4 py-6 sm:flex-row sm:justify-between sm:gap-10">
          <p className="flex-none font-mono text-label uppercase text-muted">Bekerja di</p>
          {items}
        </div>
      </div>
    );
  }

  return (
    <Band align="center">
      {/* Baris pengantar deretan nama: label mono kecil, bentuk yang dipakai
          skala tipografi untuk eyebrow. */}
      <p className="font-mono text-label uppercase text-muted">
        Bekerja di marketplace tempat Anda mengunggah
      </p>
      {items}
    </Band>
  );
}
