/**
 * Satu ukuran halaman untuk semua tabel dan daftar baris di aplikasi. Sebelum
 * ini tiap daftar punya angkanya sendiri (20, 25, 48, 50, 100) dan sebagian
 * tidak punya batas sama sekali, jadi daftar yang lewat batasnya diam-diam
 * kehilangan baris lama tanpa cara untuk melihatnya.
 */
export const PAGE_SIZE = 25;

/** Nomor halaman dari query string. Apa pun yang bukan bilangan bulat positif jadi 1. */
export function parsePage(value: string | string[] | null | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
}

/**
 * Menjalankan hitungan dan potongan halaman sekaligus, lalu mengulang sekali
 * dengan halaman terakhir kalau yang diminta sudah lewat ujung. Itu terjadi
 * saat baris terakhir di sebuah halaman baru saja dihapus atau diproses:
 * tanpa penjepit ini layar menampilkan "Hal 3 / 2" dan daftar kosong.
 * Jalur normal tetap satu putaran ke basis data.
 */
export async function paginate<T>(
  page: number,
  count: () => Promise<number>,
  fetchRows: (skip: number, take: number) => Promise<T[]>,
  pageSize = PAGE_SIZE
): Promise<Paged<T>> {
  const [total, rows] = await Promise.all([count(), fetchRows((page - 1) * pageSize, pageSize)]);
  const last = pageCount(total, pageSize);
  if (page > last) {
    return { rows: await fetchRows((last - 1) * pageSize, pageSize), total, page: last };
  }
  return { rows, total, page };
}

/**
 * Satu halaman dari gabungan dua daftar yang masing-masing sudah terurut.
 * Pemanggil mengambil `page * pageSize` baris teratas dari tiap sumber: itu
 * cukup untuk menjamin semua baris di jendela halaman ini ada, apa pun
 * perbandingan campurannya.
 */
export function mergePage<T>(
  a: T[],
  b: T[],
  compare: (x: T, y: T) => number,
  page: number,
  pageSize = PAGE_SIZE
): T[] {
  return [...a, ...b].sort(compare).slice((page - 1) * pageSize, page * pageSize);
}

/**
 * Tautan ke halaman lain dari daftar yang sama, dengan parameter lain di URL
 * dibiarkan utuh: /finance punya dua daftar berhalaman, dan pindah halaman di
 * satu daftar tidak boleh mengembalikan daftar satunya ke halaman 1.
 * Halaman 1 ditulis tanpa parameter supaya URL dasarnya tetap satu.
 */
export function pageHref(
  path: string,
  current: Record<string, string | string[] | undefined>,
  key: string,
  page: number
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (k !== key && value) params.set(k, value);
  }
  if (page > 1) params.set(key, String(page));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
