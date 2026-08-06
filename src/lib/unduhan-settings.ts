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
  };
}

export async function updateUnduhanSettings(values: UnduhanSettings): Promise<void> {
  await prisma.$transaction(
    (Object.keys(UNDUHAN_KEYS) as (keyof UnduhanSettings)[]).map((field) => {
      const value = (values[field] ?? "").trim();
      return prisma.setting.upsert({
        where: { key: UNDUHAN_KEYS[field] },
        create: { key: UNDUHAN_KEYS[field], value },
        update: { value },
      });
    })
  );
}
