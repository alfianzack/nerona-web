/**
 * Bentuk label perangkat: `Extension · Chrome · a3f9c1d2`.
 *
 * Modul ini sengaja bebas prisma dan bebas `next/server` supaya komponen klien
 * boleh mengimpornya. Sebelumnya pemisah " · " ditulis ulang di tiga tempat —
 * panel yang MENYUSUN label, rute yang MEMVALIDASI id, dan `extension-auth`
 * yang MENCOCOKKAN akhirannya saat mencabut. Tiga salinan dari satu format,
 * dan yang gagal kalau salah satunya bergeser bukan build, melainkan
 * pencabutan token — diam-diam, di produksi.
 */

export const INSTALLATION_SEPARATOR = " · ";

/**
 * Id instalasi extension: 4 byte heksadesimal dari `crypto.getRandomValues`.
 *
 * Divalidasi ketat karena nilainya masuk ke filter `endsWith` saat mencabut
 * token. Nilai sembarang di sana bisa melebarkan pencocokan sampai mengenai
 * baris perangkat lain; menolaknya di gerbang jauh lebih murah daripada
 * mempercayai bentuknya di dalam.
 */
export function instalasiSah(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const bersih = raw.trim();
  return /^[0-9a-f]{6,32}$/.test(bersih) ? bersih : null;
}

/** Label untuk token baru. Tanpa id, labelnya tetap dibuat — hanya tidak bisa dipakai mencabut. */
export function labelPerangkat(nama: string, instalasi: string | null): string {
  const id = instalasiSah(instalasi);
  return id ? `${nama}${INSTALLATION_SEPARATOR}${id}` : nama;
}

/**
 * Kebalikannya, untuk ditampilkan di daftar perangkat.
 *
 * Id-nya dipisah dan bukan dibuang: dua Chrome di dua mesin menghasilkan nama
 * yang identik, jadi tanpa id pengguna tidak punya cara menebak baris mana yang
 * ia putuskan. Tapi ia juga tidak layak jadi judul baris — tempatnya di
 * keterangan kecil.
 */
export function pisahLabelPerangkat(label: string | null): {
  nama: string;
  instalasi: string | null;
} {
  const teks = (label || "").trim();
  if (!teks) return { nama: "Perangkat", instalasi: null };

  const pisah = teks.lastIndexOf(INSTALLATION_SEPARATOR);
  if (pisah === -1) return { nama: teks, instalasi: null };

  const ekor = instalasiSah(teks.slice(pisah + INSTALLATION_SEPARATOR.length));
  // Label lama memakai " · " sebagai pemisah biasa ("Extension · Chrome"), jadi
  // potongan terakhir hanya diperlakukan sebagai id kalau bentuknya memang id.
  if (!ekor) return { nama: teks, instalasi: null };

  return { nama: teks.slice(0, pisah), instalasi: ekor };
}
