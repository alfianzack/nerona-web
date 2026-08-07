import { baseUrl } from "./base-url";
import { diBawahMinimum } from "./unduhan";
import { getUnduhanSettings } from "./unduhan-settings";

/**
 * Versi extension yang sedang bicara ke server, dan gerbang yang memakainya.
 *
 * Extension memasang headernya di satu tempat (`access/nerona-web-client.js`),
 * jadi setiap permintaan menyebut dirinya tanpa siapa pun harus mengingatnya
 * per pemanggilan.
 */
export const HEADER_VERSI_EXTENSION = "x-nerona-ext-version";

export interface InfoPembaruan {
  /** Versi yang tersedia di `/unduh`. */
  latest: string;
  /** Versi paling tua yang masih dilayani; kosong berarti tanpa gerbang. */
  min: string;
  /** Ke mana pengguna dikirim untuk memperbaruinya. */
  url: string;
}

export function versiExtensionDari(request: Request): string | null {
  const raw = (request.headers.get(HEADER_VERSI_EXTENSION) || "").trim();
  return raw || null;
}

export async function infoPembaruanExtension(): Promise<InfoPembaruan> {
  const settings = await getUnduhanSettings();
  return {
    latest: settings.extensionVersion,
    min: settings.extensionMinVersion,
    // Halaman `/unduh`, bukan aset ZIP-nya: halaman itu yang memuat petunjuk
    // pemasangannya, dan tautan langsung ke berkas meninggalkan pengguna dengan
    // ZIP di folder Unduhan tanpa tahu harus diapakan.
    url: `${baseUrl().replace(/\/+$/, "")}/unduh`,
  };
}

/**
 * `null` kalau permintaan boleh lewat; `InfoPembaruan` kalau versinya sudah di
 * bawah batas yang dilayani.
 *
 * Aturan siapa yang lolos ada di `diBawahMinimum` — termasuk yang menentukan:
 * batas kosong meloloskan semua orang, dan permintaan tanpa versi tidak lolos.
 */
export async function tolakKalauBasi(request: Request): Promise<InfoPembaruan | null> {
  const info = await infoPembaruanExtension();
  if (!diBawahMinimum(versiExtensionDari(request), info.min)) return null;
  return info;
}
