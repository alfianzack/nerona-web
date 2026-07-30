import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/money";

/**
 * Paket poin satuan.
 *
 * Poin selama ini hanya masuk lewat aktivasi/perpanjangan paket, jadi tenant
 * yang kehabisan di tengah masa aktif tidak punya jalan selain minta admin
 * menyesuaikan manual. Ini menutup celah itu, memakai alur transfer bank yang
 * sudah ada — order → unggah bukti → admin konfirmasi.
 *
 * Paket bernominal tetap, bukan isian bebas: admin memverifikasi transfer secara
 * manual, dan nominal ganjil hasil hitungan per-poin jauh lebih repot dicocokkan.
 */
export interface TopupPackage {
  points: number;
  price: number;
}

/** Dipakai saat Setting `topup_packages` kosong. */
export const DEFAULT_TOPUP_PACKAGES: TopupPackage[] = [
  { points: 500, price: 25_000 },
  { points: 1_000, price: 45_000 },
  { points: 5_000, price: 200_000 },
];

export const TOPUP_SETTING_KEY = "topup_packages";

/**
 * Satu paket per baris, `poin=harga` — mis. "1000=45000".
 *
 * Disimpan sebagai teks di satu baris Setting, bukan tabel tersendiri: isinya
 * segelintir angka yang jarang berubah, dan tabel baru berarti migrasi plus CRUD
 * untuk sesuatu yang muat di satu kotak isian.
 */
export function parseTopupPackages(raw: string): TopupPackage[] | null {
  const lines = raw
    .split(/[\n;]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const out: TopupPackage[] = [];
  for (const line of lines) {
    const match = line.match(/^([0-9.\s]+)=([0-9.\s]+)$/);
    if (!match) return null;
    const points = Number(match[1].replace(/[^0-9]/g, ""));
    const price = Number(match[2].replace(/[^0-9]/g, ""));
    // Poin harus positif; harga nol berarti membagikan poin gratis lewat
    // halaman pembelian, yang hampir pasti bukan maksudnya.
    if (!Number.isSafeInteger(points) || points <= 0) return null;
    if (!Number.isSafeInteger(price) || price <= 0) return null;
    out.push({ points, price });
  }
  // Duplikat jumlah poin membuat dua baris tak terbedakan di halaman beli.
  const seen = new Set(out.map((p) => p.points));
  if (seen.size !== out.length) return null;

  return out.sort((a, b) => a.points - b.points);
}

export function formatTopupPackages(packages: TopupPackage[]): string {
  return packages.map((p) => `${p.points}=${p.price}`).join("\n");
}

export async function getTopupPackages(): Promise<TopupPackage[]> {
  const row = await prisma.setting.findUnique({ where: { key: TOPUP_SETTING_KEY } });
  return parseTopupPackages(row?.value ?? "") ?? DEFAULT_TOPUP_PACKAGES;
}

export type UpdateTopupResult = { ok: true } | { ok: false; reason: "invalid" };

export async function updateTopupPackages(raw: string): Promise<UpdateTopupResult> {
  const trimmed = raw.trim();
  // Kosong = kembali ke daftar bawaan, bukan menghapus fitur beli poin.
  if (trimmed !== "" && parseTopupPackages(trimmed) === null) {
    return { ok: false, reason: "invalid" };
  }
  await prisma.setting.upsert({
    where: { key: TOPUP_SETTING_KEY },
    create: { key: TOPUP_SETTING_KEY, value: trimmed },
    update: { value: trimmed },
  });
  return { ok: true };
}

/** Nama paket yang muncul di order, invoice, dan daftar admin. */
export function topupLabel(points: number): string {
  return `${points.toLocaleString("id-ID")} poin`;
}

/** Berapa rupiah per poin — supaya paket besar terlihat lebih hemat. */
export function perPointLabel(pkg: TopupPackage): string {
  const per = pkg.price / pkg.points;
  // Di bawah Rp 1/poin pembulatan ke rupiah menghasilkan "Rp 0/poin".
  return per < 1 ? `${formatRupiah(pkg.price)} / ${pkg.points.toLocaleString("id-ID")} poin` : `≈ ${formatRupiah(Math.round(per))}/poin`;
}
