export interface MetadataTerurai {
  title: string;
  description: string;
  keywords: string[];
}

/**
 * Membaca balasan model menjadi judul, deskripsi, dan keyword.
 *
 * Extension dan Hub mengurai balasannya sendiri; berkas ini hanya untuk layar
 * Coba prompt, yang menampilkan hasilnya di web. Aturannya sengaja longgar di
 * sekitar JSON (pagar markdown, kalimat pembuka) karena itulah yang biasa
 * ditambahkan model, dan ketat di isinya: tanpa judul atau tanpa satu pun
 * keyword, hasilnya tidak layak ditampilkan sebagai metadata.
 *
 * Urutan keyword dipertahankan. Prompt memintanya "most important first", dan
 * urutan itu bagian dari yang sedang diuji tenant.
 */
export function uraiMetadata(teks: string): MetadataTerurai | null {
  const cocok = teks.match(/\{[\s\S]*\}/);
  if (!cocok) return null;

  let data: any;
  try {
    data = JSON.parse(cocok[0]);
  } catch {
    return null;
  }

  const title = typeof data?.title === "string" ? data.title.trim() : "";
  const description = typeof data?.description === "string" ? data.description.trim() : "";

  const terlihat = new Set<string>();
  const keywords: string[] = [];
  for (const kw of Array.isArray(data?.keywords) ? data.keywords : []) {
    if (typeof kw !== "string") continue;
    const bersih = kw.trim();
    const kunci = bersih.toLowerCase();
    if (!bersih || terlihat.has(kunci)) continue;
    terlihat.add(kunci);
    keywords.push(bersih);
  }

  if (!title || keywords.length === 0) return null;
  return { title, description, keywords };
}
