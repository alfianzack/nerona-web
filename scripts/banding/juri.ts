/**
 * AI juri: menilai sepasang keluaran metadata untuk satu gambar.
 *
 * Jurinya TIDAK pernah tahu mana prompt lama dan mana prompt sekarang. Ia cuma
 * melihat A dan B, dan pemanggil yang mengacak siapa A. Tanpa itu, satu-satunya
 * hal yang pasti terukur adalah kecenderungan model memilih pilihan pertama.
 *
 * Kriterianya sengaja memuat "akurasi": prompt yang menyuruh menyebut aksi bisa
 * membuat model MENGARANG aksi yang tidak ada di gambar. Juri yang cuma menilai
 * "menyebut aksi atau tidak" akan memberi nilai bagus justru pada kegagalan itu.
 */

export const KRITERIA = ["aksi", "kegunaan", "beli", "akurasi"] as const;
export type Kriteria = (typeof KRITERIA)[number];
export type Pilihan = "A" | "B" | "imbang";

export const PERTANYAAN: Record<Kriteria, string> = {
  aksi: "menyebut apa yang SEDANG TERJADI di gambar (aksi, interaksi, proses), bukan cuma benda dan tampangnya",
  kegunaan: "menyebut untuk APA aset ini dipakai (kegunaan, momen, jenis materi yang bisa dibuat darinya)",
  beli: "keyword-nya lebih mungkin diketik pembeli stok yang sedang mencari gambar seperti ini",
  akurasi: "lebih setia pada gambar — tidak mengarang aksi, tempat, merek, atau cerita yang tidak terlihat",
};

export const PROMPT_JURI = `You are judging two sets of stock-photo metadata (A and B) written for the SAME image.
You can see the image. Judge only what the image supports.

For each criterion, pick "A", "B", or "imbang" (a tie — use it when neither is clearly better):
${KRITERIA.map((k) => `- ${k}: which one ${PERTANYAAN[k]}?`).join("\n")}

An invented action, place, brand, or story that the image does not show is a serious fault: it must lose "akurasi", however well written it is.

Return JSON only (no markdown fences), exactly this shape:
{"aksi":"","kegunaan":"","beli":"","akurasi":"","alasan":""}

alasan: one sentence in Indonesian, max 200 characters, naming the concrete difference that decided it.`;

export interface PutusanJuri {
  aksi: Pilihan;
  kegunaan: Pilihan;
  beli: Pilihan;
  akurasi: Pilihan;
  alasan: string;
}

function bersihkanPagar(teks: string): string {
  const t = teks.trim();
  if (!t.startsWith("```")) return t;
  return t
    .replace(/^```[a-zA-Z]*\s*/, "")
    .replace(/```\s*$/, "")
    .trim();
}

function sebagaiPilihan(nilai: unknown, kriteria: string): Pilihan {
  const t = String(nilai ?? "").trim();
  if (t === "A" || t === "B") return t;
  if (/^imbang$|^tie$|^seri$/i.test(t)) return "imbang";
  throw new Error(`Putusan juri untuk "${kriteria}" tidak dikenali: ${JSON.stringify(nilai)}`);
}

/** Membaca jawaban juri. Galat kalau bentuknya tidak sesuai — jangan ditebak. */
export function bacaPutusan(teks: string): PutusanJuri {
  const data = JSON.parse(bersihkanPagar(teks));
  return {
    aksi: sebagaiPilihan(data?.aksi, "aksi"),
    kegunaan: sebagaiPilihan(data?.kegunaan, "kegunaan"),
    beli: sebagaiPilihan(data?.beli, "beli"),
    akurasi: sebagaiPilihan(data?.akurasi, "akurasi"),
    alasan: String(data?.alasan ?? "").slice(0, 300),
  };
}

export type LenganMenang = "lama" | "sekarang" | "imbang";

/**
 * Menerjemahkan putusan A/B jadi lengan. Baris paling menentukan di seluruh
 * pengukuran ini: tertukar arahnya, dan laporannya menyimpulkan kebalikan dari
 * yang sebenarnya terjadi — tanpa satu pun galat, dengan angka yang tetap
 * kelihatan masuk akal. Diuji dua arah di tests/scripts/banding-prompt.test.ts.
 */
export function terjemahkanPutusan(
  putusan: PutusanJuri,
  sekarangJadiA: boolean
): Record<Kriteria, LenganMenang> {
  const hasil = {} as Record<Kriteria, LenganMenang>;
  for (const k of KRITERIA) {
    const pilihan = putusan[k];
    if (pilihan === "imbang") hasil[k] = "imbang";
    else if (pilihan === "A") hasil[k] = sekarangJadiA ? "sekarang" : "lama";
    else hasil[k] = sekarangJadiA ? "lama" : "sekarang";
  }
  return hasil;
}

/** Teks yang disodorkan ke juri untuk satu sisi. */
export function ringkasKeluaran(label: "A" | "B", mentah: string): string {
  return `--- ${label} ---\n${mentah.trim()}`;
}

export interface HasilKriteria {
  menang: number;
  kalah: number;
  imbang: number;
  /** Persen kemenangan prompt sekarang dari pasangan yang tidak imbang. */
  persen: number | null;
}

/**
 * Menghitung persen dari daftar putusan yang SUDAH diterjemahkan ke lengan
 * (bukan A/B): "sekarang" berarti prompt sekarang menang.
 */
export function hitungPersen(
  putusan: Array<Record<Kriteria, LenganMenang>>
): Record<Kriteria, HasilKriteria> {
  const hasil = {} as Record<Kriteria, HasilKriteria>;
  for (const k of KRITERIA) {
    let menang = 0;
    let kalah = 0;
    let imbang = 0;
    for (const p of putusan) {
      if (p[k] === "sekarang") menang++;
      else if (p[k] === "lama") kalah++;
      else imbang++;
    }
    const tegas = menang + kalah;
    hasil[k] = {
      menang,
      kalah,
      imbang,
      // Imbang tidak dihitung sebagai setengah kemenangan: pembilang dan
      // penyebutnya sama-sama hanya pasangan yang juri berani putuskan.
      persen: tegas === 0 ? null : Math.round((menang / tegas) * 1000) / 10,
    };
  }
  return hasil;
}
