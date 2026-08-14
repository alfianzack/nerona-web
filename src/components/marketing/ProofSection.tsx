import Image from "next/image";

import { Band } from "@/components/ui/Band";
import { Card } from "@/components/ui/Card";
import { METADATA_SAMPLES, type MetadataSample } from "@/lib/marketing-samples";

/**
 * Dua belas kata kunci yang ditampilkan.
 *
 * Cukup banyak untuk dinilai — kontributor membaca selusin istilah dan langsung
 * tahu apakah AI-nya paham gambar — tapi masih cukup sedikit untuk dibaca
 * seluruhnya, bukan dilewati. Sisanya disebut sebagai angka, karena menampilkan
 * kelimapuluhnya mengubah bukti jadi dinding teks.
 */
const KEYWORDS_SHOWN = 12;

/**
 * Bagian bukti: foto sungguhan, di sebelah metadata sungguhan untuk foto itu.
 *
 * Ini bagian terpenting di halaman. Semua bagian lain MENGATAKAN bahwa AI-nya
 * menulis metadata yang baik; hanya bagian ini yang MEMPERLIHATKANNYA, dan
 * pengunjung menilai mutunya langsung dari kata kuncinya. Karena itu kata
 * kuncinya dirender pada skala body, bukan caption — di halaman ini merekalah
 * isinya, bukan hiasan di bawah gambar.
 *
 * Dua keputusan bentuk, keduanya punya sebab:
 *
 * 1. Contoh ditumpuk, TIDAK bolak-balik kiri-kanan. Halaman ini sudah memakai
 *    pola dua kolom berselang-seling empat kali berturut-turut, dan justru itu
 *    yang membuatnya terbaca monoton. Foto selalu di sisi yang sama, jadi mata
 *    pembaca berhenti mencari dan mulai membandingkan.
 * 2. Mengembalikan null selama datanya kosong. Bingkai gambar kosong lebih buruk
 *    daripada tidak ada bagian sama sekali — ia memberi tahu pengunjung bahwa
 *    ada yang belum jadi. Bagiannya menyala sendiri begitu asetnya masuk.
 *
 * Angka detiknya sengaja tidak dibulatkan. Pembacaan yang tepat justru lebih
 * dipercaya daripada angka bulat, sebab angka bulat terbaca sebagai perkiraan
 * pemasaran.
 */
export function ProofSection({
  id,
  title,
  body,
}: {
  id?: string;
  title: string;
  body: string;
}): JSX.Element | null {
  // Disaring per entri, bukan sekadar dicek kosong: teks metadata dan berkas
  // karyanya datang terpisah, jadi entri boleh terisi lengkap teksnya sambil
  // menunggu gambarnya. Sebabnya ditulis di lib/marketing-samples.ts.
  const samples = METADATA_SAMPLES.filter((sample) => sample.imageReady);
  if (samples.length === 0) return null;

  return (
    <Band id={id} tone="sunken">
      <h2 className="max-w-[20ch] text-balance text-display-2 text-ink">{title}</h2>
      <p className="mt-5 max-w-2xl text-body-lg text-muted">{body}</p>

      <div className="mt-12 space-y-6">
        {samples.map((sample) => (
          <SampleCard key={sample.src} sample={sample} />
        ))}
      </div>
    </Band>
  );
}

function SampleCard({ sample }: { sample: MetadataSample }) {
  const shown = sample.keywords.slice(0, KEYWORDS_SHOWN);
  // Sisanya dihitung dari total sebenarnya, bukan dari panjang array: entri
  // boleh menyimpan dua belas kata kunci saja sementara generate-nya menghasilkan
  // lima puluh. Dijaga agar tidak pernah negatif kalau totalnya salah tulis.
  const sisa = Math.max(0, sample.keywordTotal - shown.length);

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Pembungkus yang menentukan tinggi, bukan gambarnya: di layar sempit
            lewat rasio 4:3, di layar lebar lewat tinggi barisnya di kisi —
            sehingga foto selalu setinggi kolom metadata di sebelahnya. */}
        <div className="relative aspect-[4/3] bg-surface-sunken md:aspect-auto md:min-h-[20rem]">
          <Image
            src={sample.src}
            alt={sample.alt}
            width={1200}
            height={900}
            sizes="(min-width: 768px) 45vw, 100vw"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        <div className="p-7 sm:p-9">
          <p className="font-mono text-label uppercase text-muted">Metadata yang dihasilkan</p>

          {/* Judul dan deskripsi berbahasa Inggris apa adanya — lihat sebab
              lengkapnya di docblock lib/marketing-samples.ts. */}
          <h3 className="mt-3 text-title-2 text-ink">{sample.title}</h3>
          {sample.description && (
            <p className="mt-2.5 text-body text-muted">{sample.description}</p>
          )}

          {/* Saat generate menyentuh plafon marketplace-nya, angkanya ditulis
              sebagai pecahan. "20 dari 20 maksimum Canva" membuktikan sesuatu
              yang jumlah telanjang tidak bisa: alatnya tahu batas tujuannya,
              bukan memuntahkan daftar yang sama ke semua marketplace. */}
          <p className="mt-7 font-mono text-label uppercase text-muted">
            {sample.keywordCap === sample.keywordTotal && sample.keywordCap ? (
              <>
                <span className="tabular-nums text-ink">
                  {sample.keywordTotal} dari {sample.keywordCap}
                </span>{" "}
                kata kunci &mdash; maksimum {sample.marketplace}
              </>
            ) : (
              <>
                <span className="tabular-nums text-ink">{sample.keywordTotal}</span> kata kunci
              </>
            )}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {shown.map((keyword) => (
              <li
                key={keyword}
                className="rounded-chip bg-accent/10 px-3 py-1.5 text-body font-medium text-accent"
              >
                {keyword}
              </li>
            ))}
            {sisa > 0 && (
              // Tanpa latar dan tanpa warna aksen: ini catatan, bukan kata
              // kunci, dan tidak boleh ikut terbaca sebagai salah satunya.
              <li className="px-1.5 py-1.5 text-body text-muted">+{sisa} lagi</li>
            )}
          </ul>

          <p className="mt-7 border-t border-divider pt-4 font-mono text-caption text-muted">
            {sample.marketplace}
            {/* Detiknya cuma ditulis kalau benar-benar diukur. Tidak ada yang
                mencatatnya — bukan basis data, bukan panel ekstensi — jadi
                mengisinya dengan perkiraan berarti mengarang pengukuran. */}
            {sample.seconds !== undefined && (
              <>
                {" "}
                &middot; <span className="tabular-nums">{formatDetik(sample.seconds)}</span> detik
              </>
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Satu angka di belakang koma, gaya Indonesia.
 *
 * Minimum satu digit dipertahankan supaya 8 tampil sebagai "8,0": pada baris
 * keterangan ini angkanya terbaca sebagai hasil pengukuran, dan pengukuran
 * memang punya presisi.
 */
function formatDetik(seconds: number): string {
  return seconds.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
