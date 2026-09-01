/**
 * Dua lengan yang dibandingkan skrip banding-prompt-metadata, dan satu-satunya
 * tempat logika "apa yang membuat keduanya sebanding" hidup.
 *
 * Kenapa terpisah dari skripnya: yang paling berbahaya di pengukuran seperti
 * ini adalah salah yang sunyi — mengukur persen antara dua prompt yang ternyata
 * sama, atau antara dua prompt yang berbeda di lebih dari kepalanya (misalnya
 * satu lengan kebetulan ikut membawa ekor kontrak). Keduanya menghasilkan angka
 * yang kelihatan masuk akal. Berkas ini bisa diuji tanpa memanggil AI sama
 * sekali; lihat tests/scripts/banding-prompt.test.ts.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildMetadataPrompt } from "../../src/lib/extension/prompts";

/**
 * Prompt lama = versi SEBELUM commit yang memperbaikinya.
 *
 * c08a62c ("feat(prompt): metadata menilai apa yang TERJADI dan untuk APA,
 * bukan tampangnya", 2026-08-21) adalah perubahan yang sedang diukur, jadi
 * patokan "sebelum"-nya adalah induknya.
 */
export const KOMIT_PROMPT_LAMA = "c08a62c^";
export const BERKAS_PROMPT_LAMA = "src/lib/extension/prompts.ts";

/**
 * Salinan teks prompt lama, dipanen sekali dari git dengan
 * `ekstrakPromptAdvanced` di bawah. Fixture, bukan `git show` tiap kali jalan:
 * teksnya jadi bisa dibaca mata saat menilai laporan, dan tetap tidak bisa
 * menyimpang karena tesnya membandingkannya dengan isi git.
 *
 * Diresolusi dari cwd, bukan dari letak berkas ini: baik `npm run
 * banding:prompt` maupun vitest berjalan dari akar nerona-web, dan cara ini
 * tidak bergantung pada apakah modulnya diperlakukan ESM atau CJS.
 */
export const PATH_FIXTURE_PROMPT_LAMA = "scripts/banding/prompt-lama-c08a62c.txt";

export function bacaFixturePromptLama(): string {
  const berkas = path.join(process.cwd(), PATH_FIXTURE_PROMPT_LAMA);
  let isi: string;
  try {
    isi = readFileSync(berkas, "utf8");
  } catch {
    throw new Error(
      `Fixture prompt lama tidak terbaca di ${berkas}. Jalankan dari akar nerona-web.`
    );
  }
  // trimEnd: baris kosong di ujung berkas yang ditambahkan editor tidak boleh
  // dihitung sebagai perbedaan prompt — buildMetadataPrompt memangkasnya juga.
  return isi.trimEnd();
}

const PENANDA_AWAL = "const METADATA_GENERATOR_PROMPT_ADVANCED = `";

/**
 * Memanen konstanta prompt advanced dari sumber TypeScript apa adanya, tanpa
 * menjalankannya. Dipakai dua kali: sekali untuk membuat fixture, dan sekali
 * lagi di dalam tes untuk membuktikan fixture itu masih sama dengan isi git.
 *
 * Sengaja galat kalau isinya memuat interpolasi atau escape: template literal
 * semacam itu tidak sama dengan teks mentahnya, dan memperlakukannya seolah
 * sama akan menghasilkan prompt yang tidak pernah dikirim siapa pun.
 */
export function ekstrakPromptAdvanced(sumberTs: string): string {
  const mulai = sumberTs.indexOf(PENANDA_AWAL);
  if (mulai < 0) {
    throw new Error(
      `Konstanta METADATA_GENERATOR_PROMPT_ADVANCED tidak ditemukan di sumber ${BERKAS_PROMPT_LAMA}.`
    );
  }
  const isiMulai = mulai + PENANDA_AWAL.length;
  const akhir = sumberTs.indexOf("`;", isiMulai);
  if (akhir < 0) {
    throw new Error("Template literal METADATA_GENERATOR_PROMPT_ADVANCED tidak tertutup.");
  }
  const isi = sumberTs.slice(isiMulai, akhir);
  if (isi.includes("${") || isi.includes("\\")) {
    throw new Error(
      "Prompt advanced memuat interpolasi atau escape — teks mentahnya bukan prompt yang sebenarnya dikirim."
    );
  }
  return isi;
}

export type NamaLengan = "lama" | "sekarang";

export interface Lengan {
  nama: NamaLengan;
  /** Badan prompt sebelum dibungkus: inilah satu-satunya yang boleh berbeda. */
  kepala: string;
  /** Prompt utuh yang dikirim ke model. */
  prompt: string;
  maxTokens: number;
  /** Untuk laporan: dari mana kepala ini datang. */
  sumberKepala: string;
}

/**
 * Merakit satu lengan MEMAKAI PERAKIT PRODUKSI (`buildMetadataPrompt`), bukan
 * salinan kedua. Pembungkusnya — baris konteks marketplace, hint Vecteezy dan
 * Miricanvas — dengan begitu tidak bisa berbeda antar-lengan meski nanti
 * pembungkusnya berubah.
 *
 * `tail` sengaja tidak diisi: ekor kontrak hanya dipakai jalur prompt kustom
 * tenant, dan yang sedang diukur adalah jalur prompt Nerona.
 */
export function bangunLengan(input: {
  nama: NamaLengan;
  marketplace: string;
  kepala: string;
  sumberKepala: string;
}): Lengan {
  const { prompt, maxTokens } = buildMetadataPrompt({
    marketplace: input.marketplace,
    promptMode: "advanced",
    body: input.kepala,
  });
  return {
    nama: input.nama,
    kepala: input.kepala,
    prompt,
    maxTokens,
    sumberKepala: input.sumberKepala,
  };
}

/**
 * Sisa prompt sesudah kepalanya dipotong — pembungkusnya. Dua lengan yang
 * sebanding punya ekor yang identik.
 */
export function ekorPembungkus(lengan: Lengan): string {
  const kepala = lengan.kepala.trim();
  if (!lengan.prompt.startsWith(kepala)) {
    throw new Error(
      `Prompt lengan "${lengan.nama}" tidak dimulai dengan kepalanya — perakitnya berubah bentuk.`
    );
  }
  return lengan.prompt.slice(kepala.length);
}

/**
 * Penjaga yang dipanggil skrip SEBELUM satu poin pun dibelanjakan. Menolak dua
 * hal yang membuat hasil pengukuran tidak berarti: lengan yang identik, dan
 * lengan yang berbeda di luar kepalanya.
 */
export function periksaSebanding(lama: Lengan, sekarang: Lengan): void {
  if (lama.kepala.trim() === sekarang.kepala.trim()) {
    throw new Error(
      "Kedua lengan memakai prompt yang sama — tidak ada yang bisa dibandingkan. " +
        "Kalau prompt sekarang sudah dikembalikan ke versi lama, atau override owner " +
        "di Setting kebetulan berisi teks lama, angka apa pun dari skrip ini tidak berarti."
    );
  }
  const ekorLama = ekorPembungkus(lama);
  const ekorSekarang = ekorPembungkus(sekarang);
  if (ekorLama !== ekorSekarang) {
    throw new Error(
      "Pembungkus kedua lengan berbeda, jadi yang terukur bukan cuma prompt:\n" +
        `  lama    : ${JSON.stringify(ekorLama)}\n` +
        `  sekarang: ${JSON.stringify(ekorSekarang)}`
    );
  }
}
