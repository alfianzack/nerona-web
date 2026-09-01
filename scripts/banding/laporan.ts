/**
 * Laporan HTML berdiri sendiri: gambar + dua kolom keluaran, tombol menilai,
 * dan kunci jawabannya yang baru terbuka setelah owner selesai menilai.
 *
 * Kolomnya diacak per baris dan labelnya disembunyikan sampai tombol "buka
 * kunci" ditekan. Ini soal urutan, bukan keamanan: nama lengan tetap ada di
 * atribut data supaya JS-nya bisa menghitung, jadi siapa pun yang membuka
 * inspector bisa mengintip. Yang dicegah adalah mata yang tanpa sadar
 * menyesuaikan diri karena tahu kolom kanan "yang baru".
 */
import type { Kriteria } from "./juri";
import { KRITERIA, PERTANYAAN, type HasilKriteria } from "./juri";

export type NamaLenganLaporan = "lama" | "sekarang";

export interface SisiBaris {
  lengan: NamaLenganLaporan;
  /** Teks mentah dari model, apa adanya. */
  mentah: string;
}

export interface BarisLaporan {
  berkas: string;
  gambarDataUri: string;
  kiri: SisiBaris;
  kanan: SisiBaris;
  /** Putusan juri yang SUDAH diterjemahkan dari A/B ke lengan. */
  juri: (Record<Kriteria, NamaLenganLaporan | "imbang"> & { alasan: string }) | null;
  catatanGalat?: string | null;
}

export interface DataLaporan {
  dibuat: string;
  model: string;
  modelJuri: string;
  marketplace: string;
  sumberLama: string;
  sumberSekarang: string;
  ongkos: {
    panggilan: number;
    promptTokens: number;
    completionTokens: number;
    poin: number;
  };
  ringkasanJuri: Record<Kriteria, HasilKriteria> | null;
  gagal: string[];
  baris: BarisLaporan[];
}

