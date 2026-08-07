import { prisma } from "./prisma";
import { UNDUHAN_KEYS, UNDUHAN_KOSONG, type UnduhanSettings } from "./unduhan";

/**
 * Pembaca/penulis lima baris `Setting` untuk tautan unduhan. Terpisah dari
 * `unduhan.ts` karena berkas ini mengimpor prisma dan komponen klien tidak
 * boleh ikut menyeretnya ke bundel.
 */
export async function getUnduhanSettings(): Promise<UnduhanSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(UNDUHAN_KEYS) } },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  // Baris yang belum pernah diisi tidak ada di tabel. Kosong, bukan melempar:
  // halaman harus tetap merender dan berkata "Belum tersedia".
  return {
    hubWindowsUrl: map.get(UNDUHAN_KEYS.hubWindowsUrl) ?? UNDUHAN_KOSONG.hubWindowsUrl,
    hubMacUrl: map.get(UNDUHAN_KEYS.hubMacUrl) ?? UNDUHAN_KOSONG.hubMacUrl,
    hubVersion: map.get(UNDUHAN_KEYS.hubVersion) ?? UNDUHAN_KOSONG.hubVersion,
    extensionUrl: map.get(UNDUHAN_KEYS.extensionUrl) ?? UNDUHAN_KOSONG.extensionUrl,
    extensionVersion: map.get(UNDUHAN_KEYS.extensionVersion) ?? UNDUHAN_KOSONG.extensionVersion,
    extensionMinVersion:
      map.get(UNDUHAN_KEYS.extensionMinVersion) ?? UNDUHAN_KOSONG.extensionMinVersion,
  };
}

/**
 * Menulis hanya kunci yang benar-benar disebut.
 *
 * `undefined` berarti *jangan sentuh*, `""` berarti *kosongkan*. Bedanya
 * menentukan sejak CI ikut menulis ke sini: rilis Hub tidak tahu apa-apa
 * tentang versi extension, dan tidak boleh menghapusnya hanya karena tidak
 * menyebutnya. Panel admin yang mengirim seluruh objek tetap bekerja apa adanya.
 */
export async function updateUnduhanSettings(values: Partial<UnduhanSettings>): Promise<void> {
  const fields = (Object.keys(UNDUHAN_KEYS) as (keyof UnduhanSettings)[]).filter(
    (field) => values[field] !== undefined
  );
  await prisma.$transaction(
    fields.map((field) => {
      const value = (values[field] ?? "").trim();
      return prisma.setting.upsert({
        where: { key: UNDUHAN_KEYS[field] },
        create: { key: UNDUHAN_KEYS[field], value },
        update: { value },
      });
    })
  );
}
