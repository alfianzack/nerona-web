# Rencana Implementasi — Redesign Beranda Nerona

> **Untuk pekerja agentik:** SUB-SKILL WAJIB: pakai superpowers:executing-plans untuk menjalankan rencana ini tugas demi tugas. Langkahnya memakai checkbox (`- [ ]`).

**Goal:** Beranda `/` (HomeMetadataOnly) diringkas dari 11 seksi ke 8, dengan satu warna aksi hangat (amber) yang berlawanan dengan navy, dan copy dipotong 50–60%.

**Arsitektur:** Palet baru masuk sebagai **token** di `[data-surface="marketing"]` (globals.css) + entri warna di tailwind.config.ts — bukan hex lepas di komponen, karena seluruh halaman publik sudah membaca token `--action`/`--accent`/`--emphasis`. Struktur seksi diubah di satu berkas rakitan (`HomeMetadataOnly.tsx`); tiap komponen seksi hanya disentuh untuk hal yang memang miliknya (copy, kepadatan, warna). Copy yang berasal dari DB (FAQ, harga, statistik) diubah di `src/lib/marketing-*.ts`, bukan di JSX.

**Tech Stack:** Next.js App Router (server components), Tailwind + lapisan custom property, Vitest.

**Spec:** `docs/nerona-homepage-redesign.md`

## Kendala Global

- Warna aksi: **amber `#F2A93B`**, label di atasnya **`#20160A`** (bukan putih), teks amber di latar terang **`#C67F0A`**.
- Mint `#2FBF8F` / tint `#DBF3EA` / teks `#0B5341` **hanya** untuk hasil AI (chip kata kunci, titik status). Amber **hanya** untuk aksi dan angka. Biru aksen hanya navigasi & ikon.
- Navy: **deret navy yang ada TIDAK diubah.** Spec menulis brand `#131B42`; repo ini punya `navy-900: #16233D`, dan selisihnya tidak terlihat mata (keduanya navy gelap dengan luminansi hampir sama). Yang mahal justru menggantinya: `navy-900` dipakai di luar halaman publik — avatar admin, pita `CtaBanner`, `--action` aplikasi — jadi satu nilai baru menyeret tiga permukaan yang tidak sedang diredesain. Yang BENAR-BENAR ditambahkan hanya navy pekat `#0B1130` untuk band demo, karena "lebih gelap dari hero" adalah bagian dari maksud spec. `#18204A` (kartu di atas navy) dan `#262F5C` (border di atas navy) tidak dipakai: tidak ada kartu maupun garis di atas permukaan navy setelah restrukturisasi.
- Jangan pernah menaruh teks di bawah `#5A627E` di atas latar terang pada ukuran 11–12px.
- **Aturan kejujuran pemasaran berlaku penuh** (lihat `src/lib/marketing-samples.ts` + `docs/superpowers/specs/2026-07-29-marketing-honesty-design.md`): tidak ada angka, contoh, atau kata kunci yang tidak bisa ditelusuri ke kode/DB. Kalau ragu, KURANGI. Ini membatasi dua hal di spec: contoh "tiga jenis karya" (§5) dan band video (§3) — keduanya butuh aset sungguhan dari owner, jadi komponennya dibangun untuk **merender apa yang ada** dan mengembalikan `null` kalau asetnya belum masuk.
- Tidak ada Playwright di repo ini. Gerbang keras tiap tugas: `npx vitest run` + `npx tsc --noEmit` (nol galat baru di `src/`) + `npx next build`. Tata letak **tidak** terverifikasi mata oleh rencana ini — itu langkah owner di akhir.
- `.env.local` menunjuk Supabase **produksi**. Tidak ada tugas di rencana ini yang menjalankan migrasi atau menyentuh DB.
- Bahasa komentar & copy: Indonesia. Judul/deskripsi/keyword contoh tetap Inggris.

---

## Struktur berkas

**Diubah:**
- `src/app/globals.css` — token amber/mint/navy di blok `[data-surface="marketing"]`, plus kelas band navy pekat.
- `tailwind.config.ts` — entri warna untuk token baru (`result`, `result-bg`, `result-ink`, `on-action` sudah ada).
- `src/components/marketing/home/HomeMetadataOnly.tsx` — rakitan seksi baru (8 seksi).
- `src/components/marketing/Hero.tsx` — eyebrow, measure judul, tombol amber.
- `src/components/marketing/ContributorPainSection.tsx` — jadi prosa kolom sempit, tanpa kartu.
- `src/components/marketing/ProofSection.tsx` — grid 3 kolom, bukan tumpukan.
- `src/components/marketing/PricingTiers.tsx` — baris "≈ N gambar" + satu baris isi ulang.
- `src/components/marketing/FaqSection.tsx` — tidak berubah bentuknya; hanya isinya (lewat lib).
- `src/lib/marketing-faq.ts` — 11 item dipecah: 6 beranda + 5 pindah, plus 1 item refund baru.
- `src/lib/pricing-tiers.ts` — fitur kartu menyebut jumlah gambar.
- `src/app/layout.tsx` — `<title>` deskriptif + openGraph.
- `src/lib/nav.ts` — anchor `#fitur` menunjuk seksi yang masih ada.
- `src/lib/marketplaces.ts` — keterangan satu kata untuk Magnific & Miricanvas.

**Dibuat:**
- `src/components/marketing/KeyNumbersSection.tsx` — tiga angka besar (seksi 3).
- `src/components/marketing/DemoBand.tsx` — band video, `null` sampai URL-nya diisi.
- `src/lib/marketing-demo.ts` — URL video demo dari Setting (DB → env → null).
- `src/app/(marketing)/faq/page.tsx` — FAQ lengkap, tujuan pindahan 5 item.
- `src/app/opengraph-image.tsx` — OG image yang digenerate Next.
- `tests/lib/marketing-palette.test.ts` — penjaga kontras palet.
- `tests/lib/marketing-faq-split.test.ts` — penjaga pemecahan FAQ.
- `tests/lib/marketing-demo.test.ts` — penjaga rantai DB → env → null.

**Dihapus dari beranda (komponennya TIDAK dihapus dari repo):**
- `ComparisonSection` — "Pekerjaan yang sama, dari dua sisi" (§3: hapus seluruhnya). Masih dipakai? Cek dulu; kalau tidak ada pemanggil lain, biarkan berkasnya ada dan tidak dirujuk.
- `StepsSection` di beranda — pindah perannya ke band demo.
- `TopupSection` di beranda — jadi satu baris di bawah kartu harga.
- Dua `FeatureSection` ("Satu klik. N marketplace." dan "Kata kunci yang konsisten.").

