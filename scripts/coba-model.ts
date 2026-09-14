/**
 * Menguji satu model SEBELUM barisnya dimasukkan ke registri AiModel.
 *
 *   npm run coba:model -- --model "claude-haiku-4-5" --gambar "D:\uji\satu.png"
 *   npm run coba:model -- --model "gpt-5" --marketplace canva
 *
 * Kenapa ada: pada 2026-09-14 GPT 5 mengembalikan string kosong untuk metadata
 * dan gemini/gemini-3.5-flash mengembalikan JSON terpotong. Keduanya HTTP 200,
 * tanpa galat, dan waktu itu poinnya tetap terpotong. Kegagalan kelas ini tidak
 * kelihatan dari daftar model provider, tidak kelihatan dari harga, dan tidak
 * kelihatan sampai ada tenant yang membayarnya. Satu panggilan di sini
 * memperlihatkannya.
 *
 * Yang diperiksa, berurut, dan panggilannya berhenti di kegagalan pertama:
 *   1. balasannya ada (bukan string kosong);
 *   2. tidak terpotong di batas token (finish_reason bukan "length");
 *   3. isinya JSON yang bisa diurai;
 *   4. memuat title, description, dan keywords yang tidak kosong;
 *   5. jumlah keyword masuk akal (>= 5, batas Hub di catalog.rs).
 *
 * Skrip ini TIDAK menulis apa pun: tidak ke AiModel, tidak ke ai_usage_logs,
 * dan tidak memotong poin siapa pun. Ongkosnya tetap uang sungguhan di provider,
 * satu panggilan per gambar.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { chatCompletion } from "../src/lib/agent/claude-client";
import { buildMetadataPrompt } from "../src/lib/extension/prompts";
import { costForUsage } from "../src/lib/agent/pricing";
import { getAiSettings } from "../src/lib/ai-settings";
import { resolveProviderCredentials } from "../src/lib/ai-providers";

function arg(nama: string): string | undefined {
  const i = process.argv.indexOf(`--${nama}`);
  if (i < 0) return undefined;
  const nilai = process.argv[i + 1];
  if (!nilai || nilai.startsWith("--")) throw new Error(`--${nama} butuh nilai.`);
  return nilai;
}

const MODEL = arg("model");
const GAMBAR = arg("gambar");
const MARKETPLACE = arg("marketplace") || "adobe";
/**
 * Menimpa jatah token keluaran, HANYA untuk menjajal dugaan "model ini cuma
 * kurang jatah". Kalau naik jatah membuatnya menjawab, perbaikannya ada di
 * getMetadataAiCaps, bukan di daftar model.
 */
const MAKS_TOKEN = arg("maks-token") ? Number(arg("maks-token")) : undefined;

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

interface Periksa {
  nama: string;
  lolos: boolean;
  catatan: string;
}

