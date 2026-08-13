import { Band } from "@/components/ui/Band";
import { Card } from "@/components/ui/Card";

/**
 * Tiga keluhan yang bikin unggahan tertahan — bentuknya meniru halaman
 * jualan sejenis, tapi TANPA statistik: tidak ada angka yang tidak bisa
 * kita buktikan (lihat spec marketing-honesty).
 */
const PAINS = [
  {
    quote: "Karyanya sudah siap. Metadatanya belum.",
    body: "Satu gambar butuh judul, deskripsi, dan puluhan kata kunci. Dikerjakan tangan, itu menit yang hilang sebelum karya pertama naik.",
  },
  {
    quote: "500 gambar. Proses yang sama. Setiap kali.",
    body: "Batch besar bukan pekerjaan yang lebih sulit — hanya pekerjaan yang sama, diulang sampai Anda berhenti.",
  },
  {
    quote: "Tiap marketplace punya aturannya sendiri.",
    body: "Batas kata kunci, format judul, gaya deskripsi — semuanya berbeda, dan salah format berarti ditolak.",
  },
];

/**
 * Skala tipografinya tetap yang paling digarap di halaman ini, hanya sekarang
 * memakai nama dari skala bersama alih-alih ukuran piksel lepas: judul bagian
 * text-display-2, kalimat pembuka text-lead, kutipan text-title-2.
 *
 * Garis emas 3px di atas tiap kutipan dibuang. Emas tidak dipakai di halaman
 * publik sama sekali, dan garis itu tidak menandai apa pun — persis jenis
 * hiasan yang membuat halaman terbaca sebagai dirakit, bukan dirancang.
 */
export function ContributorPainSection() {
  return (
    <Band tone="sunken">
      <h2 className="text-balance text-center text-display-2 text-ink">
        Kenapa unggahan Anda tertahan
      </h2>
      <p className="mx-auto mt-5 max-w-2xl text-balance text-center text-lead text-muted">
        Bukan karyanya yang lambat — pekerjaan sesudahnyalah yang lambat.
      </p>
      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {PAINS.map((pain) => (
          <Card key={pain.quote} padding="lg" className="flex flex-col gap-2.5">
            <p className="text-title-2 text-ink">&ldquo;{pain.quote}&rdquo;</p>
            <p className="text-body text-muted">{pain.body}</p>
          </Card>
        ))}
      </div>
    </Band>
  );
}