**Dipertahankan sengaja:** `MarketplaceRow variant="strip"` dan `TrustBar`. Keduanya **rak tipis, bukan seksi** (docblock masing-masing menyebutnya begitu), jadi tidak masuk hitungan "13 → 8", dan TrustBar adalah satu-satunya bukti sosial di halaman — hal yang §9 justru minta ditambah.

---

### Task 1: Token palet — amber aksi, mint hasil AI

**Files:**
- Modify: `src/app/globals.css` (blok `[data-surface="marketing"]`, ~baris 96-140)
- Modify: `tailwind.config.ts` (blok `colors`)
- Test: `tests/lib/marketing-palette.test.ts` (baru)

**Interfaces:**
- Consumes: —
- Produces: token `--action`, `--on-action`, `--emphasis`, `--result`, `--result-bg`, `--result-ink`, `--accent` di permukaan pemasaran; kelas Tailwind `bg-action`, `text-on-action`, `text-emphasis`, `bg-result-bg`, `text-result-ink`, `text-result`.

- [ ] **Step 1: Tulis tes kontras yang gagal**

Tes ini membaca CSS-nya sebagai berkas, bukan menebak nilainya — jadi ia tetap benar kalau nilainya diubah orang lain nanti.

```ts
// tests/lib/marketing-palette.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Penjaga kontras palet pemasaran.
 *
 * Spec redesign memasang tiga angka yang TIDAK boleh dilanggar, dan
 * ketiganya adalah jenis kesalahan yang lolos dari mata: amber #F2A93B
 * gagal sebagai teks di atas putih (kontrasnya ~2:1), jadi teks amber
 * wajib memakai varian gelap, dan label di atas tombol amber wajib gelap,
 * bukan putih. Tes ini membaca globals.css apa adanya supaya nilai yang
 * disunting belakangan tetap diperiksa.
 */
const CSS = readFileSync("src/app/globals.css", "utf8");

/** Isi blok token permukaan pemasaran, dipotong dari berkasnya. */
function marketingBlock(): string {
  const start = CSS.indexOf('[data-surface="marketing"]');
  expect(start).toBeGreaterThan(-1);
  const open = CSS.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    if (CSS[i] === "}") {
      depth--;
      if (depth === 0) return CSS.slice(open + 1, i);
    }
  }
  throw new Error("blok token pemasaran tidak tertutup");
}

/** Token ditulis sebagai kanal RGB dipisah spasi — lihat docblock globals.css. */
function token(name: string): [number, number, number] {
  const found = marketingBlock().match(new RegExp(`--${name}:\\s*([\\d]+)\\s+([\\d]+)\\s+([\\d]+)\\s*;`));
  if (!found) throw new Error(`token --${name} tidak ada di permukaan pemasaran`);
  return [Number(found[1]), Number(found[2]), Number(found[3])];
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PUTIH: [number, number, number] = [255, 255, 255];

describe("palet pemasaran", () => {
  it("label tombol utama gelap di atas amber, bukan putih", () => {
    expect(contrast(token("on-action"), token("action"))).toBeGreaterThanOrEqual(4.5);
  });

  it("teks penekanan tetap terbaca di atas putih", () => {
    expect(contrast(token("emphasis"), PUTIH)).toBeGreaterThanOrEqual(4.5);
  });

  it("chip kata kunci: teks mint di atas tint mint", () => {
    expect(contrast(token("result-ink"), token("result-bg"))).toBeGreaterThanOrEqual(4.5);
  });

  /** Amber mentah memang gagal di atas putih — itu sebab --emphasis ada. */
  it("membuktikan amber mentah TIDAK boleh jadi teks di atas putih", () => {
    expect(contrast(token("action"), PUTIH)).toBeLessThan(3);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/lib/marketing-palette.test.ts`
Expected: FAIL — `token --result-ink tidak ada di permukaan pemasaran` (token-nya belum dibuat).

- [ ] **Step 3: Tambah token di globals.css**

Di dalam `[data-surface="marketing"]`, ganti baris `--accent`/`--action` dan tambahkan sisanya:

```css
    /**
     * Amber adalah warna AKSI, dan itu satu-satunya tugasnya: tombol utama,
     * angka besar, harga paket unggulan. Sebelumnya `--action` biru — biru
     * yang sama dengan `--accent` — jadi tombol dan tautan navigasi
     * berwarna sama, dan tidak ada satu pun warna di halaman ini yang
     * berlawanan dengan navy.
     *
     * `--on-action` GELAP, bukan putih. Putih di atas #F2A93B hanya ~2:1;
     * tes tests/lib/marketing-palette.test.ts menjaganya.
     */
    --action: 242 169 59;      /* #F2A93B */
    --on-action: 32 22 10;     /* #20160A */

    /**
     * Amber untuk TEKS di latar terang. Amber mentah gagal kontras di atas
     * putih, jadi setiap angka atau kata amber di seksi terang memakai ini.
     */
    --emphasis: 198 127 10;    /* #C67F0A */

    /* Biru aksen turun pangkat: navigasi, ikon, dan tautan sekunder saja. */
    --accent: 46 82 192;

    /**
     * Mint = "Nerona menjawab". Dipakai HANYA untuk hasil AI — chip kata
     * kunci dan titik status. Pasangan amber/mint inilah yang membangun
     * asosiasi: amber Anda bertindak, mint Nerona menjawab. Chip kata kunci
     * sebelumnya biru pucat (`bg-accent/10`), dan biru pucat di atas kartu
     * putih nyaris menyatu — justru itu yang memperparah kesan satu-hue.
     */
    --result: 47 191 143;      /* #2FBF8F */
    --result-bg: 219 243 234;  /* #DBF3EA */
    --result-ink: 11 83 65;    /* #0B5341 */
```

- [ ] **Step 4: Daftarkan warnanya di Tailwind**

Di `tailwind.config.ts`, di dalam `colors`, setelah `"on-action": token("on-action"),`:

