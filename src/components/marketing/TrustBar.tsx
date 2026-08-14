import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { bulatkanKeBawah, getMarketingStats } from "@/lib/marketing-stats";

/**
 * Penopang di bawah hero: tiga angka dalam satu baris ramping.
 *
 * Sengaja TIDAK memakai Band. Irama vertikal pemasaran memberi 104px di atas
 * dan 104px di bawah, dan dengan itu baris ini berhenti jadi penopang dan
 * berubah jadi layar penuh kedua sebelum pengunjung sempat menggulir sekali
 * pun. Yang dibutuhkan hanya rak tipis yang menutup hero, jadi jarak dan
 * lebarnya ditulis sendiri di sini — lebar isinya tetap mengikuti wadah
 * pemasaran supaya angkanya berbaris dengan judul di atasnya.
 *
 * Dua angka pertama datang bersama atau tidak sama sekali: getMarketingStats()
 * mengembalikan null selama salah satunya belum melewati ambang, dan sebabnya
 * ditulis panjang di lib/marketing-stats.ts — menampilkan satu saja mengundang
 * pembaca membagi sendiri dan menemukan basis yang kecil. Karena itu null di
 * sini berarti komponen ini tidak merender apa pun: tanpa pembungkus kosong,
 * tanpa garis, tanpa jarak tersisa. Jarak yang tertinggal adalah petunjuk
 * bahwa ada sesuatu yang seharusnya ada di situ, dan itu justru yang paling
 * ingin dihindari dari sebuah baris yang memang boleh absen.
 *
 * Angka ketiga bukan angka traksi. Ia dihitung dari registry marketplace, jadi
 * ia selalu benar dan tidak pernah menunggu basis data — tugasnya menyeimbangkan
 * barisnya jadi tiga, bukan mengaku besar.
 */
export async function TrustBar(): Promise<JSX.Element | null> {
  const stats = await getMarketingStats();
  if (!stats) return null;

  const angka = [
    { nilai: bulatkanKeBawah(stats.metadata), keterangan: "metadata dibuat" },
    { nilai: bulatkanKeBawah(stats.keywords), keterangan: "kata kunci ditulis" },
    {
      // Bukan dari basis data: panjang registry, sama seperti yang dipakai
      // hero dan FAQ, supaya ketiganya mustahil saling bertentangan.
      nilai: String(CLAIMABLE_MARKETPLACES.length),
      keterangan: "marketplace didukung",
    },
  ];

  return (
    // Garis rambut atas memisahkannya dari hero tanpa memberinya latar sendiri:
    // begitu dapat latar, ia terbaca sebagai bagian, bukan penopang.
    <div className="border-t border-border bg-canvas px-6">
      <ul className="mx-auto flex max-w-band flex-col divide-y divide-divider sm:flex-row sm:divide-x sm:divide-y-0">
        {angka.map((item) => (
          <li key={item.keterangan} className="flex-1 px-4 py-5 text-center">
            {/* Mono berlebar-angka-tetap, bentuk yang sama dipakai ubin angka di
                dalam aplikasi: angkanya tidak bergeser saat nilainya berubah,
                dan ketiga kolomnya tetap terbaca sebagai satu keluarga. */}
            <p className="font-mono text-title-1 tabular-nums text-ink">{item.nilai}</p>
            <p className="mt-1 text-caption text-muted">{item.keterangan}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