function esc(nilai: unknown): string {
  return String(nilai ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface MetaTerbaca {
  title?: string;
  description?: string;
  keywords?: string[];
  visualBrief?: string;
  categories?: string[];
}

/** Membaca JSON keluaran model; kalau gagal, laporan menampilkan teks mentah. */
function bacaMeta(mentah: string): MetaTerbaca | null {
  const t = mentah.trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "");
  try {
    const data = JSON.parse(t);
    if (!data || typeof data !== "object") return null;
    return data as MetaTerbaca;
  } catch {
    return null;
  }
}

function sisiHtml(sisi: SisiBaris, kolom: "kiri" | "kanan"): string {
  const meta = bacaMeta(sisi.mentah);
  const label = kolom === "kiri" ? "A" : "B";
  if (!meta) {
    return `<td class="sisi" data-lengan="${esc(sisi.lengan)}">
      <div class="tanda">${label}<span class="kunci"> · ${esc(sisi.lengan)}</span></div>
      <p class="gagal-parse">Keluaran bukan JSON yang bisa dibaca — teks mentah:</p>
      <pre class="mentah">${esc(sisi.mentah)}</pre>
    </td>`;
  }
  const keywords = Array.isArray(meta.keywords) ? meta.keywords : [];
  const categories = Array.isArray(meta.categories) ? meta.categories : [];
  return `<td class="sisi" data-lengan="${esc(sisi.lengan)}">
    <div class="tanda">${label}<span class="kunci"> · ${esc(sisi.lengan)}</span></div>
    <h4>${esc(meta.title)}</h4>
    <p class="desk">${esc(meta.description)}</p>
    ${meta.visualBrief ? `<p class="brief">${esc(meta.visualBrief)}</p>` : ""}
    <div class="chips">${keywords.map((k) => `<span class="chip">${esc(k)}</span>`).join("")}</div>
    <p class="hitung">${keywords.length} keyword${
      categories.length ? ` · kategori: ${esc(categories.join(", "))}` : ""
    }</p>
  </td>`;
}

function juriHtml(baris: BarisLaporan): string {
  if (!baris.juri) return `<p class="juri kosong">Juri: tidak ada putusan.</p>`;
  const butir = KRITERIA.map(
    (k) => `<span class="butir"><b>${k}</b>: ${esc(baris.juri![k])}</span>`
  ).join("");
  return `<p class="juri">Juri — ${butir}<span class="alasan">${esc(baris.juri.alasan)}</span></p>`;
}

function barisHtml(baris: BarisLaporan, indeks: number): string {
  return `<section class="baris" data-indeks="${indeks}">
  <table>
    <tr>
      <td class="gambar">
        <img src="${esc(baris.gambarDataUri)}" alt="${esc(baris.berkas)}">
        <p class="nama">${esc(baris.berkas)}</p>
        ${baris.catatanGalat ? `<p class="galat">${esc(baris.catatanGalat)}</p>` : ""}
        <div class="suara" role="group" aria-label="penilaian ${esc(baris.berkas)}">
          <button type="button" data-pilih="kiri">A lebih baik</button>
          <button type="button" data-pilih="imbang">imbang</button>
          <button type="button" data-pilih="kanan">B lebih baik</button>
        </div>
      </td>
      ${sisiHtml(baris.kiri, "kiri")}
      ${sisiHtml(baris.kanan, "kanan")}
    </tr>
  </table>
  ${juriHtml(baris)}
</section>`;
}

function ringkasanJuriHtml(data: DataLaporan): string {
  if (!data.ringkasanJuri) return `<p class="catatan">Juri tidak dijalankan.</p>`;
  const baris = KRITERIA.map((k) => {
    const h = data.ringkasanJuri![k];
    const persen = h.persen === null ? "—" : `${h.persen}%`;
    return `<tr>
      <td class="k">${k}</td>
      <td class="t">${esc(PERTANYAAN[k])}</td>
      <td class="n">${h.menang}</td>
      <td class="n">${h.kalah}</td>
      <td class="n">${h.imbang}</td>
      <td class="n persen">${persen}</td>
    </tr>`;
  }).join("");
  return `<table class="ringkas">
    <thead><tr><th>kriteria</th><th>pertanyaan juri</th><th>sekarang menang</th><th>lama menang</th><th>imbang</th><th>persen</th></tr></thead>
    <tbody>${baris}</tbody>
  </table>
  <p class="catatan">Persen = kemenangan prompt sekarang di antara pasangan yang juri berani putuskan (imbang tidak masuk pembagi).</p>`;
}

const GAYA = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px; font: 14px/1.55 ui-sans-serif, system-ui, "Segoe UI", sans-serif; color: #1b2230; background: #f6f7f9; }
h1 { font-size: 20px; margin: 0 0 4px; }
h2 { font-size: 15px; margin: 28px 0 8px; }
.meta { color: #5b6577; font-size: 13px; margin: 0 0 4px; }
.kartu { background: #fff; border: 1px solid #e2e6ec; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
table { width: 100%; border-collapse: collapse; }
table.ringkas th, table.ringkas td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #eef0f4; font-size: 13px; }
table.ringkas td.n, table.ringkas th:nth-child(n+3) { text-align: right; }
table.ringkas td.k { font-weight: 600; }
table.ringkas td.t { color: #5b6577; }
td.persen { font-weight: 700; }
.baris { background: #fff; border: 1px solid #e2e6ec; border-radius: 10px; padding: 12px; margin-bottom: 14px; }
/* table-layout: fixed — tanpa ini dua sel "50%" menghimpit sel gambar sampai
   sekitar 100px dan nama berkasnya pecah per huruf, tanpa satu pun galat. */
.baris table { table-layout: fixed; }
.baris td { vertical-align: top; }
td.gambar { width: 200px; padding-right: 14px; }
td.gambar img { width: 100%; border-radius: 8px; display: block; background: #eef0f4; }
td.sisi { padding: 0 10px; border-left: 1px solid #eef0f4; }
.nama { font-size: 12px; color: #5b6577; word-break: break-word; margin: 6px 0; }
.tanda { font-weight: 700; color: #8a93a5; margin-bottom: 6px; }
.kunci { display: none; color: #c2410c; }
body.terbuka .kunci { display: inline; }
h4 { margin: 0 0 6px; font-size: 15px; }
.desk { margin: 0 0 6px; }
.brief { margin: 0 0 8px; color: #5b6577; font-style: italic; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { background: #f1f3f6; border-radius: 999px; padding: 1px 8px; font-size: 12px; }
.hitung { color: #5b6577; font-size: 12px; margin: 8px 0 0; }
.mentah { white-space: pre-wrap; font-size: 12px; background: #f6f7f9; padding: 8px; border-radius: 6px; }
.gagal-parse, .galat { color: #b91c1c; font-size: 12px; }
.suara { display: flex; gap: 4px; flex-wrap: wrap; margin: 8px 0; }
.suara button { flex: 1 1 auto; font: inherit; font-size: 12px; padding: 4px 6px; border: 1px solid #d5dae2; background: #fff; border-radius: 6px; cursor: pointer; }
.suara button:hover { border-color: #94a0b3; }
.suara button[aria-pressed="true"] { background: #1b2230; color: #fff; border-color: #1b2230; }
.juri { font-size: 12px; color: #5b6577; margin: 10px 2px 0; padding-top: 8px; border-top: 1px solid #eef0f4; display: none; }
body.terbuka .juri { display: block; }
.juri .butir { margin-right: 8px; }
.juri .alasan { display: block; margin-top: 2px; font-style: italic; }
.juri.kosong { font-style: italic; }
.aksi { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.aksi button { font: inherit; padding: 7px 14px; border-radius: 8px; border: 1px solid #1b2230; background: #1b2230; color: #fff; cursor: pointer; }
.aksi button.sekunder { background: #fff; color: #1b2230; }
#hasil-owner { margin: 10px 0 0; font-size: 14px; }
.catatan { color: #5b6577; font-size: 12px; }
@media (max-width: 900px) {
  .baris table, .baris tr, .baris td { display: block; width: auto; }
  td.sisi { border-left: 0; border-top: 1px solid #eef0f4; padding: 10px 0 0; margin-top: 10px; }
  td.gambar { width: auto; }
  td.gambar img { max-width: 260px; }
}
`;

const SKRIP = String.raw`
const KUNCI = "banding-prompt-" + document.body.dataset.laporan;
const suara = JSON.parse(localStorage.getItem(KUNCI) || "{}");

function gambarUlang() {
  document.querySelectorAll(".baris").forEach((baris) => {
    const pilihan = suara[baris.dataset.indeks];
    baris.querySelectorAll(".suara button").forEach((tombol) => {
      tombol.setAttribute("aria-pressed", String(tombol.dataset.pilih === pilihan));
    });
  });
  const total = document.querySelectorAll(".baris").length;
  document.getElementById("kemajuan").textContent =
    Object.keys(suara).length + " dari " + total + " dinilai";
}

document.querySelectorAll(".suara button").forEach((tombol) => {
  tombol.addEventListener("click", () => {
    const baris = tombol.closest(".baris");
    const indeks = baris.dataset.indeks;
    // Klik kedua pada pilihan yang sama = batalkan, supaya salah klik tidak
    // terkunci jadi data.
    if (suara[indeks] === tombol.dataset.pilih) delete suara[indeks];
    else suara[indeks] = tombol.dataset.pilih;
    localStorage.setItem(KUNCI, JSON.stringify(suara));
    gambarUlang();
    if (document.body.classList.contains("terbuka")) hitung();
  });
});

function hitung() {
  let menang = 0, kalah = 0, imbang = 0;
  document.querySelectorAll(".baris").forEach((baris) => {
    const pilihan = suara[baris.dataset.indeks];
    if (!pilihan) return;
    if (pilihan === "imbang") { imbang++; return; }
    // Indeks, BUKAN :nth-of-type/:nth-child — td.sisi adalah td kedua dan
    // ketiga di barisnya (td pertama gambar), jadi selektor urutan di sini
    // cocok ke kolom yang salah, atau ke tidak ada sama sekali, tanpa galat.
    const sisi = baris.querySelectorAll("td.sisi")[pilihan === "kiri" ? 0 : 1];
    if (sisi.dataset.lengan === "sekarang") menang++; else kalah++;
  });
  const tegas = menang + kalah;
  const persen = tegas === 0 ? null : Math.round((menang / tegas) * 1000) / 10;
  document.getElementById("hasil-owner").textContent =
    "Penilaian owner: prompt sekarang menang " + menang + ", prompt lama menang " + kalah +
    ", imbang " + imbang + (persen === null ? " — belum ada penilaian tegas." : " → " + persen + "%.");
}

document.getElementById("buka").addEventListener("click", () => {
  document.body.classList.add("terbuka");
  hitung();
});

document.getElementById("ulang").addEventListener("click", () => {
  for (const k of Object.keys(suara)) delete suara[k];
  localStorage.removeItem(KUNCI);
  gambarUlang();
  if (document.body.classList.contains("terbuka")) hitung();
});

gambarUlang();
`;

export function bangunLaporanHtml(data: DataLaporan): string {
  const idLaporan = data.dibuat.replace(/[^0-9]/g, "");
  const gagal = data.gagal.length
    ? `<p class="galat">${data.gagal.length} gambar gagal dan tidak masuk hitungan: ${esc(
        data.gagal.join(", ")
      )}</p>`
    : "";
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Banding prompt metadata — ${esc(data.dibuat)}</title>
<style>${GAYA}</style>
</head>
<body data-laporan="${esc(idLaporan)}">
<h1>Banding prompt metadata</h1>
<p class="meta">${esc(data.baris.length)} gambar · marketplace <b>${esc(
    data.marketplace
  )}</b> · model <b>${esc(data.model)}</b> · juri <b>${esc(data.modelJuri)}</b> · ${esc(
    data.dibuat
  )}</p>
<p class="meta">Lengan <b>lama</b>: ${esc(data.sumberLama)} · lengan <b>sekarang</b>: ${esc(
    data.sumberSekarang
  )}</p>

<div class="kartu">
  <h2 style="margin-top:0">Cara menilai</h2>
  <p>Kolom A dan B diacak di setiap baris, dan mana yang lama/sekarang disembunyikan. Nilai dulu semuanya dengan mata, baru buka kuncinya — begitu tahu mana yang baru, penilaian berikutnya tidak netral lagi.</p>
  <div class="aksi">
    <button type="button" id="buka">Buka kunci &amp; hitung</button>
    <button type="button" class="sekunder" id="ulang">Kosongkan penilaian</button>
    <span class="catatan" id="kemajuan"></span>
  </div>
  <p id="hasil-owner"></p>
</div>

<div class="kartu">
  <h2 style="margin-top:0">Putusan AI juri</h2>
  ${ringkasanJuriHtml(data)}
</div>

<div class="kartu">
  <h2 style="margin-top:0">Ongkos</h2>
  <p class="meta">${data.ongkos.panggilan} panggilan · ${data.ongkos.promptTokens.toLocaleString(
    "id-ID"
  )} token masuk · ${data.ongkos.completionTokens.toLocaleString(
    "id-ID"
  )} token keluar · setara <b>${data.ongkos.poin} poin</b> pada tarif model ini.</p>
  <p class="catatan">Dibayar dari kunci provider, bukan saldo tenant. Tidak ada baris yang ditulis ke ai_usage_logs.</p>
  ${gagal}
</div>

<h2>Perbandingan per gambar</h2>
${data.baris.map((b, i) => barisHtml(b, i)).join("\n")}

<script>${SKRIP}</script>
</body>
</html>`;
}