```ts
        // Hasil AI — chip kata kunci dan titik status. Lihat --result di globals.css.
        result: token("result"),
        "result-bg": token("result-bg"),
        "result-ink": token("result-ink"),
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `npx vitest run tests/lib/marketing-palette.test.ts`
Expected: PASS (4 tes).

- [ ] **Step 6: Pakai mint di chip kata kunci**

`src/components/marketing/ProofSection.tsx`, kelas `<li>` chip:

```
- className="rounded-chip bg-accent/10 px-3 py-1.5 text-body font-medium text-accent"
+ className="rounded-chip bg-result-bg px-3 py-1.5 text-body font-medium text-result-ink"
```

- [ ] **Step 7: Gerbang keras**

Run: `npx vitest run && npx tsc --noEmit 2>&1 | grep "^src/" ; npx next build`
Expected: vitest hijau selain 2 kegagalan `orders.test.ts` yang sudah ada sebelumnya (fixture bertanggal), grep `^src/` kosong, build sukses.

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css tailwind.config.ts src/components/marketing/ProofSection.tsx tests/lib/marketing-palette.test.ts
git commit -m "feat(beranda): token amber untuk aksi, mint untuk hasil AI"
```

---

### Task 2: Hero — eyebrow "Ekstensi Chrome", judul 2–3 baris, tombol amber

**Files:**
- Modify: `src/components/marketing/Hero.tsx`
- Modify: `src/components/ui/button-styles.ts` (hanya kalau varian `primary` tidak otomatis ikut token — periksa dulu)

**Interfaces:**
- Consumes: token `--action`/`--on-action` dari Task 1.
- Produces: hero dengan eyebrow; tidak ada prop baru.

- [ ] **Step 1: Baca varian tombol lebih dulu**

Run: `cat src/components/ui/button-styles.ts`
Yang dicari: apakah `variant="primary"` memakai `bg-action text-on-action`. Kalau ya, tombol hero cukup diganti dari `variant="secondary"` (putih) ke default/primary dan warnanya ikut sendiri. Kalau tidak, catat kelas apa yang dipakai sebelum menyentuhnya — **jangan** menambal dengan hex lepas.

- [ ] **Step 2: Ganti eyebrow dan tombol**

Alasan eyebrow ada di spec §4: pembaca wajar mengira ini aplikasi web, lalu baru tahu di FAQ bahwa harus muat lewat developer mode — titik drop-off terbesar, dan sekarang diungkap paling bawah.

```tsx
-          <p className="text-body-lg font-semibold text-brand-sky">Nerona Metadata</p>
+          {/* Eyebrow menyebut BENTUK produknya, bukan namanya lagi.
+              Nama "Nerona Metadata" sudah berdiri di bilah atas dan di judul
+              seksi harga; yang belum pernah disebut di layar pertama adalah
+              bahwa ini ekstensi Chrome — dan itu yang paling menentukan
+              apakah pembaca yang salah sangka membuang waktunya. */}
+          <p className="font-mono text-label uppercase tracking-[0.08em] text-brand-sky">
+            Ekstensi Chrome
+          </p>
```

Judul: tambah `max-w-[18ch]` supaya wrap-nya 2–3 baris, bukan 5 (spec §4 poin 2):

```tsx
-          <h1 className="mt-3 text-balance text-display-1 text-white">
+          <h1 className="mt-3 max-w-[18ch] text-balance text-display-1 leading-[1.22] text-white">
```

Tombol utama jadi amber (spec §2 aturan 2 — putih juga warna teks di hero, jadi tombol putih tidak menandakan apa pun):

```tsx
-            <ButtonLink href="/register" variant="secondary" size="lg">
-              Mulai gratis
+            <ButtonLink href="/register" size="lg">
+              Coba gratis
```

- [ ] **Step 3: Samakan label CTA di seluruh halaman**

Spec §8: sekarang ada empat label berbeda. Pilih **"Coba gratis"** dan pakai di hero, `CtaBanner` pemanggil di HomeMetadataOnly, dan `ctaFor("Free")` di `src/lib/pricing-tiers.ts` (`"Mulai Gratis"` → `"Coba gratis"`).

- [ ] **Step 4: Gerbang keras**

Run: `npx tsc --noEmit 2>&1 | grep "^src/" ; npx next build`
Expected: grep kosong, build sukses.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/Hero.tsx src/lib/pricing-tiers.ts
git commit -m "feat(beranda): hero menyebut Ekstensi Chrome, tombol amber, satu label CTA"
```

---

### Task 3: Seksi tiga angka besar

**Files:**
- Create: `src/components/marketing/KeyNumbersSection.tsx`
- Modify: `src/components/marketing/home/HomeMetadataOnly.tsx`

**Interfaces:**
- Consumes: `poinPerGambar: number | null` (sudah dihitung HomeMetadataOnly lewat `defaultModelPointsPerImage()`).
- Produces: `<KeyNumbersSection poinPerGambar={…} />`.

- [ ] **Step 1: Buat komponennya**

Nol paragraf — hanya numeral dan label satu-dua kata (spec §3 "Variasi kepadatan"). Angka ketiga hilang kalau tarifnya belum bisa dihitung; jangan pernah menebaknya (aturan global).

```tsx
import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { Band } from "@/components/ui/Band";

/** Batas satu batch di ekstensi (BATCH_MAX_ITEMS di nerona_medata). */
const BATCH_MAX_ITEMS = 50;

/**
 * Tiga angka, nol paragraf.
 *
 * Menggantikan seksi "Satu klik. N marketplace." yang menjelaskan hal yang
 * sama dengan subjudul, paragraf, dan mockup sekaligus. Ketiga angkanya
 * BUKAN angka traksi — dua dihitung dari registry dan dari batas batch
 * ekstensi, satu dari tarif yang sedang berlaku — jadi tidak ada yang bisa
 * basi tanpa kodenya ikut berubah.
 *
 * Angka amber (`text-emphasis`, bukan `text-action`): amber mentah gagal
 * kontras sebagai teks di atas putih. Lihat tests/lib/marketing-palette.test.ts.
 */
