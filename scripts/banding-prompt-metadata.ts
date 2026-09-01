/**
 * Membandingkan prompt metadata LAMA (sebelum c08a62c, 2026-08-21) dengan
 * prompt yang berlaku SEKARANG, pada gambar yang sama dan model yang sama.
 *
 * Kenapa ada: perubahan prompt itu di-push langsung ke produksi tanpa pernah
 * dibandingkan mata, jadi tidak ada satu pun angka yang bisa dipakai untuk
 * menjawab "naik berapa persen". Skrip ini yang membuat angkanya.
 *
 *   npm run banding:prompt -- --folder "D:\gambar-uji" --kering     # lihat dulu, tanpa memanggil AI
 *   npm run banding:prompt -- --folder "D:\gambar-uji" --batas 30
 *
 * Pilihan lain:
 *   --marketplace adobe    konteks marketplace untuk KEDUA lengan (default adobe)
 *   --model <id>           id baris AiModel atau modelId provider (default: baris default aktif)
 *   --juri <id>            model penilai (default: model yang sama)
 *   --tanpa-juri           lewati AI juri, hanya buat laporan untuk dinilai mata
 *   --maks-mb 4            tolak gambar lebih besar dari ini
 *   --jeda 0               jeda milidetik antar-gambar, kalau provider membatasi laju
 *
 * DUA HAL YANG SENGAJA TIDAK DILAKUKAN skrip ini, dan jangan ditambahkan:
 *
 * 1. Tidak memotong poin siapa pun. Panggilannya langsung ke `chatCompletion`,
 *    bukan lewat /api/extension/generate, jadi tidak ada `spendPoints`.
 * 2. Tidak menulis ke `ai_usage_logs` (`recordAiUsage` bahkan tidak diimpor).
 *    Estimasi "poin per gambar" yang dilihat tenant dirata-rata dari baris
 *    withImage di tabel itu; puluhan panggilan benchmark akan menggeser angka
 *    yang baru saja dikalibrasi ke tagihan sungguhan.
 *
 * Ongkosnya tetap uang sungguhan di provider. Ringkasan di akhir menyebut
 * setara berapa poin pada tarif model yang dipakai.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { chatCompletion } from "../src/lib/agent/claude-client";
import {
  REFERENCE_IMAGE_USAGE,
  costForUsage,
  type AiPricing,
  type TokenUsage,
} from "../src/lib/agent/pricing";
import { resolveProviderCredentials } from "../src/lib/ai-providers";
import { getAiSettings } from "../src/lib/ai-settings";
import { getPromptSettingsView } from "../src/lib/extension/prompt-settings";
import {
  KOMIT_PROMPT_LAMA,
  bacaFixturePromptLama,
  bangunLengan,
  periksaSebanding,
  type Lengan,
} from "./banding/lengan";
import {
  KRITERIA,
  PROMPT_JURI,
  bacaPutusan,
  hitungPersen,
  ringkasKeluaran,
  terjemahkanPutusan,
  type Kriteria,
  type LenganMenang,
} from "./banding/juri";
import { bangunLaporanHtml, type BarisLaporan, type DataLaporan } from "./banding/laporan";

// --------------------------------------------------------------------------
// Argumen
// --------------------------------------------------------------------------

function argTeks(nama: string): string | undefined {
  const i = process.argv.indexOf(`--${nama}`);
  if (i < 0) return undefined;
  const nilai = process.argv[i + 1];
  if (!nilai || nilai.startsWith("--")) throw new Error(`--${nama} butuh nilai.`);
  return nilai;
}

function argAngka(nama: string, bawaan: number): number {
  const teks = argTeks(nama);
  if (teks === undefined) return bawaan;
  const n = Number(teks);
  if (!Number.isFinite(n) || n < 0) throw new Error(`--${nama} harus angka >= 0.`);
  return n;
}

const FOLDER = argTeks("folder");
const BATAS = argAngka("batas", 30);
const MARKETPLACE = argTeks("marketplace") || "adobe";
const PILIHAN_MODEL = argTeks("model");
const PILIHAN_JURI = argTeks("juri");
const TANPA_JURI = process.argv.includes("--tanpa-juri");
const KERING = process.argv.includes("--kering");
const MAKS_MB = argAngka("maks-mb", 4);
const JEDA = argAngka("jeda", 0);

const PEMAKAIAN = `Pemakaian:
  npm run banding:prompt -- --folder "<folder gambar>" [--kering] [--batas 30]
                            [--marketplace adobe] [--model <id>] [--juri <id>]
                            [--tanpa-juri] [--maks-mb 4] [--jeda 0]`;

// --------------------------------------------------------------------------
// Gambar
// --------------------------------------------------------------------------

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

interface Gambar {
  berkas: string;
  mime: string;
  base64: string;
  dataUri: string;
}

function muatGambar(folder: string, batas: number): { gambar: Gambar[]; dilewati: string[] } {
  let isi: string[];
  try {
    isi = readdirSync(folder);
  } catch {
    throw new Error(`Folder tidak terbaca: ${folder}`);
  }
  const kandidat = isi
    .filter((nama) => MIME[path.extname(nama).toLowerCase()])
    .sort((a, b) => a.localeCompare(b, "id"));
  if (kandidat.length === 0) {
    throw new Error(
      `Tidak ada gambar (${Object.keys(MIME).join(", ")}) di ${folder}.`
    );
  }

  const gambar: Gambar[] = [];
  const dilewati: string[] = [];
  for (const nama of kandidat) {
    if (gambar.length >= batas) break;
    const berkas = path.join(folder, nama);
    const mb = statSync(berkas).size / (1024 * 1024);
    if (mb > MAKS_MB) {
      // Tidak ada pengecil gambar di sini dengan sengaja: menambah sharp buat
      // skrip banding itu ongkos yang tidak sepadan. Kecilkan dulu di luar.
      dilewati.push(`${nama} (${mb.toFixed(1)} MB > ${MAKS_MB} MB)`);
      continue;
    }
    const mime = MIME[path.extname(nama).toLowerCase()];
    const base64 = readFileSync(berkas).toString("base64");
    gambar.push({ berkas: nama, mime, base64, dataUri: `data:${mime};base64,${base64}` });
  }
  return { gambar, dilewati };
}

// --------------------------------------------------------------------------
// Model
// --------------------------------------------------------------------------

interface ModelSiap {
  keterangan: string;
  modelId: string;
  apiKey: string;
  baseUrl: string;
  pricing: AiPricing;
}

/**
 * Memilih SATU model, dipakai kedua lengan. Tarifnya diambil dari baris yang
 * dipilih di sini — pola yang sama dengan resolveAiForUser, dan bukan dicari
 * dari id model yang dikembalikan provider.
 */
