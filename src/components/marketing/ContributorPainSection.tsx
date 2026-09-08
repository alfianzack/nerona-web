import { Band } from "@/components/ui/Band";

/**
 * Satu paragraf, kolom sempit, tanpa kartu.
 *
 * Sebelumnya: judul rata tengah, kalimat pembuka, lalu tiga kartu kutipan
 * dengan paragraf masing-masing — sekitar 90 kata untuk satu gagasan. Ketiga
 * kutipan itu tidak salah; yang salah adalah memberi mereka satu pita penuh
 * seukuran pita harga.
 *
 * Yang dipotong bukan hanya kata, tapi KEPADATAN. Halaman ini terasa monoton
 * karena setiap seksi punya bobot yang sama: judul, subjudul, paragraf,
 * bullet, kartu. Beberapa seksi harus terasa hampir kosong, dan ruang kosong
 * itulah yang membuat seksi padat di bawahnya masih terbaca. Ini salah
 * satunya, dan itu sebab ia tidak boleh "dilengkapi" lagi nanti.
 *
 * Rata kiri di kolom 46ch, bukan rata tengah selebar pita: prosa rata tengah
 * sepanjang tiga kalimat memaksa mata mencari awal baris setiap kali.
 */
export function ContributorPainSection() {
  return (
    <Band>
      <div className="max-w-[46ch]">
        <h2 className="text-balance text-display-2 text-ink">Kenapa unggahan Anda tertahan</h2>
        <p className="mt-5 text-pretty text-lead text-muted">
          Bukan karyanya yang lambat — pekerjaan sesudahnyalah yang lambat. Satu gambar butuh
          judul, deskripsi, dan puluhan kata kunci. Lalu diulang, per marketplace.
        </p>
      </div>
    </Band>
  );
}