export function KeyNumbersSection({ poinPerGambar }: { poinPerGambar: number | null }) {
  const angka = [
    { nilai: String(CLAIMABLE_MARKETPLACES.length), label: "marketplace" },
    { nilai: String(BATCH_MAX_ITEMS), label: "gambar per batch" },
    ...(poinPerGambar !== null && poinPerGambar > 0
      ? [{ nilai: `≈${poinPerGambar.toLocaleString("id-ID")}`, label: "poin per gambar" }]
      : []),
  ];

  return (
    <Band>
      <ul className="grid grid-cols-1 gap-10 text-center sm:grid-cols-3">
        {angka.map((item) => (
          <li key={item.label}>
            <p className="font-mono text-display-2 tabular-nums text-emphasis">{item.nilai}</p>
            <p className="mt-2 text-body-lg text-muted">{item.label}</p>
          </li>
        ))}
      </ul>
    </Band>
  );
}
```

- [ ] **Step 2: Gerbang keras**

Run: `npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: kosong. (Pemasangannya di beranda terjadi di Task 7 — seksi dipasang sekali, bukan dicicil, supaya build tidak pernah menampilkan halaman setengah jadi.)

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/KeyNumbersSection.tsx
git commit -m "feat(beranda): seksi tiga angka besar"
```

---

### Task 4: Band demo — video, dan gerbang asetnya

**Files:**
- Create: `src/lib/marketing-demo.ts`
- Create: `src/components/marketing/DemoBand.tsx`
- Test: `tests/lib/marketing-demo.test.ts`

**Interfaces:**
- Consumes: `getSetting` dari `src/lib/settings.ts` (periksa nama ekspornya lebih dulu: `grep -n "export" src/lib/settings.ts`).
- Produces: `demoVideoUrl(): Promise<string | null>` dan `<DemoBand url={…} />`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/lib/marketing-demo.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/settings", () => ({ getSetting: vi.fn() }));

import { demoVideoUrl } from "@/lib/marketing-demo";
import { getSetting } from "@/lib/settings";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NERONA_DEMO_VIDEO_URL;
});

describe("demoVideoUrl", () => {
  it("memakai nilai dari Setting kalau ada", async () => {
    (getSetting as any).mockResolvedValue("https://cdn.example/demo.mp4");
    expect(await demoVideoUrl()).toBe("https://cdn.example/demo.mp4");
  });

  it("jatuh ke env kalau Setting kosong", async () => {
    (getSetting as any).mockResolvedValue("");
    process.env.NERONA_DEMO_VIDEO_URL = "https://cdn.example/env.mp4";
    expect(await demoVideoUrl()).toBe("https://cdn.example/env.mp4");
  });

  /**
   * Yang menentukan: null, bukan string kosong. Band demo mengembalikan null
   * saat tidak ada video, dan pita gelap setinggi layar yang isinya kotak
   * hitam kosong lebih buruk daripada tidak ada pita sama sekali — sebab yang
   * sama dengan ProofSection.
   */
  it("null kalau tidak ada di keduanya", async () => {
    (getSetting as any).mockResolvedValue(null);
    expect(await demoVideoUrl()).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/lib/marketing-demo.test.ts`
Expected: FAIL — `Cannot find module '@/lib/marketing-demo'`.

- [ ] **Step 3: Implementasi minimal**

```ts
// src/lib/marketing-demo.ts
import { getSetting } from "./settings";

/** Kunci Setting yang owner isi dari /admin. */
export const DEMO_VIDEO_SETTING = "marketing_demo_video_url";

/**
 * URL video demo autofill, atau null.
 *
 * Rantainya DB → env → null, pola yang sama dipakai seluruh angka pemasaran
 * di repo ini. Null berarti bandnya tidak dirender: spec meminta band video
 * lebar penuh setelah hero, tapi videonya belum ada, dan pita navy pekat
 * berisi bingkai kosong memberi tahu pengunjung bahwa ada yang belum jadi.
 */
export async function demoVideoUrl(): Promise<string | null> {
  const dbValue = String((await getSetting(DEMO_VIDEO_SETTING)) || "").trim();
  if (dbValue) return dbValue;
  const envValue = String(process.env.NERONA_DEMO_VIDEO_URL || "").trim();
  return envValue || null;
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npx vitest run tests/lib/marketing-demo.test.ts`
Expected: PASS (3 tes).

- [ ] **Step 5: Buat bandnya**

Caption enam kata, nol paragraf (spec §3). Latar navy pekat `#0B1130` — **lebih gelap dari hero, sengaja** — jadi tambahkan nada band, bukan menimpa lewat className (sebabnya ada di docblock `Band.tsx`).

Di `src/app/globals.css`, di `@layer components`:

```css
  /**
   * Band demo: navy pekat rata, satu langkah lebih gelap dari hero.
   *
   * Rata, bukan bergradien: pita ini berisi satu video terang di tengahnya,
   * dan latar yang punya sumber cahayanya sendiri akan bersaing dengannya.
   */
  .band-navy-deep {
    background-color: #0b1130;
  }
```

Tambahkan nadanya di `src/components/ui/Band.tsx`:

```ts
 type BandTone = "plain" | "sunken" | "navy" | "navy-gradient" | "navy-deep";
 …
   "navy-gradient": "band-navy-glow text-white",
+  "navy-deep": "band-navy-deep text-white",
```

```tsx
// src/components/marketing/DemoBand.tsx
import { Band } from "@/components/ui/Band";

/**
 * Band demo autofill: satu video, satu caption, nol paragraf.
 *
 * Mengembalikan null tanpa URL — lihat lib/marketing-demo.ts.
 *
 * `playsInline` + `muted` + `loop` + `autoPlay` adalah kombinasi yang membuat
 * video berjalan sendiri di iOS; tanpa `muted`, Safari menolak autoplay dan
 * yang tampil adalah bingkai pertama yang beku. `controls` tetap ada supaya
 * orang bisa menghentikannya, dan `preload="metadata"` menahan unduhan penuh
 * sampai video itu benar-benar terlihat.
 */
export function DemoBand({ url }: { url: string | null }) {
  if (!url) return null;

  return (
    <Band tone="navy-deep" align="center">
      <video
        className="mx-auto w-full max-w-4xl"
        src={url}
        autoPlay
        muted
        loop
        playsInline
        controls
        preload="metadata"
      />
      <p className="mt-6 font-mono text-label uppercase text-navy-100">
        Satu klik, formulir terisi sendiri
      </p>
    </Band>
  );
}
```

- [ ] **Step 6: Gerbang keras**

Run: `npx vitest run tests/lib/marketing-demo.test.ts && npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: PASS, grep kosong.

- [ ] **Step 7: Commit**

```bash
git add src/lib/marketing-demo.ts src/components/marketing/DemoBand.tsx src/components/ui/Band.tsx src/app/globals.css tests/lib/marketing-demo.test.ts
git commit -m "feat(beranda): band demo video, dengan gerbang aset"
```

---

### Task 5: FAQ 11 → 6, sisanya pindah ke /faq, plus refund

**Files:**
- Modify: `src/lib/marketing-faq.ts`
- Modify: `tests/lib/marketing-faq.test.ts` (satu tes menunjuk daftar penuh, bukan daftar beranda)
- Create: `src/app/(marketing)/faq/page.tsx`
- Test: `tests/lib/marketing-faq-split.test.ts` (baru)

**Interfaces:**
- Produces: `metadataFaq(opts)` (tetap: **daftar penuh**, 12 item), `metadataFaqBeranda(opts)` (6 item).

- [ ] **Step 1: Tulis tes pemecahan yang gagal**

```ts
// tests/lib/marketing-faq-split.test.ts
import { describe, expect, it } from "vitest";