async function siapkanModel(pilihan: string | undefined): Promise<ModelSiap> {
  const global = await getAiSettings();
  const row = pilihan
    ? await prisma.aiModel.findFirst({
        where: { OR: [{ id: pilihan }, { modelId: pilihan }] },
        include: { provider: true },
      })
    : await prisma.aiModel.findFirst({
        where: { isDefault: true, active: true },
        include: { provider: true },
      });

  if (!row) {
    if (pilihan) throw new Error(`Tidak ada baris AiModel dengan id/modelId "${pilihan}".`);
    const bawaan = await prisma.aiProvider.findFirst({ where: { isDefault: true } });
    const creds = resolveProviderCredentials(bawaan);
    return {
      keterangan: `${global.model} (tanpa baris registri — dari Koneksi AI)`,
      modelId: global.model,
      ...creds,
      pricing: global.pricing,
    };
  }

  const creds = resolveProviderCredentials(row.provider ?? null);
  return {
    keterangan: `${row.label} — ${row.modelId}${row.vision ? "" : " (TIDAK bertanda vision!)"}`,
    modelId: row.modelId,
    ...creds,
    pricing: {
      inPerMTok: row.inPerMTok,
      outPerMTok: row.outPerMTok,
      pointsPerUsd: global.pricing.pointsPerUsd,
    },
  };
}

// --------------------------------------------------------------------------
// Panggilan
// --------------------------------------------------------------------------

const ongkos = { panggilan: 0, promptTokens: 0, completionTokens: 0, poin: 0 };

function catatOngkos(usage: TokenUsage | null, pricing: AiPricing) {
  ongkos.panggilan += 1;
  ongkos.promptTokens += usage?.promptTokens ?? 0;
  ongkos.completionTokens += usage?.completionTokens ?? 0;
  ongkos.poin += costForUsage({ usage, pricing });
}

async function panggilDenganGambar(
  model: ModelSiap,
  prompt: string,
  gambar: Gambar,
  maxTokens: number
): Promise<string> {
  // Bentuk pesannya sama dengan /api/extension/generate: teks lebih dulu, lalu
  // image_url data-URI. Bentuk yang berbeda = mengukur dua hal sekaligus.
  const hasil = await chatCompletion({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: gambar.dataUri } },
        ],
      },
    ],
    model: model.modelId,
    apiKey: model.apiKey,
    baseUrl: model.baseUrl,
    maxTokens,
  });
  catatOngkos(hasil.usage, model.pricing);
  return hasil.text;
}

