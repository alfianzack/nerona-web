import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { rejectAnalyzerAvailability } from "@/lib/marketing-plans";
import { Band } from "@/components/ui/Band";
import { Icon, type IconName } from "@/components/ui/icons";

/**
 * Batas satu batch di ekstensi (BATCH_MAX_ITEMS di nerona_medata).
 *
 * Disalin, bukan diimpor: angkanya hidup di repo ekstensi, jadi tidak ada
 * sumber tunggal yang bisa dipanggil dari sini. HomeMetadataOnly menyimpan
 * salinan yang sama — kalau batasnya berubah, dua tempat ini ikut berubah.
 */
const BATCH_MAX_ITEMS = 50;

interface BarisBanding {
  /** Penanda baris di kolom kiri; sisi kanan memakai penanda seragam. */
  icon: IconName;
  lama: string;
  nerona: string;
  /** Syarat yang membuat janji di kanannya tetap jujur, mis. batas paket. */
  catatan?: string;
}

/**
 * Empat baris, dan tiap sisi kanannya bisa ditunjuk ke kode:
 *
 * 1. Metadata dibuat AI — pekerjaan inti ekstensi.
 * 2. Sekali tulis lalu diisikan ke tiap formulir; jumlah marketplace-nya
 *    dibaca dari registry, bukan diketik.
 * 3. Batas batch nyata, bukan "ratusan gambar sekaligus".
 * 4. Reject analyzer memang membaca gambar bersama alasan penolakannya, dan
 *    syarat paketnya ikut ditulis, tidak disembunyikan. Syarat itu DITURUNKAN
 *    dari baris Plan, tidak diketik: saat ia diketik tangan, kalimat di sini
 *    menyebut satu paket sementara tabel harga beberapa bagian di bawahnya
 *    mencentang ketiganya, dan audit halaman menemukannya sebagai kontradiksi
 *    yang terbaca dalam satu gulir. Seluruh barisnya ikut hilang kalau ternyata
 *    tidak ada paket yang menawarkannya.
 *
 * Yang sengaja TIDAK ada di sini: klaim waktu, persentase penerimaan, dan
 * perbandingan biaya. Tidak satu pun bisa dibuktikan dari basis data hari ini
 * (lihat spec marketing-honesty), dan bagian yang tugasnya meyakinkan adalah
 * bagian yang paling mahal kalau ketahuan mengarang.
 *
 * Kolom kirinya menyebut pekerjaan, bukan orangnya. Pembaca halaman ini
 * mengerjakan persis daftar itu tiap hari; menyebutnya "buang-buang waktu"
 * berarti menghina calon pembeli tepat di kalimat yang ingin dia setujui.
 */
function barisFor(catatanReject: string | null): BarisBanding[] {
  return [
    {
      icon: "tag",
      lama: "Menulis judul, deskripsi, dan puluhan kata kunci sendiri untuk tiap gambar.",
      nerona:
        "Judul, deskripsi, dan kata kunci dibuat AI dari gambarnya — tetap bisa Anda sunting sebelum dikirim.",
    },
    {
      icon: "link",
      lama: "Mengulang seluruhnya untuk tiap marketplace tujuan.",
      nerona: `Ditulis sekali, lalu diisikan ke formulir unggah ${CLAIMABLE_MARKETPLACES.length} marketplace.`,
    },
    {
      icon: "image",
      lama: "Satu gambar selesai dulu, baru gambar berikutnya.",
      nerona: `Sampai ${BATCH_MAX_ITEMS} gambar dalam satu batch, dengan progres per gambar.`,
    },
    {
      icon: "close",
      lama: "Menebak kenapa sebuah gambar ditolak.",
      nerona:
        "Reject analyzer membaca gambar Anda bersama alasan penolakan marketplace, lalu menyebut apa yang perlu diperbaiki.",
      catatan: catatanReject ?? undefined,
    },
  ];
}

