/**
 * Identitas dan saluran kontak Nerona — satu sumber untuk seluruh situs.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * KENAPA INI ADA
 * ─────────────────────────────────────────────────────────────────────────
 * Audit halaman jualan menyebut ketiadaan kontak sebagai penghambat kepercayaan
 * TERBESAR di situs ini, dan alasannya khas untuk model bisnis Nerona: pembeli
 * diminta mentransfer uang ke rekening, lalu menunggu "tim kami" memverifikasi.
 * Kalau di seluruh halaman tidak ada satu pun cara menghubungi tim itu, yang
 * diminta bukan pembelian — yang diminta kepercayaan buta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * KENAPA SATU BERKAS
 * ─────────────────────────────────────────────────────────────────────────
 * Dipakai di footer, halaman Syarat & Ketentuan, halaman Kebijakan Privasi, dan
 * layar checkout. Nomor yang diketik di empat tempat akan berbeda di salah
 * satunya begitu nomornya ganti, dan yang salah justru yang dibaca orang tepat
 * setelah ia mentransfer uang — saat ongkos salah nomor paling mahal.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * YANG SENGAJA TIDAK ADA DI SINI
 * ─────────────────────────────────────────────────────────────────────────
 * Nomor akta, NPWP, dan alamat kantor. Nerona hari ini belum menyebutkan badan
 * usaha berbadan hukum, dan mengarang nomor registrasi di halaman Syarat &
 * Ketentuan bukan sekadar tidak jujur — ia adalah pernyataan palsu di dokumen
 * yang justru dibaca orang saat terjadi sengketa. Kalau nanti ada badan usaha
 * resmi, tambahkan di sini dan kedua halaman legal ikut menyebutnya sendiri.
 */
export const KONTAK = {
  /** Nama yang dipakai di dokumen legal sebagai pihak penyedia layanan. */
  nama: "Nerona",
  email: "fahmii.alfiansyah@gmail.com",
  /**
   * E.164 tanpa tanda plus — bentuk yang dituntut wa.me. Yang dibaca manusia
   * dibentuk oleh formatNomorWa, jadi tidak ada dua versi nomor di kode.
   */
  waNomor: "628995005232",
} as const;

/** Angka saja: wa.me menolak spasi, tanda plus, dan strip. */
function digitsOnly(nomor: string): string {
  return nomor.replace(/\D/g, "");
}

/**
 * Bentuk yang enak dibaca: "+62 899 5005 232".
 *
 * Pengelompokan 2-3-4-sisa mengikuti cara nomor seluler Indonesia biasa
 * ditulis. Nomor dari negara lain tetap keluar utuh dan terbaca, hanya
 * pengelompokannya yang tidak khas — lebih baik daripada memotongnya salah.
 */
export function formatNomorWa(nomor: string): string {
  const d = digitsOnly(nomor);
  if (!d) return "";
  const negara = d.slice(0, 2);
  const sisa = d.slice(2);
  const bagian = [sisa.slice(0, 3), sisa.slice(3, 7), sisa.slice(7)].filter(Boolean);
  return `+${negara} ${bagian.join(" ")}`.trimEnd();
}

/**
 * Tautan wa.me siap pakai, dengan pesan pembuka opsional.
 *
 * Membangunnya dengan template string di komponen adalah cara paling mudah
 * mengirim orang ke tautan mati — satu spasi di nomornya sudah cukup.
 */
export function waLink(nomor: string, pesan?: string): string {
  const dasar = `https://wa.me/${digitsOnly(nomor)}`;
  return pesan ? `${dasar}?text=${encodeURIComponent(pesan)}` : dasar;
}

/** Nomor apa adanya untuk ditampilkan, tanpa pemanggil perlu tahu bentuk simpanannya. */
export const WA_TAMPIL = formatNomorWa(KONTAK.waNomor);
