/**
 * Alamat publik aplikasi ini.
 *
 * Bukan sekadar kenyamanan: nilainya dikirim KELUAR, ke perangkat lunak yang
 * berjalan di mesin orang lain.
 *
 * - `/api/extension/pair/start` menaruhnya di `approveUrl`, dan Nerona Hub
 *   membuka alamat itu di browser pengguna.
 * - `/api/extension/me` menaruhnya di `update.url`, dan extension memakainya
 *   untuk tombol "Buka halaman unduh".
 *
 * Sebelumnya berbunyi `process.env.NEXTAUTH_URL || "http://localhost:3000"`.
 * `NEXTAUTH_URL` ternyata tidak terpasang di Vercel, jadi produksi membagikan
 * `http://localhost:3000/hubungkan?kode=…` ke SETIAP Hub yang mencoba
 * menyambung — tanpa satu pun galat di sisi mana pun. Browser pengguna hanya
 * membuka alamat yang tidak akan pernah ada di mesin mereka, dan penyebabnya
 * mustahil ditebak dari gejalanya.
 *
 * Karena itu localhost sekarang jadi jalan TERAKHIR, bukan jalan kedua.
 */
export function baseUrl(): string {
  const bersih = (nilai: string | undefined) => (nilai ?? "").trim().replace(/\/+$/, "");

  // Disetel manusia, dan satu-satunya yang tahu domain kustom. Selalu menang.
  const eksplisit = bersih(process.env.NEXTAUTH_URL);
  if (eksplisit) return eksplisit;

  // Disuntik Vercel. `VERCEL_PROJECT_PRODUCTION_URL` adalah domain produksi yang
  // tetap; `VERCEL_URL` berubah tiap deploy, jadi ia hanya cadangan — tapi
  // cadangan yang benar jauh lebih baik daripada localhost yang pasti salah.
  const vercel = bersih(process.env.VERCEL_PROJECT_PRODUCTION_URL) || bersih(process.env.VERCEL_URL);
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;

  return "http://localhost:3000";
}