/**
 * Perlakuan sel kanan, ditulis sekali karena dipakai lima sel.
 *
 * Tint aksen tipis, bukan warna penuh: sel kanan berisi kalimat panjang, dan
 * teks gelap di atas warna merek pekat kehilangan kontras persis di tempat
 * yang paling perlu dibaca. Garisnya pindah sisi mengikuti lebar layar —
 * pemisah horizontal antar pasangan saat menumpuk, pemisah vertikal di tengah
 * begitu kedua kolom berdampingan.
 */
const SISI_KANAN = "border-t border-border bg-accent/5 md:border-l md:border-t-0";

/**
 * Perbandingan "cara lama vs dengan Nerona".
 *
 * Bentuknya sengaja berbeda dari bagian lain di beranda. Halaman ini punya dua
 * bentuk saja — dua kolom berselang-seling dengan mockup, lalu tumpukan rata
 * tengah — dan keseragaman itulah yang membuatnya terasa panjang. Bagian ini
 * satu-satunya yang membandingkan baris demi baris di satu panel bergaris,
 * jadi ia memecah irama tanpa butuh satu aset gambar pun.
 *
 * Garis tengahnya hanya muncul mulai lebar sedang. Di layar sempit dua kalimat
 * berdampingan tinggal 20-an karakter per baris; pasangannya ditumpuk kiri lalu
 * kanan supaya tiap perbandingan tetap terbaca sebagai satu pasang.
 *
 * Kepala kolom ikut menjadi baris pertama grid — bukan dua judul melayang di
 * atas panel — supaya garis pemisahnya benar-benar mulai dari tepi atas.
 */
export async function ComparisonSection({ id }: { id?: string }) {
  const reject = await rejectAnalyzerAvailability();
  // Baris terakhir dibuang seluruhnya kalau tidak ada paket yang menawarkan
  // reject analyzer. Membiarkannya berdiri tanpa syarat akan menjanjikan fitur
  // yang tidak bisa dibeli siapa pun — kegagalan yang lebih mahal daripada
  // kehilangan satu baris perbandingan.
  const barisTampil = barisFor(reject.note).filter(
    (b) => b.icon !== "close" || reject.plans.length > 0
  );

  return (
    <Band id={id} tone="sunken">
      <h2 className="max-w-[20ch] text-balance text-display-2 text-ink">
        Pekerjaan yang sama, dari dua sisi.
      </h2>
      <p className="mt-5 max-w-[54ch] text-body-lg text-muted">
        Kiri: yang Anda kerjakan sendiri hari ini. Kanan: bagian yang diambil alih Nerona — sisanya
        tetap keputusan Anda.
      </p>

      <div className="mt-12 overflow-hidden rounded-card bg-surface ring-1 ring-border">
        <div className="divide-y divide-divider">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="px-6 py-4 md:px-7">
              <p className="font-mono text-label uppercase text-muted">Cara lama</p>
            </div>
            <div className={`${SISI_KANAN} px-6 py-4 md:px-7`}>
              <p className="font-mono text-label uppercase text-accent">Dengan Nerona</p>
            </div>
          </div>

          {barisTampil.map((baris) => (
            <div key={baris.lama} className="grid grid-cols-1 md:grid-cols-2">
              <div className="flex gap-3.5 px-6 py-6 md:px-7">
                <Icon
                  name={baris.icon}
                  className="mt-[3px] h-[18px] w-[18px] flex-none text-muted"
                />
                <p className="text-body text-muted">{baris.lama}</p>
              </div>
              <div className={`flex gap-3.5 px-6 py-6 md:px-7 ${SISI_KANAN}`}>
                <Icon
                  name="check-circle"
                  className="mt-[3px] h-[18px] w-[18px] flex-none text-accent"
                />
                <div>
                  <p className="text-body text-ink">{baris.nerona}</p>
                  {baris.catatan && (
                    <p className="mt-2 font-mono text-label uppercase text-muted">{baris.catatan}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Band>
  );
}
