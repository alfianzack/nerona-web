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
  /**
   * Versi extension paling tua yang masih boleh memakai `/api/extension/generate`.
   * Kosong berarti tidak ada gerbang sama sekali.
   *
   * Ini satu-satunya kunci di sini yang **kebijakan**, bukan fakta build — jadi
   * CI tidak pernah boleh menulisnya. Lihat `/api/releases/publish`.
   */
  extensionMinVersion: string;
}

export const UNDUHAN_KEYS: Record<keyof UnduhanSettings, string> = {
  hubWindowsUrl: "hub_download_windows",
  hubMacUrl: "hub_download_mac",
  hubVersion: "hub_version",
  extensionUrl: "extension_download_url",
  extensionVersion: "extension_version",
  extensionMinVersion: "extension_min_version",
};

export const UNDUHAN_KOSONG: UnduhanSettings = {
  hubWindowsUrl: "",
  hubMacUrl: "",
  hubVersion: "",
  extensionUrl: "",
  extensionVersion: "",
  extensionMinVersion: "",
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

/** Versi yang artinya "tidak tahu": belum diisi, atau `chrome.runtime` tak terbaca. */
function tidakDiketahui(versi: string | null | undefined): boolean {
  const teks = (versi || "").trim();
  // "?" adalah yang dikirim content script saat `chrome.runtime` tidak terbaca.
  return !teks || teks === "?";
}

/**
 * Urutan dua nomor versi: negatif kalau `a` lebih tua, 0 kalau setara, positif
 * kalau `a` lebih baru.
 *
 * Perbandingan per ruas angka, bukan per abjad. Perbandingan abjad bilang
 * "1.10" < "1.9", dan kesalahan itu memblokir orang yang justru sudah
 * memperbarui — kelas kegagalan paling mahal yang bisa dimiliki gerbang versi.
 *
 * Ruas yang tidak ditulis dan ruas yang bukan angka sama-sama dibaca nol, jadi
 * "1.2" setara "1.2.0" dan "1.1.0-beta" setara "1.1.0". Ini bukan semver penuh
 * dan tidak berpura-pura begitu: nomor versinya berasal dari `manifest.json`
 * dan `tauri.conf.json` yang formatnya kita sendiri yang tentukan.
 */
export function bandingkanVersi(a: string | null | undefined, b: string | null | undefined): number {
  const ruas = (versi: string | null | undefined) =>
    (versi || "").trim().split(".").map((bagian) => {
      const angka = parseInt(bagian, 10);
      return Number.isNaN(angka) ? 0 : angka;
    });

  const kiri = ruas(a);
  const kanan = ruas(b);
  const panjang = Math.max(kiri.length, kanan.length);
  for (let i = 0; i < panjang; i += 1) {
    const selisih = (kiri[i] ?? 0) - (kanan[i] ?? 0);
    if (selisih !== 0) return selisih;
  }
  return 0;
}

/**
 * Apakah extension yang terpasang tertinggal dari yang tersedia.
 *
 * Versi yang tidak diketahui — di sisi mana pun — selalu `false`. "Tidak tahu
 * versi berapa yang terpasang" bukan "versinya basi", dan menegur atas dasar
 * ketidaktahuan membuat peringatan itu berhenti dipercaya justru saat ia benar.
 *
 * Yang lebih baru dari yang tercatat juga `false`: build percobaan owner
 * mendahului kunci `Setting`, dan menegurnya cuma melatih orang mengabaikan
 * spanduknya.
 */
export function butuhPembaruan(
  terpasang: string | null | undefined,
  terbaru: string | null | undefined
): boolean {
  if (tidakDiketahui(terpasang) || tidakDiketahui(terbaru)) return false;
  return bandingkanVersi(terpasang, terbaru) < 0;
}

/**
 * Apakah versi terpasang ada di bawah batas yang masih dilayani.
 *
 * Dua aturan yang menentukan, keduanya menyangkut mengunci orang dari
 * pekerjaannya:
 *
 * - `minimum` kosong berarti **tidak ada gerbang**. Kebijakan yang belum
 *   ditetapkan tidak boleh mengunci siapa pun.
 * - `terpasang` yang tidak diketahui dianggap **di bawah minimum apa pun** —
 *   berlawanan dengan `butuhPembaruan`, dan disengaja. Permintaan yang tidak
 *   menyebut versinya datang dari salinan yang terbit sebelum header
 *   `X-Nerona-Ext-Version` ada, dan salinan itu persis yang hendak diblokir.
 *
 * Akibat dari keduanya: hari kunci `extension_min_version` diisi, setiap
 * salinan lama berhenti bekerja sampai dipasang ulang.
 */
export function diBawahMinimum(
  terpasang: string | null | undefined,
  minimum: string | null | undefined
): boolean {
  if (tidakDiketahui(minimum)) return false;
  if (tidakDiketahui(terpasang)) return true;
  return bandingkanVersi(terpasang, minimum) < 0;
}
