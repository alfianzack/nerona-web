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

export function ContributorPainSection() {
  return (
    <section className="bg-surface2 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-balance text-center text-3xl font-semibold tracking-tight text-ink">
          Kenapa unggahan Anda tertahan
        </h2>
        <p className="mx-auto mt-2.5 max-w-2xl text-center text-[15px] text-muted">
          Bukan karyanya yang lambat — pekerjaan sesudahnyalah yang lambat.
        </p>
        <div className="mt-11 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PAINS.map((pain) => (
            <div
              key={pain.quote}
              className="flex flex-col gap-2.5 rounded-2xl bg-surface p-6 ring-1 ring-navy-900/10"
            >
              <span
                className="h-[3px] w-7 rounded-full bg-gradient-to-r from-gold-500 to-gold-400"
                aria-hidden="true"
              />
              <p className="text-[17px] font-semibold leading-snug tracking-tight text-ink">
                &ldquo;{pain.quote}&rdquo;
              </p>
              <p className="text-[13.5px] leading-relaxed text-muted">{pain.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