async function main() {
  if (!MODEL || !GAMBAR) {
    console.error(
      'Pemakaian:\n  npm run coba:model -- --model "<modelId provider>" --gambar "<berkas>" [--marketplace adobe]'
    );
    process.exit(1);
  }

  const ext = path.extname(GAMBAR).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`Format ${ext} tidak didukung. Pakai jpg, png, atau webp.`);

  const prov = await prisma.aiProvider.findFirst({ where: { isDefault: true } });
  const { apiKey, baseUrl } = resolveProviderCredentials(prov);
  if (!apiKey) throw new Error("Provider default belum punya apiKey. Isi dulu di /admin.");

  // Prompt yang SAMA dengan produksi, bukan prompt uji: yang sedang dijawab
  // adalah "apakah model ini sanggup mengerjakan pekerjaan kita", dan prompt
  // pendek buatan sendiri menjawab pertanyaan yang lain.
  const { prompt, maxTokens: bawaan } = buildMetadataPrompt({
    marketplace: MARKETPLACE,
    promptMode: "advanced",
  });
  const maxTokens = MAKS_TOKEN ?? bawaan;

  const data = readFileSync(path.resolve(GAMBAR));
  const settings = await getAiSettings();

  console.log(`Model       : ${MODEL}`);
  console.log(`Gateway     : ${baseUrl}`);
  console.log(`Marketplace : ${MARKETPLACE}`);
  console.log(`Gambar      : ${path.basename(GAMBAR)} (${Math.round(data.length / 1024)} KB)`);
  console.log(`maxTokens   : ${maxTokens}\n`);

  const mulai = Date.now();
  const hasil = await chatCompletion({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mime};base64,${data.toString("base64")}` } },
        ],
      },
    ],
    model: MODEL,
    apiKey,
    baseUrl,
    maxTokens,
  });
  const detik = ((Date.now() - mulai) / 1000).toFixed(1);

  const teks = (hasil.text || "").trim();
  const u = hasil.usage;
  console.log(
    `Balasan     : ${teks.length} char dalam ${detik} detik | finish_reason: ${hasil.finishReason ?? "(tidak dikirim)"}`
  );
  if (u) {
    const poin = costForUsage({ usage: u, pricing: settings.pricing });
    console.log(
      `Token       : ${u.promptTokens} masuk, ${u.completionTokens} keluar | ~${poin} poin pada tarif global\n`
    );
  }

  const periksa: Periksa[] = [];
  const gagal = (nama: string, catatan: string) => {
    periksa.push({ nama, lolos: false, catatan });
    return periksa;
  };

  if (!teks) {
    gagal("balasan terisi", "String kosong. Ciri model penalar: token penalarannya memakai jatah maxTokens sampai habis.");
  } else if (hasil.finishReason === "length") {
    periksa.push({ nama: "balasan terisi", lolos: true, catatan: `${teks.length} char` });
    gagal("tidak terpotong", `finish_reason "length". Jawabannya terpotong di ${maxTokens} token.`);
  } else {
    periksa.push({ nama: "balasan terisi", lolos: true, catatan: `${teks.length} char` });
    periksa.push({ nama: "tidak terpotong", lolos: true, catatan: `finish_reason ${hasil.finishReason ?? "kosong"}` });

    const cocok = teks.match(/\{[\s\S]*\}/);
    let urai: Record<string, unknown> | null = null;
    if (cocok) {
      try {
        urai = JSON.parse(cocok[0]);
      } catch (err) {
        urai = null;
      }
    }
    if (!urai) {
      gagal("JSON bisa diurai", `Balasannya bukan JSON: ${teks.slice(0, 120)}…`);
    } else {
      periksa.push({ nama: "JSON bisa diurai", lolos: true, catatan: Object.keys(urai).join(", ") });

      const kw = Array.isArray(urai.keywords) ? (urai.keywords as unknown[]) : [];
      const wajib: Array<[string, unknown]> = [
        ["title", urai.title],
        ["description", urai.description],
      ];
      const hilang = wajib.filter(([, v]) => typeof v !== "string" || !v.trim()).map(([k]) => k);
      if (hilang.length || kw.length === 0) {
        gagal("field wajib terisi", `Kosong atau hilang: ${[...hilang, ...(kw.length ? [] : ["keywords"])].join(", ")}`);
      } else {
        periksa.push({
          nama: "field wajib terisi",
          lolos: true,
          catatan: `judul ${String(urai.title).length} char, ${kw.length} keyword`,
        });
        // Hub menolak berkas di bawah keywords_min = 5 (core/src/catalog.rs).
        periksa.push({
          nama: "keyword >= 5",
          lolos: kw.length >= 5,
          catatan: `${kw.length} keyword`,
        });
      }
    }
  }

  for (const p of periksa) {
    console.log(`  ${p.lolos ? "LOLOS" : "GAGAL"}  ${p.nama.padEnd(20)} ${p.catatan}`);
  }

  const semua = periksa.every((p) => p.lolos);
  console.log(
    semua
      ? "\nLAYAK. Baris AiModel-nya boleh dibuat, dengan tarif yang dikonfirmasi ke provider."
      : "\nJANGAN DIPAKAI. Selama sebabnya belum ditutup, model ini akan menghasilkan balasan " +
          "yang tidak bisa dipakai. Untuk balasan terpotong, naikkan maxTokens di " +
          "getMetadataAiCaps (prompts.ts) lalu coba lagi; untuk balasan kosong, model ini " +
          "membutuhkan budget penalaran terpisah yang belum didukung claude-client.ts."
  );

  await prisma.$disconnect();
  process.exitCode = semua ? 0 : 1;
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exitCode = 1;
});