import { metadataFaq, metadataFaqBeranda } from "@/lib/marketing-faq";

const OPTS = { poinPerGambar: 2 };

describe("pemecahan FAQ", () => {
  /**
   * Enam, bukan sebelas. Pada sebelas item, FAQ sendiri hampir sepertiga
   * panjang beranda — dan pertanyaan yang tersisa di beranda dipilih karena
   * ia menghalangi pembelian, bukan karena ia sering ditanya.
   */
  it("beranda memuat tepat enam pertanyaan", () => {
    expect(metadataFaqBeranda(OPTS)).toHaveLength(6);
  });

  it("beranda adalah bagian dari daftar penuh, bukan salinan terpisah", () => {
    const penuh = metadataFaq(OPTS).map((i) => i.question);
    for (const item of metadataFaqBeranda(OPTS)) {
      expect(penuh).toContain(item.question);
    }
  });

  /**
   * Refund adalah hal pertama yang dicari pembeli hati-hati ketika
   * pembayarannya transfer manual dan aksesnya "berlaku selamanya", dan
   * sebelum ini tidak ada di halaman mana pun.
   */
  it("daftar penuh menjawab pengembalian dana", () => {
    const teks = metadataFaq(OPTS)
      .map((i) => `${i.question} ${i.answer}`)
      .join("\n")
      .toLowerCase();
    expect(teks).toContain("pengembalian dana");
  });

  /** Lima yang pindah tidak boleh ikut ke beranda. */
  it("pertanyaan bahasa metadata tidak lagi di beranda", () => {
    const beranda = metadataFaqBeranda(OPTS).map((i) => i.question).join("\n");
    expect(beranda).not.toContain("berbahasa apa");
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/lib/marketing-faq-split.test.ts`
Expected: FAIL — `metadataFaqBeranda is not a function`.

- [ ] **Step 3: Pecah daftarnya**

Di `src/lib/marketing-faq.ts`: tambah kolom `beranda?: true` pada item, tambah item refund, lalu ekspor penyaringnya. Enam yang **tetap di beranda** (spec §7): kartu kredit, marketplace apa saja, gambar diunggah ke server, apa itu poin, cara memasang ekstensi, cara pembayaran.

```ts
export interface MarketingFaqItem {
  question: string;
  answer: string;
  /**
   * Ikut tampil di beranda. Tanpa tanda ini, item hanya hidup di /faq.
   *
   * Satu daftar dengan penanda, BUKAN dua array: dua array berarti jawaban
   * yang sama disalin dua kali, dan salinan kedua akan basi tanpa ada yang
   * tahu — persis kegagalan yang docblock berkas ini melarang.
   */
  beranda?: true;
}

/** Daftar penuh — dipakai /faq. */
export function metadataFaq(opts: MetadataFaqOptions): MarketingFaqItem[] { … }

/** Enam yang menghalangi pembelian — dipakai beranda. */
export function metadataFaqBeranda(opts: MetadataFaqOptions): MarketingFaqItem[] {
  return metadataFaq(opts).filter((item) => item.beranda);
}
```

Item refund yang ditambahkan — kalimatnya **tidak boleh menjanjikan** kebijakan yang belum ada. Kalau owner belum menetapkannya, tulis apa yang benar hari ini:

```ts
    /**
     * TIDAK ada kebijakan refund tertulis di kode maupun DB — dicari di
     * lib/orders.ts, lib/payments/, dan halaman /syarat: kosong. Jadi
     * jawabannya menyebut jalurnya (hubungi tim), bukan janji berjangka
     * waktu. Begitu owner menetapkan kebijakannya, jawaban INI yang diubah,
     * dan /syarat ikut diperbarui.
     */
    {
      question: "Bagaimana kalau saya minta pengembalian dana?",
      answer:
        "Hubungi tim Nerona lewat halaman Kontak. Karena pembayarannya transfer dan aktivasinya manual, permintaan pengembalian dana ditangani satu per satu — sebutkan nomor order Anda dan alasannya, dan kami jawab di hari kerja yang sama.",
    },
```

- [ ] **Step 4: Perbaiki tes lama yang ikut berubah**

`tests/lib/marketing-faq.test.ts` menegaskan `"tagihan bulanan"` ada di teks FAQ. Pertanyaan itu pindah ke /faq, jadi tesnya tetap benar untuk `metadataFaq` (daftar penuh) dan **tidak boleh** diarahkan ke daftar beranda. Jalankan dulu untuk melihat apakah ia memang masih lulus:

Run: `npx vitest run tests/lib/marketing-faq.test.ts`
Expected: PASS tanpa disentuh (ia memanggil `metadataFaq`, yang tetap daftar penuh). Kalau gagal, itu tanda `metadataFaq` diubah jadi daftar beranda — perbaiki implementasinya, bukan tesnya.

- [ ] **Step 5: Buat halaman /faq**

```tsx
// src/app/(marketing)/faq/page.tsx
import type { Metadata } from "next";

import { FaqSection } from "@/components/marketing/FaqSection";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { metadataFaq } from "@/lib/marketing-faq";
import { defaultModelPointsPerImage } from "@/lib/marketing-points";

export const metadata: Metadata = {
  title: "Pertanyaan umum — Nerona Metadata",
  description:
    "Jawaban lengkap soal poin, bahasa metadata, kata kunci, pemasangan ekstensi, pembayaran, dan pengembalian dana.",
};

/**
 * Daftar PENUH, termasuk enam yang juga tampil di beranda.
 *
 * Sengaja tidak menyembunyikan yang enam itu: orang yang sampai ke halaman ini
 * datang dari tautan "Semua pertanyaan", dan daftar yang justru kehilangan
 * pertanyaan paling umum terbaca sebagai halaman yang rusak.
 */
export default async function FaqPage() {
  const poinPerGambar = await defaultModelPointsPerImage();

  return (
    <main>
      <FaqSection items={metadataFaq({ poinPerGambar })} />
      <CtaBanner
        title="Coba gratis hari ini"
        body="10 poin percobaan, sekali per akun — cukup untuk menilai hasilnya."
        ctaLabel="Coba gratis"
        ctaHref="/register"
      />
    </main>
  );
}
```

- [ ] **Step 6: Tautkan dari beranda**

Nanti di Task 7, `FaqSection` beranda diberi tautan "Semua pertanyaan ›" ke `/faq`. Catat di sini supaya tidak lupa: tanpa tautan itu, kelima pertanyaan yang dipindah menjadi tidak bisa dicapai siapa pun.

- [ ] **Step 7: Gerbang keras**

Run: `npx vitest run tests/lib/marketing-faq-split.test.ts tests/lib/marketing-faq.test.ts && npx tsc --noEmit 2>&1 | grep "^src/" ; npx next build`
Expected: PASS, grep kosong, build sukses.

- [ ] **Step 8: Commit**

```bash
git add src/lib/marketing-faq.ts "src/app/(marketing)/faq/page.tsx" tests/lib/marketing-faq-split.test.ts
git commit -m "feat(beranda): FAQ enam di beranda, lengkap di /faq, plus pengembalian dana"
```

---

### Task 6: Harga — "≈ N gambar" di kartunya, isi ulang jadi satu baris

**Files:**
- Modify: `src/lib/pricing-tiers.ts`
- Modify: `src/components/marketing/PricingTiers.tsx`
- Test: `tests/lib/pricing-tiers-sekali-bayar.test.ts` (tambah kasus)

**Interfaces:**
- Consumes: `gambarPerPoin` dari `src/lib/marketing-points.ts`, `defaultModelPointsPerImage()`.
- Produces: `metadataTiers(monthsInput?, poinPerGambar?: number | null)` — parameter kedua BARU, opsional, default `null` supaya pemanggil lain (halaman /pricing, /order) tidak patah.

- [ ] **Step 1: Tulis tes yang gagal**

Baca dulu tes yang ada supaya gaya mock-nya sama: `head -40 tests/lib/pricing-tiers-sekali-bayar.test.ts`. Lalu tambahkan:

```ts
/**
 * Poin di kartu tidak bisa ditimbang pembeli yang belum pernah memakai
 * alatnya — "600 poin" tidak berarti apa-apa sampai diterjemahkan ke jumlah
 * gambar, dan patokannya sekarang berdiri jauh di bawah ketiga kartu, yaitu
 * justru bukan di tempat keputusan dibuat.
 */
it("menerjemahkan jatah poin ke jumlah gambar di baris kartunya", async () => {
  // (mock Plan seperti tes di atasnya, priceMonthly 89000, nama "Pro")
  const tiers = await metadataTiers(1, 2);
  const pro = tiers.find((t) => t.name === "Pro")!;
  const baris = pro.features.map((f) => f.label).join("\n");
  expect(baris).toContain("≈ 300 gambar");
});

/** Tanpa tarif, angka gambarnya HILANG — tidak ditebak. */
it("tidak menyebut jumlah gambar kalau tarifnya belum diketahui", async () => {
  const tiers = await metadataTiers(1, null);
  const pro = tiers.find((t) => t.name === "Pro")!;
  expect(pro.features.map((f) => f.label).join("\n")).not.toContain("gambar");
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/lib/pricing-tiers-sekali-bayar.test.ts`
Expected: FAIL — `expected '…600 poin, dikreditkan saat paket aktif…' to contain '≈ 300 gambar'`.

- [ ] **Step 3: Sambungkan angkanya di allowanceLabel**

```ts
async function allowanceLabel(
  product: PlanProduct,
  planName: string,
  months: number,
  sekaliBayar = false,
  /**
   * Ongkos satu gambar dalam poin. `null` berarti tarifnya belum bisa
   * dihitung — dan jumlah gambarnya HILANG, bukan ditebak. Aturan yang sama
   * dijaga marketing-points.ts: kalau ragu, KURANGI.
   */
  poinPerGambar: number | null = null
): Promise<string> {
  const monthly = await pointsForPlan(product, planName);
  const gambar = gambarPerPoin(monthly, poinPerGambar);
  const perkiraan = gambar && gambar > 0 ? ` ≈ ${gambar.toLocaleString("id-ID")} gambar` : "";
  if (normalizePlan(planName) === "free") {
    return `${monthly.toLocaleString("id-ID")} poin sekali per akun${perkiraan}`;
  }
  if (sekaliBayar) {
    return `${monthly.toLocaleString("id-ID")} poin, dikreditkan saat paket aktif${perkiraan}`;
  }
  …
}
```

Lalu di `metadataTiers`, terima parameternya dan teruskan:

```ts
export async function metadataTiers(
  _monthsInput: number = 1,
  poinPerGambar: number | null = null
): Promise<PricingTier[]> {
```

```ts
          { label: await allowanceLabel("metadata", plan.name, planMonths, true, poinPerGambar), included: true },
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npx vitest run tests/lib/pricing-tiers-sekali-bayar.test.ts`
Expected: PASS.

- [ ] **Step 5: Isi ulang jadi satu baris di bawah kartu**

`PricingTiers.tsx` menerima prop baru, dan `TopupSection` berhenti dipakai beranda:

```tsx
  /**
   * Satu baris yang menggantikan seluruh seksi "Kehabisan poin? Isi ulang."
   *
   * Seksi itu menjawab pertanyaan yang muncul TEPAT setelah orang melihat
   * ketiga kartu, jadi jawabannya dipindah ke bawah kartunya — bukan dua
   * seksi di bawahnya.
   */
  catatanIsiUlang?: string | null;
```

```tsx
      {catatanIsiUlang && (
        <p className="mx-auto mt-6 max-w-[64ch] text-body text-muted">
          {catatanIsiUlang}{" "}
          <TextLink href="/finance" className="font-semibold">
            Isi ulang di halaman Keuangan
          </TextLink>
        </p>
      )}
```

- [ ] **Step 6: Gerbang keras**

Run: `npx vitest run && npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: hijau selain 2 kegagalan `orders.test.ts` yang sudah ada; grep kosong.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pricing-tiers.ts src/components/marketing/PricingTiers.tsx tests/lib/pricing-tiers-sekali-bayar.test.ts
git commit -m "feat(beranda): kartu harga menyebut jumlah gambar, isi ulang jadi satu baris"
```

---

### Task 7: Rakitan 8 seksi + kepadatan seksi prosa & bukti

**Files:**
- Modify: `src/components/marketing/home/HomeMetadataOnly.tsx`
- Modify: `src/components/marketing/ContributorPainSection.tsx`
- Modify: `src/components/marketing/ProofSection.tsx`
- Modify: `src/lib/nav.ts`

**Interfaces:**
- Consumes: `KeyNumbersSection`, `DemoBand`, `demoVideoUrl`, `metadataFaqBeranda`, `metadataTiers(1, poinPerGambar)`.
- Produces: beranda 8 seksi.

- [ ] **Step 1: Seksi prosa jadi benar-benar sepi**

`ContributorPainSection`: tiga kartu kutipan → satu paragraf tiga kalimat di kolom sempit (spec §5). Ini pemotongan kata terbesar di halaman.

```tsx
export function ContributorPainSection() {
  return (
    <Band>
      <div className="max-w-[46ch]">
        <h2 className="text-balance text-display-2 text-ink">Kenapa unggahan Anda tertahan</h2>
        <p className="mt-5 text-pretty text-lead text-muted">
          Bukan karyanya yang lambat — pekerjaan sesudahnyalah yang lambat. Satu gambar butuh
          judul, deskripsi, dan puluhan kata kunci. Lalu diulang, per marketplace.
        </p>
      </div>
    </Band>
  );
}
```

Tiga kutipan lama dihapus dari berkas ini. Kalau nanti dibutuhkan lagi, git yang menyimpannya — konstanta mati yang tidak dirender siapa pun justru mengundang dipakai kembali tanpa konteks.

- [ ] **Step 2: Bukti jadi grid 3 kolom**

`ProofSection`: `space-y-6` → grid, dan kartunya menumpuk vertikal (gambar di atas, metadata di bawah) supaya tiga kartu bisa berdampingan.

```tsx
-      <div className="mt-12 space-y-6">
+      {/* Grid tiga kolom, bukan tumpukan. Kartunya sekarang vertikal —
+          gambar di atas, metadata di bawah — karena tiga kartu dua-kolom
+          berdampingan menyisakan kolom teks selebar 20-an karakter.
+
+          Hari ini hanya SATU contoh yang `imageReady`, jadi gridnya merender
+          satu kartu. Itu disengaja: dua contoh sisanya (foto dan render 3D,
+          spec §5) menuntut karya sungguhan milik owner beserta metadata yang
+          benar-benar dihasilkan untuknya, dan mengarangnya melanggar aturan
+          yang dijaga docblock lib/marketing-samples.ts. Gridnya menyala
+          sendiri begitu entrinya masuk. */}
+      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
```

Di `SampleCard`, ganti gridnya jadi satu kolom:

```tsx
-      <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
+      <div className="flex h-full flex-col">
```

dan pembungkus gambar kehilangan `md:aspect-auto md:min-h-[20rem]` (rasio 4:3 di semua ukuran).

- [ ] **Step 3: Rakit ulang berandanya**

Urutan akhir (spec §3), latar berselang-seling putih/cekung dengan navy hanya di pembuka, band demo, dan penutup:

```tsx
  const [tiers, reject, poinPerGambar, demoUrl] = await Promise.all([
    metadataTiers(1, await defaultModelPointsPerImage()),  // ← lihat catatan di bawah
    rejectAnalyzerAvailability(),
    defaultModelPointsPerImage(),
    demoVideoUrl(),
  ]);
```

**Catatan penting:** `await` di dalam `Promise.all` itu salah — ia menjalankan `defaultModelPointsPerImage()` dua kali dan mematahkan paralelismenya. Yang benar dua tahap:

```tsx
  const poinPerGambar = await defaultModelPointsPerImage();
  const [tiers, reject, demoUrl] = await Promise.all([
    metadataTiers(1, poinPerGambar),
    rejectAnalyzerAvailability(),
    demoVideoUrl(),
  ]);
```

`getTopupPackages()` tidak lagi dipanggil di beranda — seksinya hilang. Ambil harga per poin termurah untuk `catatanIsiUlang`:

```tsx
  const topupPackages = await getTopupPackages();
  const termurah = topupPackages.length
    ? topupPackages.reduce((a, b) => (b.price / b.points < a.price / a.points ? b : a))
    : null;
  const catatanIsiUlang = termurah
    ? `Poin habis? Isi ulang dari ${perPointLabel(termurah)} — tanpa langganan.`
    : null;
```

Rakitannya:

```tsx
    <main>
      <Hero freePoints={freePoints} />
      <MarketplaceRow variant="strip" />
      <TrustBar />
      <DemoBand url={demoUrl} />
      <KeyNumbersSection poinPerGambar={poinPerGambar} />
      <ContributorPainSection />
      <ProofSection id="contoh" title="Ini hasilnya, apa adanya" body="Karya sungguhan, metadata yang benar-benar dihasilkan Nerona untuknya." />
      {/* Dua seksi jadi satu pita dua kolom, satu kalimat masing-masing. */}
      <BatchDanRejectSection id="fitur" reject={reject} />
      <PricingTiers id="pricing" heading="Harga Nerona Metadata" subheading="…" tiers={tiers} catatanPoin={catatanPoin} catatanIsiUlang={catatanIsiUlang} />
      <FaqSection id="faq" tone="sunken" items={metadataFaqBeranda({ poinPerGambar })} />
      <CtaBanner title="Coba gratis hari ini" body={`${freePoints} poin, cukup untuk menilai hasilnya.`} ctaLabel="Coba gratis" ctaHref="/register" />
    </main>
```

- [ ] **Step 4: Buat seksi gabungan batch + reject**

Dua `FeatureSection` bermockup → satu pita dua kolom sejajar, satu kalimat tiap kolom (spec §5 seksi 6). Buat sebagai komponen di berkas sendiri, `src/components/marketing/BatchDanRejectSection.tsx`, dan biarkan `FeatureSection` tidak tersentuh (halaman `/metadata` dan `/agent` masih memakainya — periksa: `grep -rln "FeatureSection" src`).

```tsx
export function BatchDanRejectSection({
  id,
  reject,
}: {
  id?: string;
  reject: { plans: string[]; note: string | null };
}) {
  return (
    <Band id={id}>
      <div className="grid gap-14 md:grid-cols-2 md:gap-20">
        <div>
          <h2 className="text-balance text-display-2 text-ink">Dibuat untuk unggahan massal</h2>
          <p className="mt-4 text-body-lg text-muted">
            Sampai {BATCH_MAX_ITEMS} gambar sekali jalan, progres per gambar.
          </p>
          <div className="mt-8"><BatchProgressMockup /></div>
        </div>
        {/* Kolom kanan HILANG kalau tidak ada paket yang menawarkan reject
            analyzer — sebab yang sama dengan seksi lamanya: menjanjikan fitur
            yang tidak bisa dibeli siapa pun lebih mahal daripada kehilangan
            satu kolom. */}
        {reject.plans.length > 0 && (
          <div>
            <h2 className="text-balance text-display-2 text-ink">Ditolak? Cari tahu kenapa</h2>
            <p className="mt-4 text-body-lg text-muted">
              Tempel alasan penolakan, Nerona menunjuk perbaikannya.
            </p>
            {reject.note && (
              <p className="mt-2 font-mono text-label uppercase text-muted">{reject.note}</p>
            )}
            <div className="mt-8"><RejectAnalysisMockup /></div>
          </div>
        )}
      </div>
    </Band>
  );
}
```

- [ ] **Step 5: Tautan "Semua pertanyaan" + anchor nav**

Tambah tautan ke `/faq` di bawah daftar FAQ beranda (tanpa itu kelima pertanyaan pindahan tidak bisa dicapai). Lalu periksa anchor nav: `src/lib/nav.ts` menunjuk `/#fitur` — pastikan `id="fitur"` benar-benar ada (sekarang dipasang di `BatchDanRejectSection`), dan `/#faq` serta `#pricing` juga ada.

Run: `grep -n 'id="fitur"\|id="faq"\|id="pricing"' src/components/marketing/home/HomeMetadataOnly.tsx`
Expected: ketiganya muncul.

- [ ] **Step 6: Gerbang keras**

Run: `npx vitest run && npx tsc --noEmit 2>&1 | grep "^src/" ; npx next build`
Expected: hijau selain 2 kegagalan `orders.test.ts` yang sudah ada; grep kosong; build sukses.

- [ ] **Step 7: Commit**

```bash
git add src/components/marketing src/lib/nav.ts
git commit -m "feat(beranda): delapan seksi, prosa sepi, bukti tiga kolom"
```

---

### Task 8: Checklist teknis §8

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/opengraph-image.tsx`
- Modify: `src/lib/marketplaces.ts`

- [ ] **Step 1: Judul & OG**

```ts
export const metadata: Metadata = {
  title: "Nerona Metadata — metadata AI untuk kontributor stock",
  …
};
```

OG image digenerate Next (tanpa aset baru, tanpa font tambahan — `next/og` memakai huruf sistemnya):

```tsx
// src/app/opengraph-image.tsx
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Digenerate, bukan berkas PNG.
 *
 * Alasannya sama dengan alasan angka pemasaran dihitung: gambar yang dibuat
 * tangan akan menyebut harga atau jumlah marketplace yang basi, dan tidak ada
 * yang akan ingat mengekspornya ulang. Yang di sini cuma nama dan satu
 * kalimat — keduanya tidak bergantung pada DB.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#131B42", color: "#fff", fontSize: 64, fontWeight: 600 }}>
        <div style={{ fontSize: 28, letterSpacing: 4, color: "#F2A93B", textTransform: "uppercase" }}>
          Ekstensi Chrome
        </div>
        <div style={{ marginTop: 24, lineHeight: 1.1 }}>
          Metadata untuk kontributor stock, ditulis otomatis.
        </div>
      </div>
    ),
    size
  );
}
```

- [ ] **Step 2: Keterangan satu kata untuk Magnific & Miricanvas**

Periksa bentuk data registry lebih dulu (`grep -n "MARKETPLACES" -A 20 src/lib/marketplaces.ts`). Kalau ada kolom deskripsi, isi keduanya; kalau tidak ada, **jangan** menambah kolom hanya untuk ini — cukup tulis keterangannya di jawaban FAQ "Marketplace apa saja yang didukung?" (`src/lib/marketing-faq.ts`), yang memang tempat namanya berdiri.

- [ ] **Step 3: `sizes` pada next/image**

Run: `grep -rn "<Image" -A 8 src/components src/app | grep -n "sizes" `
`ProofSection` sudah punya `sizes`, tapi nilainya `45vw` — setelah Task 7 kartunya jadi sepertiga lebar, jadi ubah ke `(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw`. Kalau ada `<Image>` lain tanpa `sizes`, tambahkan.

- [ ] **Step 4: Yang TIDAK dikerjakan, dan sebabnya**

- `alt` logo di `MarketingHeader.tsx` **tetap kosong**. Checklist §8 salah di titik ini: logonya berdampingan dengan tulisan "Nerona" di tautan yang sama, jadi mengisi `alt="Nerona"` membuat pembaca layar mengumumkan "Nerona Nerona". `alt=""` pada gambar dekoratif memang perilaku yang benar.
- `lang="id"` **sudah** ada di `src/app/layout.tsx`.
- `#pricing` **sudah** ada, dan hero sudah menunjuk ke sana.
- Gap chip kata kunci **sudah** benar (`gap-2` pada `<ul>`) — yang dilihat spec adalah artefak ekstraksi teks.
- Domain `vercel.app` → domain sendiri, dan email kontak: **langkah owner**, di luar kode.

- [ ] **Step 5: Gerbang keras**

Run: `npx vitest run && npx tsc --noEmit 2>&1 | grep "^src/" ; npx next build`
Expected: hijau selain 2 kegagalan `orders.test.ts` yang sudah ada; grep kosong; build sukses (build juga yang membuktikan `opengraph-image.tsx` bisa dikompilasi).

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/opengraph-image.tsx src/lib/marketing-faq.ts src/components/marketing/ProofSection.tsx
git commit -m "feat(beranda): judul deskriptif, OG image, sizes gambar bukti"
```

---

## Di luar rencana ini

- **Spec §9 seluruhnya** (demo drop-satu-gambar tanpa daftar, bukti sosial, Chrome Web Store). Tiga proyek terpisah; yang pertama menyentuh AI, poin, dan rate-limit anonim.
- **Dua contoh karya tambahan** (foto/Adobe Stock, render 3D/Shutterstock). Butuh karya sungguhan milik owner + metadata yang benar-benar dihasilkan untuknya; lihat `public/contoh/README.md`.
- **Video demo autofill.** Task 4 membangun bandnya dan gerbangnya; videonya sendiri direkam owner, lalu URL-nya diisi di Setting `marketing_demo_video_url`.
- **Free 10 → 20 poin** (spec §6). Itu keputusan harga, bukan tata letak, dan angkanya sudah bisa diubah owner dari Pengaturan tanpa satu baris kode.
- **Verifikasi mata.** Tidak ada Playwright di repo ini; rencana ini berhenti di `next build`.
