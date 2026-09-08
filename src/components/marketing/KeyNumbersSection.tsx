import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { Band } from "@/components/ui/Band";

/**
 * Batas satu batch di ekstensi (BATCH_MAX_ITEMS di nerona_medata).
 *
 * Disalin, bukan diimpor: angkanya hidup di repo ekstensi, jadi tidak ada
 * sumber tunggal yang bisa dipanggil dari sini. Kalau batasnya berubah,
 * berkas ini ikut berubah.
 */
const BATCH_MAX_ITEMS = 50;

/**
 * Tiga angka, nol paragraf.
 *
 * Menggantikan seksi "Satu klik. N marketplace." yang menjelaskan hal yang
 * sama tiga kali — subjudul, paragraf, dan mockup — untuk menyampaikan satu
 * angka. Informasi yang sama, sepersepuluh kata.
 *
 * Kepadatan rendahnya bukan kebetulan: halaman ini terasa monoton karena
 * setiap seksi punya bobot yang sama, dan ruang kosong di sinilah yang
 * membuat seksi padat di bawahnya masih terbaca.
 *
 * Ketiga angkanya BUKAN angka traksi. Dua dihitung dari registry marketplace
 * dan dari batas batch ekstensi; yang ketiga dari tarif yang sedang berlaku,
 * dan HILANG kalau tarifnya belum bisa dihitung — halaman ini tidak menebak
 * angka (lihat lib/marketing-points.ts).
 *
 * Warnanya `text-emphasis`, bukan `text-action`: amber mentah gagal kontras
 * sebagai teks di atas putih, dan numeral sebesar ini justru yang paling
 * terlihat kalau warnanya salah. Lihat tests/lib/marketing-palette.test.ts.
 */
export function KeyNumbersSection({ poinPerGambar }: { poinPerGambar: number | null }) {
  const angka = [
    { nilai: String(CLAIMABLE_MARKETPLACES.length), label: "marketplace" },
    { nilai: String(BATCH_MAX_ITEMS), label: "gambar per batch" },
    ...(poinPerGambar !== null && poinPerGambar > 0
      ? [
          {
            nilai: `≈${poinPerGambar.toLocaleString("id-ID")}`,
            label: "poin per gambar",
          },
        ]
      : []),
  ];

  return (
    <Band>
      <ul className="grid grid-cols-1 gap-10 text-center sm:grid-cols-3">
        {angka.map((item) => (
          <li key={item.label}>
            {/* Mono berlebar-angka-tetap, bentuk yang sama dipakai TrustBar dan
                ubin angka di dalam aplikasi: ketiga kolomnya terbaca sebagai
                satu keluarga, dan angkanya tidak bergeser saat nilainya
                berubah. */}
            <p className="font-mono text-display-2 tabular-nums text-emphasis">{item.nilai}</p>
            <p className="mt-2 text-body-lg text-muted">{item.label}</p>
          </li>
        ))}
      </ul>
    </Band>
  );
}
