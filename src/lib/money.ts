/**
 * Satu-satunya tempat teks harga dari owner diubah jadi angka.
 *
 * Dipakai paket Metadata (kolom `Plan.priceMonthly`) dan paket Agent (Setting).
 * Kalau tiap sisi punya aturan sendiri, "Rp 59.000" bisa diterima di satu tempat
 * dan diam-diam ditolak di tempat lain — lalu harga kembali ke bawaan tanpa ada
 * pesan apa pun ke owner.
 *
 * - `null`      : kosong, artinya harga sengaja dihapus
 * - `undefined` : tidak bisa dibaca sebagai rupiah, harus ditolak ke pemanggil
 */
export function parseRupiahInput(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  // Terima "99000", "99.000", dan "Rp 99.000" — semuanya lazim diketik owner.
  if (!/^(rp)?[\s.,0-9]+$/i.test(trimmed)) return undefined;
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits === "") return undefined;
  const n = Number(digits);
  return Number.isSafeInteger(n) && n >= 0 ? n : undefined;
}

export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}
