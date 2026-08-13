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
 */
export function MarketplaceRow() {
  return (
    <Band align="center">
      {/* Baris pengantar deretan nama: label mono kecil, bentuk yang dipakai
          skala tipografi untuk eyebrow. */}
      <p className="font-mono text-label uppercase text-muted">
        Bekerja di marketplace tempat Anda mengunggah
      </p>
      <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
        {CLAIMABLE_MARKETPLACES.map((marketplace) => (
          <li
            key={marketplace.key}
            className="flex items-center gap-2.5 text-muted transition hover:text-ink"
          >
            <MarketplaceMark marketplaceKey={marketplace.key} />
            <span className="text-body-lg font-semibold">{marketplace.label}</span>
          </li>
        ))}
      </ul>
    </Band>
  );
}
