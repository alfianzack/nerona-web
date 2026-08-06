/**
 * Kapan extension boleh disambungkan TANPA klik.
 *
 * Bebas prisma dan bebas React dengan sengaja, persis seperti `device-label.ts`
 * dan `unduhan.ts`: aturannya dipakai komponen klien, dan aturan inilah bagian
 * yang layak diuji — bukan perkabelan `useEffect` di sekelilingnya.
 *
 * Pembalikan yang diwakili berkas ini dicatat di
 * `docs/superpowers/specs/2026-08-06-sambung-otomatis-extension-design.md`:
 * spek penyambungan sebelumnya memutuskan "satu klik dengan persetujuan
 * eksplisit, bukan nol-klik yang terjadi diam-diam". Pemilik membatalkannya.
 */

import { pisahLabelPerangkat } from "@/lib/device-label";

/** Sepotong `ExtensionToken` yang cukup untuk memutuskan — hanya labelnya. */
export interface BarisTokenBerlabel {
  label: string | null;
}

/**
 * Apakah akun yang sedang login sudah punya token dari instalasi INI.
 *
 * Yang ditanya sengaja bukan "extension punya token?" melainkan "akun ini punya
 * token dari instalasi ini?". Bedanya menentukan saat satu browser dipakai dua
 * akun: extension yang masih memegang token akun A akan menjawab "punya" pada
 * pertanyaan pertama, lalu diam selamanya meski penggunanya sekarang login
 * sebagai B. Pertanyaan kedua membuatnya berpindah ke B.
 *
 * `instalasi` kosong selalu `false` — bukan karena berarti "belum punya",
 * melainkan karena tanpa id tidak ada yang bisa dicocokkan sama sekali. Pemanggil
 * WAJIB menolak keadaan itu lebih dulu; lihat `bolehSambungOtomatis`.
 */
export function punyaTokenInstalasi(
  tokens: readonly BarisTokenBerlabel[],
  instalasi: string | null
): boolean {
  const id = (instalasi || "").trim();
  if (!id) return false;
  return tokens.some((t) => pisahLabelPerangkat(t.label).instalasi === id);
}

export interface KeadaanSambungOtomatis {
  /**
   * Daftar token akun sudah BENAR-BENAR termuat dari server.
   *
   * Dibedakan dari `tokens.length === 0` karena keduanya tidak sama: daftar
   * kosong di render pertama, dan daftar kosong karena permintaannya gagal,
   * dua-duanya terlihat seperti "akun ini belum punya token". Menyambung atas
   * dasar itu berarti mencetak kredensial permanen atas dasar ketidaktahuan.
   */
  tokensDimuat: boolean;
  /** Id instalasi dari pesan `HADIR`. `null` = build lama yang belum mengirimnya. */
  instalasi: string | null;
  tokens: readonly BarisTokenBerlabel[];
  /** Sedang ada penyambungan berjalan. */
  sibuk: boolean;
  /** Sudah pernah menembak di sesi halaman ini. */
  sudahDicoba: boolean;
}

/**
 * Aturan tunggalnya. Sengaja satu fungsi dan bukan rantai `if` di komponen:
 * setiap syarat di sini mencegah satu cara mencetak kredensial penuh yang tidak
 * diminta siapa pun, dan syarat yang tidak diuji adalah syarat yang tidak
 * diketahui masih berlaku.
 *
 * Build lama (`instalasi` null) sengaja TIDAK ikut. `issueExtensionToken`
 * mencabut token lama dengan mencocokkan akhiran label pada id instalasi; tanpa
 * id, tidak ada yang tercabut — dan penyambungan otomatis tanpa pencabutan
 * mencetak satu token baru setiap kali halaman dibuka. Untuk build itu tombol
 * manualnya tetap ada.
 */
export function bolehSambungOtomatis(keadaan: KeadaanSambungOtomatis): boolean {
  if (keadaan.sudahDicoba) return false;
  if (keadaan.sibuk) return false;
  if (!keadaan.tokensDimuat) return false;
  if (!(keadaan.instalasi || "").trim()) return false;
  return !punyaTokenInstalasi(keadaan.tokens, keadaan.instalasi);
}
