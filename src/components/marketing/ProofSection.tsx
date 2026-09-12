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
  tone = "sunken",
}: {
  id?: string;
  title: string;
  body: string;
  tone?: "sunken" | "plain" | "ruang";
}): JSX.Element | null {
  // Disaring per entri, bukan sekadar dicek kosong: teks metadata dan berkas
  // karyanya datang terpisah, jadi entri boleh terisi lengkap teksnya sambil
  // menunggu gambarnya. Sebabnya ditulis di lib/marketing-samples.ts.
  const samples = METADATA_SAMPLES.filter((sample) => sample.imageReady);
  if (samples.length === 0) return null;

  return (
    <Band id={id} tone={tone} reveal>
      <h2 className="max-w-[20ch] text-balance text-display-2 text-ink">{title}</h2>
      <p className="mt-5 max-w-2xl text-body-lg text-muted">{body}</p>

      {/* Jumlah kolom mengikuti jumlah contoh, TIDAK dipatok tiga.
          Grid tiga kolom yang diisi satu kartu meninggalkan dua pertiga baris
          kosong — diukur di produksi: kartu 311px di dalam baris 980px, 669px
          menganga di sebelahnya. Yang terbaca bukan "contohnya baru satu",
          melainkan "ada dua yang gagal dimuat", dan itu terjadi tepat di
          bagian yang seluruh tugasnya membangun kepercayaan.

          Satu contoh karena itu memakai kartu MELEBAR — gambar di kiri,
          metadata di kanan — yang memakai lebar pita apa adanya. Dua atau
          lebih kembali ke kartu tegak berdampingan, karena di sanalah bentuk
          tegak memang menang: tiga kartu dua-kolom yang berjajar menyisakan
          kolom teks selebar 20-an karakter, dan kata kunci itulah isi bagian
          ini.

          Dua contoh sisanya (foto dan render 3D) menunggu karya sungguhan
          beserta metadata yang benar-benar dihasilkan untuknya; mengarangnya
          melanggar aturan yang dijaga docblock lib/marketing-samples.ts.
          Bentuknya berganti sendiri begitu entrinya masuk. */}
      <div
        className={
          "mt-12 grid gap-6 " +
          (samples.length === 1 ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-3")
        }
      >
        {samples.map((sample) => (
          <SampleCard key={sample.src} sample={sample} lebar={samples.length === 1} />
        ))}
      </div>
    </Band>
  );
}

function SampleCard({
  sample,
  lebar = false,
}: {
  sample: MetadataSample;
  /** Satu-satunya contoh di halaman: gambar di kiri, metadata di kanan. */
  lebar?: boolean;
}) {
  const shown = sample.keywords.slice(0, KEYWORDS_SHOWN);
  // Sisanya dihitung dari total sebenarnya, bukan dari panjang array: entri
  // boleh menyimpan dua belas kata kunci saja sementara generate-nya menghasilkan
  // lima puluh. Dijaga agar tidak pernah negatif kalau totalnya salah tulis.
  const sisa = Math.max(0, sample.keywordTotal - shown.length);

  return (
    <Card padding="none" className="overflow-hidden">
      <div
        className={
          lebar
            ? "grid sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
            : "flex h-full flex-col"
        }
      >
        {/* Pembungkus yang menentukan tinggi, bukan gambarnya: di layar sempit
            lewat rasio 4:3, di layar lebar lewat tinggi barisnya di kisi —
            sehingga karyanya selalu setinggi kolom metadata di sebelahnya.

            Dimuat penuh ke dalam bingkai, bukan diisikan sampai terpotong.
            Kontributor stock mengunggah ilustrasi dan vektor, bukan cuma foto,
            dan pada karya vektor pemotongan tepi memenggal bagian yang justru
            dinamai kata kuncinya — garpu sebuah forklift, misalnya. Karya yang
            terpotong di bagian bukti melemahkan persis hal yang sedang
            dibuktikan. */}
        <div
          className={
            "relative bg-surface-sunken p-6 " +
            // Rasio 4:3 di layar sempit; begitu kartunya melebar, tingginya
            // ditentukan tinggi barisnya supaya karyanya selalu setinggi kolom
            // metadata di sebelahnya — bukan menyisakan pita kosong di bawah
            // salah satunya.
            (lebar ? "aspect-[4/3] sm:aspect-auto sm:min-h-[22rem]" : "aspect-[4/3]")
          }
        >
          <Image
            src={sample.src}
            alt={sample.alt}
            width={1400}
            height={1050}
            sizes={
              lebar
                ? "(min-width: 640px) 45vw, 100vw"
                : "(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
            }
            className="absolute inset-0 h-full w-full p-6 object-contain"
          />
        </div>

        <div className="flex flex-1 flex-col p-7">
          {/* Bentuk karya + marketplace, di KEPALA kartu.
              Sebelumnya nama marketplace-nya berdiri sendirian di kaki kartu,
              sesudah kata kuncinya — tempat yang dibaca paling akhir, kalau
              sempat. Padahal inilah yang menjawab pertanyaan pertama pembaca:
              "apakah alat ini paham bentuk karya yang SAYA kerjakan?".
              Titiknya memakai warna hasil (mint), warna yang halaman ini pakai
              untuk apa pun yang datang dari AI. */}
          <p className="flex items-center gap-2 text-caption text-muted">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-result" />
            {sample.jenis} &middot; {sample.marketplace}
          </p>
          <p className="mt-4 font-mono text-label uppercase text-muted">Metadata yang dihasilkan</p>

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
                className="rounded-chip bg-result-bg px-3 py-1.5 text-body font-medium text-result-ink"
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

          {/* Nama marketplace-nya PINDAH ke kepala kartu, jadi kaki ini
              tinggal memuat detiknya — dan seluruh barisnya hilang kalau
              detiknya tidak ada. Menyisakan garis pemisah dengan baris kosong
              di bawahnya membuat kartu terlihat seperti ada yang gagal dimuat.

              Detiknya sendiri cuma ditulis kalau benar-benar diukur. Tidak ada
              yang mencatatnya — bukan basis data, bukan panel ekstensi — jadi
              mengisinya dengan perkiraan berarti mengarang pengukuran. */}
          {sample.seconds !== undefined && (
            <p className="mt-7 border-t border-divider pt-4 font-mono text-caption text-muted">
              <span className="tabular-nums">{formatDetik(sample.seconds)}</span> detik
            </p>
          )}
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