function jeda(ms: number): Promise<void> {
  return new Promise((selesai) => setTimeout(selesai, ms));
}

// --------------------------------------------------------------------------
// Jalan
// --------------------------------------------------------------------------

type PutusanLengan = Record<Kriteria, LenganMenang>;

async function main() {
  if (!FOLDER) {
    console.error(`--folder wajib.\n\n${PEMAKAIAN}`);
    process.exit(1);
  }

  // 1. Dua lengan, dan penjaganya. Ini SEBELUM apa pun dibelanjakan.
  const tampilanPrompt = await getPromptSettingsView();
  const lama: Lengan = bangunLengan({
    nama: "lama",
    marketplace: MARKETPLACE,
    kepala: bacaFixturePromptLama(),
    sumberKepala: `git ${KOMIT_PROMPT_LAMA}`,
  });
  const sekarang: Lengan = bangunLengan({
    nama: "sekarang",
    marketplace: MARKETPLACE,
    kepala: tampilanPrompt.advanced,
    sumberKepala: tampilanPrompt.advancedOverridden
      ? "override owner di Setting (prompt_metadata_advanced)"
      : "konstanta kode",
  });
  periksaSebanding(lama, sekarang);

  // 2. Gambar dan model.
  const { gambar, dilewati } = muatGambar(FOLDER, BATAS);
  const model = await siapkanModel(PILIHAN_MODEL);
  const modelJuri = TANPA_JURI
    ? { ...model, keterangan: "tidak dijalankan" }
    : PILIHAN_JURI
      ? await siapkanModel(PILIHAN_JURI)
      : model;
  if (!model.apiKey) throw new Error("Provider tanpa apiKey — isi dulu di /admin (panel provider AI).");

  console.log(`Marketplace : ${MARKETPLACE}`);
  console.log(`Model       : ${model.keterangan}`);
  console.log(`Juri        : ${modelJuri.keterangan}`);
  console.log(`Lengan lama : ${lama.sumberKepala} (${lama.kepala.length} char)`);
  console.log(`Lengan skrg : ${sekarang.sumberKepala} (${sekarang.kepala.length} char)`);
  console.log(`Gambar      : ${gambar.length}${dilewati.length ? ` (${dilewati.length} dilewati)` : ""}`);
  for (const d of dilewati) console.log(`  dilewati: ${d}`);

  const panggilanPerGambar = TANPA_JURI ? 2 : 3;
  // REFERENCE_IMAGE_USAGE, bukan angka yang disalin ke sini: profil itu sudah
  // pernah disalin sekali ke panel admin dengan komentar "sama dengan
  // lib/ai-models.ts", dan salinan itulah yang kemudian meleset separuh.
  const perkiraanPoin = costForUsage({ usage: REFERENCE_IMAGE_USAGE, pricing: model.pricing });
  console.log(
    `Perkiraan   : ${gambar.length * panggilanPerGambar} panggilan, setara ~${
      gambar.length * panggilanPerGambar * perkiraanPoin
    } poin pada tarif model ini.\n`
  );

  if (KERING) {
    console.log("--- PROMPT LENGAN LAMA ---\n" + lama.prompt);
    console.log("\n--- PROMPT LENGAN SEKARANG ---\n" + sekarang.prompt);
    console.log("\n--kering: tidak ada satu pun panggilan AI dilakukan.");
    return;
  }

  // 3. Jalankan.
  const baris: BarisLaporan[] = [];
  const putusanSemua: PutusanLengan[] = [];
  const gagal: string[] = [];

  for (const [indeks, img] of gambar.entries()) {
    const nomor = `${indeks + 1}/${gambar.length}`;
    try {
      // Kedua lengan berbarengan: gambar yang sama, model yang sama, dan waktu
      // yang praktis sama juga.
      const [keluaranLama, keluaranSekarang] = await Promise.all([
        panggilDenganGambar(model, lama.prompt, img, lama.maxTokens),
        panggilDenganGambar(model, sekarang.prompt, img, sekarang.maxTokens),
      ]);

      // Acakan pertama: untuk juri.
      const sekarangJadiA = Math.random() < 0.5;
      let putusan: PutusanLengan | null = null;
      let alasan = "";
      if (!TANPA_JURI) {
        const isiA = sekarangJadiA ? keluaranSekarang : keluaranLama;
        const isiB = sekarangJadiA ? keluaranLama : keluaranSekarang;
        const promptJuri = [
          PROMPT_JURI,
          "",
          ringkasKeluaran("A", isiA),
          "",
          ringkasKeluaran("B", isiB),
        ].join("\n");
        try {
          const jawaban = await panggilDenganGambar(modelJuri, promptJuri, img, 700);
          const p = bacaPutusan(jawaban);
          alasan = p.alasan;
          putusan = terjemahkanPutusan(p, sekarangJadiA);
          putusanSemua.push(putusan);
        } catch (err) {
          // Juri yang gagal tidak boleh menghanguskan dua panggilan generate
          // yang sudah dibayar.
          console.warn(`  ${nomor} juri gagal: ${(err as Error).message}`);
        }
      }

      // Acakan kedua, berdiri sendiri: untuk mata owner di laporan.
      const sekarangDiKiri = Math.random() < 0.5;
      baris.push({
        berkas: img.berkas,
        gambarDataUri: img.dataUri,
        kiri: {
          lengan: sekarangDiKiri ? "sekarang" : "lama",
          mentah: sekarangDiKiri ? keluaranSekarang : keluaranLama,
        },
        kanan: {
          lengan: sekarangDiKiri ? "lama" : "sekarang",
          mentah: sekarangDiKiri ? keluaranLama : keluaranSekarang,
        },
        juri: putusan ? { ...putusan, alasan } : null,
      });
      console.log(
        `  ${nomor} ${img.berkas} — selesai${
          putusan ? ` (juri: ${KRITERIA.map((k) => `${k}=${putusan![k]}`).join(" ")})` : ""
        }`
      );
    } catch (err) {
      gagal.push(`${img.berkas}: ${(err as Error).message}`);
      console.warn(`  ${nomor} ${img.berkas} — GAGAL: ${(err as Error).message}`);
    }
    if (JEDA) await jeda(JEDA);
  }

  // 4. Tulis laporan.
  const dibuat = new Date().toISOString().replace(/[:.]/g, "-");
  const tujuan = path.join(process.cwd(), ".banding", dibuat);
  mkdirSync(tujuan, { recursive: true });

  const ringkasanJuri = putusanSemua.length ? hitungPersen(putusanSemua) : null;
  const data: DataLaporan = {
    dibuat,
    model: model.keterangan,
    modelJuri: modelJuri.keterangan,
    marketplace: MARKETPLACE,
    sumberLama: lama.sumberKepala,
    sumberSekarang: sekarang.sumberKepala,
    ongkos: { ...ongkos, poin: Math.round(ongkos.poin * 10) / 10 },
    ringkasanJuri,
    gagal,
    baris,
  };

  const berkasHtml = path.join(tujuan, "laporan.html");
  writeFileSync(berkasHtml, bangunLaporanHtml(data), "utf8");
  writeFileSync(
    path.join(tujuan, "hasil.json"),
    JSON.stringify(
      {
        ...data,
        // Gambarnya tidak ikut ke JSON: base64-nya sudah ada di laporan HTML,
        // dan dua salinan puluhan MB tidak ada gunanya.
        baris: data.baris.map((b) => ({ ...b, gambarDataUri: undefined })),
        promptLama: lama.prompt,
        promptSekarang: sekarang.prompt,
      },
      null,
      2
    ),
    "utf8"
  );

  // 5. Ringkasan ke terminal.
  console.log("\n=== PUTUSAN AI JURI ===");
  if (!ringkasanJuri) {
    console.log("Tidak ada putusan juri.");
  } else {
    for (const k of KRITERIA) {
      const h = ringkasanJuri[k];
      console.log(
        `  ${k.padEnd(9)} sekarang ${String(h.menang).padStart(3)} · lama ${String(h.kalah).padStart(
          3
        )} · imbang ${String(h.imbang).padStart(3)} → ${h.persen === null ? "—" : `${h.persen}%`}`
      );
    }
  }
  console.log(
    `\nOngkos: ${ongkos.panggilan} panggilan · ${ongkos.promptTokens} token masuk · ${
      ongkos.completionTokens
    } token keluar · setara ${Math.round(ongkos.poin * 10) / 10} poin.`
  );
  if (gagal.length) console.log(`Gagal: ${gagal.length} gambar.`);
  console.log(`\nLaporan: ${berkasHtml}`);
  console.log("Buka di browser, nilai semua barisnya, baru tekan \u201cBuka kunci & hitung\u201d.");
}

main()
  .catch((err) => {
    console.error(`\nGagal: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
