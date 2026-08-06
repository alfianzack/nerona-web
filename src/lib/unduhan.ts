/**
 * Bentuk dan aturan tautan unduhan. Bebas prisma **dengan sengaja**: panel
 * admin dan panel extension keduanya komponen klien, dan keduanya butuh
 * `tautanAman`/`butuhPembaruan`. Pembacanya yang menyentuh basis data tinggal
 * di `unduhan-settings.ts`, persis seperti `device-label.ts` dipisah dari
 * `extension-auth.ts`.
 *
 * Ketiga artefak (extension ZIP, installer Windows, installer macOS) tidak
 * tinggal di repo ini. Semuanya aset rilis di `alfianzack/nerona-hub-releases`,
 * dan yang kita simpan cuma URL-nya — supaya rilis baru tidak menuntut deploy
 * ulang, dan supaya berkas 22 MB tidak pernah masuk riwayat git.
 */

export interface UnduhanSettings {
  hubWindowsUrl: string;
  hubMacUrl: string;
  hubVersion: string;
  extensionUrl: string;
  extensionVersion: string;
}

export const UNDUHAN_KEYS: Record<keyof UnduhanSettings, string> = {
  hubWindowsUrl: "hub_download_windows",
  hubMacUrl: "hub_download_mac",
  hubVersion: "hub_version",
  extensionUrl: "extension_download_url",
  extensionVersion: "extension_version",
};

export const UNDUHAN_KOSONG: UnduhanSettings = {
  hubWindowsUrl: "",
  hubMacUrl: "",
  hubVersion: "",
  extensionUrl: "",
  extensionVersion: "",
};

/**
 * URL yang boleh dipasang ke `href`, atau `null` kalau tidak boleh.
 *
 * Nilainya diketik manusia di panel admin lalu langsung jadi atribut `href`,
 * jadi `javascript:` tidak boleh punya jalan ke sana. `http://` juga ditolak:
 * aset GitHub selalu `https`, jadi menerimanya cuma menambah satu cara gagal
 * tanpa menambah satu pun kemampuan.
 *
 * `null` bukan keadaan galat — itu keadaan **"Belum tersedia"**, yang memang
 * berlaku sampai owner mengunggah rilis pertamanya. Tombol yang mati jauh lebih
 * jujur daripada tautan yang berujung 404 di tangan pengguna.
 */
export function tautanAman(raw: string | null | undefined): string | null {
  const teks = (raw || "").trim();
  if (!teks.toLowerCase().startsWith("https://")) return null;
  // Spasi di dalam URL hampir selalu berarti nilai yang tersalin separuh, dan
  // "https:// " kosong akan lolos pemeriksaan awalan di atas.
  if (/\s/.test(teks)) return null;
  if (teks.length <= "https://".length) return null;
  return teks;
}

/**
 * Apakah extension yang terpasang tertinggal dari yang tersedia.
 *
 * `terpasang` `null` selalu `false`. "Tidak tahu versi berapa yang terpasang"
 * bukan "versinya basi", dan menegur atas dasar ketidaktahuan membuat
 * peringatan itu berhenti dipercaya justru saat ia benar.
 *
 * Perbandingannya kesamaan string, bukan urutan semver: nilainya berasal dari
 * `manifest.json` yang formatnya kita sendiri yang tentukan, dan yang
 * ditanyakan cuma "sama atau tidak" — bukan "mana yang lebih baru".
 */
export function butuhPembaruan(
  terpasang: string | null | undefined,
  terbaru: string | null | undefined
): boolean {
  const a = (terpasang || "").trim();
  const b = (terbaru || "").trim();
  if (!a || !b) return false;
  // Versi "?" adalah yang dikirim content script saat `chrome.runtime` tidak
  // terbaca — sama artinya dengan tidak tahu.
  if (a === "?") return false;
  return a !== b;
}
