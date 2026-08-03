# Halaman unduh & lisensi Nerona Hub — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Halaman `/hub` di dalam aplikasi untuk mengunduh Nerona Hub, plus gerbang lisensi `/api/hub/*` yang membuat aplikasi itu hanya berfungsi untuk paket Business.

**Architecture:** Unduh terbuka untuk semua yang sudah masuk; yang dijaga adalah jawaban server saat aplikasi meminta metadata. Gerbangnya berupa kolom boolean `hubAccess` di `Plan` dan `License` — pola yang sama persis dengan `rejectAnalyzer` yang sudah ada.

**Tech Stack:** Next.js App Router, Prisma, NextAuth, Vitest, Tailwind.

Spec: `docs/superpowers/specs/2026-08-03-hub-download-design.md`
Branch: `hub-download`, bercabang dari `metadata-first-positioning`.

## Global Constraints

- **`/api/extension/*` tidak boleh disentuh sama sekali.** Extension milik pengguna Pro harus tetap hidup persis seperti sekarang. Kalau sebuah perubahan menyentuh berkas di `src/app/api/extension/`, itu tanda pendekatannya salah.
- **Gerbang paket memakai kolom `hubAccess`, tidak pernah mencocokkan `plan.name`.** Nama paket bisa diubah admin dari panel; begitu berubah, pencocokan nama berhenti bekerja tanpa satu pun tes gagal. Satu-satunya pengecualian ada di SQL backfill (Tugas 1), di mana nama paket saat migrasi memang sudah pasti.
- **`hubAccess` diperiksa SEBELUM poin dipotong.** Menolak setelah memotong poin berarti pengguna membayar untuk penolakan.
- **`/api/hub/me` selalu membalas 200 untuk token yang sah**, termasuk untuk non-Business, dengan `allowed: false`. Aplikasi desktop harus bisa memberi tahu penggunanya *kenapa* ia tidak bisa dipakai.
- Teks yang dilihat pengguna: bahasa Indonesia. Nama fungsi, variabel, dan kode galat: Inggris.
- Tes memakai Vitest, berada di `tests/lib/*.test.ts`, mengikuti gaya berkas yang sudah ada di sana.
- Tombol unduh yang belum punya URL menampilkan "Belum tersedia" dan tidak bisa diklik — bukan tautan yang menghasilkan 404.

---

### Task 1: Kolom `hubAccess` di Plan dan License

Tanpa ini tidak ada yang bisa dijaga. Dikerjakan pertama karena lima tugas berikutnya membacanya.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_hub_access/migration.sql`
- Modify: `prisma/seed.ts`
- Modify: `src/lib/admin-grants.ts:56`, `src/lib/admin-grants.ts:73`, `src/lib/orders.ts:94`
- Test: `tests/lib/hub-access-copy.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `Plan.hubAccess: boolean` dan `License.hubAccess: boolean`, keduanya `@default(false)`. Setiap tempat yang membuat lisensi menyalin `plan.hubAccess` ke lisensi, sama seperti `rejectAnalyzer`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/lib/hub-access-copy.test.ts
import { describe, it, expect } from "vitest";

// Lisensi mewarisi hubAccess dari paketnya saat dibuat. Kalau penyalinan ini
// terlewat di salah satu jalur, pelanggan Business membayar lalu ditolak
// aplikasinya — kegagalan yang hanya terlihat setelah uang berpindah.
describe("hubAccess mengikuti paket saat lisensi dibuat", () => {
  it("disalin di setiap tempat yang membuat lisensi", async () => {
    const sources = await Promise.all([
      import("node:fs").then((fs) => fs.readFileSync("src/lib/admin-grants.ts", "utf8")),
      import("node:fs").then((fs) => fs.readFileSync("src/lib/orders.ts", "utf8")),
    ]);
    for (const src of sources) {
      const rejectCount = (src.match(/rejectAnalyzer:\s*\w+\.rejectAnalyzer/g) || []).length;
      const hubCount = (src.match(/hubAccess:\s*\w+\.hubAccess/g) || []).length;
      expect(hubCount).toBe(rejectCount);
    }
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/lib/hub-access-copy.test.ts`
Expected: FAIL — `expected 0 to be 2` (admin-grants) karena `hubAccess` belum disalin di mana pun.

- [ ] **Step 3: Tambahkan kolom ke schema**

```prisma
model Plan {
  rejectAnalyzer Boolean  @default(false)
  hubAccess      Boolean  @default(false)   // akses aplikasi desktop Nerona Hub
}

model License {
  rejectAnalyzer Boolean   @default(false)
  hubAccess      Boolean   @default(false)
}
```

- [ ] **Step 4: Buat migrasi berikut backfill-nya**

```bash
npx prisma migrate dev --name add_hub_access
```

Lalu tambahkan backfill ke bawah berkas `migration.sql` yang dihasilkan:

```sql
-- Backfill: pelanggan Business yang lisensinya dibuat sebelum kolom ini ada
-- akan ditolak aplikasinya sampai baris ini berjalan. Pencocokan nama paket
-- dapat diterima DI SINI dan hanya di sini: saat migrasi dijalankan, nama
-- paketnya memang sudah pasti. Pemeriksaan saat runtime tetap memakai kolom.
UPDATE "plans" SET "hubAccess" = true WHERE "name" = 'Business';
UPDATE "licenses" SET "hubAccess" = true
 WHERE "planId" IN (SELECT "id" FROM "plans" WHERE "name" = 'Business');
```

- [ ] **Step 5: Perbarui seed**

Di `prisma/seed.ts`, tambahkan `hubAccess` ke tipe `SeedPlan` dan ke ketiga paket: `Free` → `false`, `Pro` → `false`, `Business` → `true`.

- [ ] **Step 6: Salin di ketiga tempat pembuat lisensi**

`src/lib/admin-grants.ts` baris 56 dan 73, tepat di bawah `rejectAnalyzer: plan.rejectAnalyzer,`:

```ts
        hubAccess: plan.hubAccess,
```

`src/lib/orders.ts` baris 94, tepat di bawah `rejectAnalyzer: freePlan.rejectAnalyzer,`:

```ts
    hubAccess: freePlan.hubAccess,
```

- [ ] **Step 7: Jalankan tes**

Run: `npx vitest run tests/lib/hub-access-copy.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add prisma/ src/lib/admin-grants.ts src/lib/orders.ts tests/lib/hub-access-copy.test.ts
git commit -m "feat: kolom hubAccess di Plan dan License, berikut backfill Business"
```

---

### Task 2: Gerbang `hubAccess` sebagai satu fungsi

**Files:**
- Modify: `src/lib/extension-sync.ts`
- Create: `src/lib/hub-access.ts`
- Test: `tests/lib/hub-access.test.ts`

**Interfaces:**
- Consumes: `ExtensionAccountState` dari Tugas 1.
- Produces:
  - `ExtensionAccountState.hubAccess: boolean` (field baru)
  - `export function hubAllowed(state: ExtensionAccountState): boolean`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/lib/hub-access.test.ts
import { describe, it, expect } from "vitest";
import { hubAllowed } from "@/lib/hub-access";
import type { ExtensionAccountState } from "@/lib/extension-sync";

function state(over: Partial<ExtensionAccountState> = {}): ExtensionAccountState {
  return {
    email: "a@b.c", plan: "Business", licenseStatus: "active", validUntil: null,
    marketplaces: "*", rejectAnalyzer: true, pointsBalance: 100,
    active: true, hubAccess: true, ...over,
  };
}

describe("hubAllowed", () => {
  it("mengizinkan Business dengan lisensi aktif", () => {
    expect(hubAllowed(state())).toBe(true);
  });

  it("menolak paket tanpa hubAccess", () => {
    expect(hubAllowed(state({ plan: "Pro", hubAccess: false }))).toBe(false);
  });

  // Lisensi mati lebih menentukan daripada paketnya. Tanpa ini, pelanggan
  // Business yang berhenti membayar tetap bisa memakai aplikasinya selamanya.
  it("menolak Business yang lisensinya sudah tidak aktif", () => {
    expect(hubAllowed(state({ active: false }))).toBe(false);
  });

  it("menolak Business yang lisensinya dicabut", () => {
    expect(hubAllowed(state({ active: false, licenseStatus: "revoked" }))).toBe(false);
  });

  // hubAccess sendirian tidak cukup, dan active sendirian juga tidak cukup —
  // keduanya wajib. Tes ini yang menangkap kalau salah satu syarat dihapus nanti.
  it("menuntut kedua syarat sekaligus", () => {
    expect(hubAllowed(state({ active: true, hubAccess: false }))).toBe(false);
    expect(hubAllowed(state({ active: false, hubAccess: true }))).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/lib/hub-access.test.ts`
Expected: FAIL — modul `@/lib/hub-access` tidak ditemukan.

- [ ] **Step 3: Tulis implementasi**

```ts
// src/lib/hub-access.ts
import type { ExtensionAccountState } from "@/lib/extension-sync";

/**
 * Gerbang aplikasi desktop Nerona Hub.
 *
 * Sengaja tidak melihat `state.plan`: nama paket adalah teks yang bisa diubah
 * admin dari panel, dan begitu berubah pencocokan nama berhenti bekerja tanpa
 * satu pun tes gagal. Yang menentukan adalah kolom `hubAccess`.
 */
export function hubAllowed(state: ExtensionAccountState): boolean {
  return state.active && state.hubAccess;
}
```

Lalu di `src/lib/extension-sync.ts`: tambahkan `hubAccess: boolean;` ke interface
`ExtensionAccountState`, sertakan `hubAccess: true` pada `select`/`include` lisensi
bila perlu, dan kembalikan `hubAccess: license?.hubAccess ?? false` di objek hasil —
tepat di sebelah `rejectAnalyzer`.

- [ ] **Step 4: Jalankan tes**

Run: `npx vitest run tests/lib/hub-access.test.ts tests/lib/extension-sync.test.ts`
Expected: PASS. `extension-sync.test.ts` yang sudah ada harus tetap hijau — kalau
gagal karena bentuk objeknya berubah, perbaiki tesnya, jangan hapus asersinya.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub-access.ts src/lib/extension-sync.ts tests/lib/hub-access.test.ts
git commit -m "feat: fungsi gerbang hubAllowed, hubAccess masuk state akun"
```

---

### Task 3: Tautan installer dari `Setting`

**Files:**
- Create: `src/lib/hub-download.ts`
- Test: `tests/lib/hub-download.test.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces:
  - `export interface HubDownloads { windows: string | null; mac: string | null; version: string | null }`
  - `export async function getHubDownloads(): Promise<HubDownloads>`
  - `export const HUB_SETTING_KEYS = ["hub_download_windows", "hub_download_mac", "hub_version"] as const`

Ikuti pola `src/lib/payment-settings.ts` yang membaca beberapa kunci sekaligus
dengan satu `findMany`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/lib/hub-download.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { setting: { findMany: (...a: unknown[]) => findMany(...a) } } }));

import { getHubDownloads } from "@/lib/hub-download";

beforeEach(() => findMany.mockReset());

describe("getHubDownloads", () => {
  it("mengembalikan null saat belum ada satu pun kunci", async () => {
    findMany.mockResolvedValue([]);
    expect(await getHubDownloads()).toEqual({ windows: null, mac: null, version: null });
  });

  it("memetakan tiap kunci ke bidangnya", async () => {
    findMany.mockResolvedValue([
      { key: "hub_download_windows", value: "https://x/NeronaHub.msi" },
      { key: "hub_download_mac", value: "https://x/NeronaHub.dmg" },
      { key: "hub_version", value: "1.0.0" },
    ]);
    expect(await getHubDownloads()).toEqual({
      windows: "https://x/NeronaHub.msi",
      mac: "https://x/NeronaHub.dmg",
      version: "1.0.0",
    });
  });

  // Nilai kosong atau spasi harus jadi null, bukan string kosong: halaman
  // memakai null untuk memutuskan tombolnya "Belum tersedia", dan string
  // kosong akan lolos sebagai "ada" lalu menghasilkan tautan ke halaman itu sendiri.
  it("memperlakukan nilai kosong dan spasi sebagai belum diisi", async () => {
    findMany.mockResolvedValue([
      { key: "hub_download_windows", value: "" },
      { key: "hub_download_mac", value: "   " },
    ]);
    const out = await getHubDownloads();
    expect(out.windows).toBeNull();
    expect(out.mac).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/lib/hub-download.test.ts`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Step 3: Tulis implementasi**

```ts
// src/lib/hub-download.ts
import { prisma } from "@/lib/prisma";

export const HUB_SETTING_KEYS = ["hub_download_windows", "hub_download_mac", "hub_version"] as const;

export interface HubDownloads {
  windows: string | null;
  mac: string | null;
  version: string | null;
}

// Kosong dan berisi spasi diperlakukan sama dengan belum diisi: halaman memakai
// null untuk memutuskan tombolnya "Belum tersedia".
function clean(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

export async function getHubDownloads(): Promise<HubDownloads> {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...HUB_SETTING_KEYS] } } });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    windows: clean(map.get("hub_download_windows")),
    mac: clean(map.get("hub_download_mac")),
    version: clean(map.get("hub_version")),
  };
}
```

- [ ] **Step 4: Jalankan tes**

Run: `npx vitest run tests/lib/hub-download.test.ts`
Expected: PASS, 3 tes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub-download.ts tests/lib/hub-download.test.ts
git commit -m "feat: baca tautan installer Nerona Hub dari Setting"
```

---

### Task 4: `GET /api/hub/me`

**Files:**
- Create: `src/app/api/hub/me/route.ts`
- Test: `tests/lib/hub-me-route.test.ts`

Contoh yang harus ditiru bentuknya: `src/app/api/extension/me/route.ts` dan
tesnya `tests/lib/extension-me-route.test.ts`.

**Interfaces:**
- Consumes: `resolveExtensionToken`, `getExtensionAccountState`, `hubAllowed`.
- Produces: `GET` yang membalas `{ ok: true, account: {...}, allowed: boolean }`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/lib/hub-me-route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const resolve = vi.fn();
const accountState = vi.fn();
vi.mock("@/lib/extension-auth", () => ({ resolveExtensionToken: (...a: unknown[]) => resolve(...a) }));
vi.mock("@/lib/extension-sync", () => ({ getExtensionAccountState: (...a: unknown[]) => accountState(...a) }));

import { GET } from "@/app/api/hub/me/route";

function req(token?: string) {
  return new Request("http://x/api/hub/me", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

const business = {
  email: "a@b.c", plan: "Business", licenseStatus: "active", validUntil: null,
  marketplaces: "*", rejectAnalyzer: true, pointsBalance: 50, active: true, hubAccess: true,
};

beforeEach(() => { resolve.mockReset(); accountState.mockReset(); });

describe("GET /api/hub/me", () => {
  it("menolak tanpa token", async () => {
    resolve.mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
  });

  it("membalas allowed true untuk Business aktif", async () => {
    resolve.mockResolvedValue({ userId: "u1" });
    accountState.mockResolvedValue(business);
    const body = await (await GET(req("t"))).json();
    expect(body.allowed).toBe(true);
    expect(body.account.pointsBalance).toBe(50);
  });

  // Ini yang paling penting di tugas ini: 200 dengan allowed:false, BUKAN 403.
  // Aplikasi desktop memakai jawaban ini untuk memberi tahu penggunanya kenapa
  // ia tidak bisa dipakai. Kalau suatu hari ada yang "merapikannya" jadi 403,
  // aplikasinya cuma bisa bilang "ditolak" tanpa sebab.
  it("tetap 200 untuk non-Business, dengan allowed false dan nama paketnya", async () => {
    resolve.mockResolvedValue({ userId: "u1" });
    accountState.mockResolvedValue({ ...business, plan: "Pro", hubAccess: false });
    const res = await GET(req("t"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allowed).toBe(false);
    expect(body.account.plan).toBe("Pro");
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/lib/hub-me-route.test.ts`
Expected: FAIL — modul route tidak ditemukan.

- [ ] **Step 3: Tulis implementasi**

```ts
// src/app/api/hub/me/route.ts
import { NextResponse } from "next/server";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { hubAllowed } from "@/lib/hub-access";

function bearerToken(request: Request): string | null {
  const m = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function GET(request: Request) {
  const token = bearerToken(request);
  const resolved = token ? await resolveExtensionToken(token) : null;
  if (!resolved) return NextResponse.json({ ok: false }, { status: 401 });

  const state = await getExtensionAccountState(resolved.userId);
  // Sengaja 200 walau tidak diizinkan: aplikasi desktop butuh tahu ALASANNYA,
  // dan hanya bisa menampilkannya kalau ia menerima nama paket + masa berlaku.
  return NextResponse.json({
    ok: true,
    account: { ...state, validUntil: state.validUntil ? state.validUntil.toISOString() : null },
    allowed: hubAllowed(state),
  });
}
```

- [ ] **Step 4: Jalankan tes**

Run: `npx vitest run tests/lib/hub-me-route.test.ts`
Expected: PASS, 3 tes.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/hub/me/route.ts tests/lib/hub-me-route.test.ts
git commit -m "feat: GET /api/hub/me, selalu 200 dengan flag allowed"
```

---

### Task 5: `POST /api/hub/generate`

**Files:**
- Create: `src/app/api/hub/generate/route.ts`
- Test: `tests/lib/hub-generate-route.test.ts`

Salinan `src/app/api/extension/generate/route.ts` dengan **satu** pemeriksaan
tambahan. Tesnya meniru `tests/lib/extension-generate-route.test.ts`.

**Interfaces:**
- Consumes: `resolveExtensionToken`, `getExtensionAccountState`, `hubAllowed`, `getAiSettings`, `chatCompletion`, `costForUsage`, `spendPoints`, `hit`, `buildMetadataPrompt`.
- Produces: `POST` dengan bentuk permintaan dan jawaban identik `/api/extension/generate`, plus `403 hub_not_allowed`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/lib/hub-generate-route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const resolve = vi.fn();
const accountState = vi.fn();
const spend = vi.fn();
const chat = vi.fn();

vi.mock("@/lib/extension-auth", () => ({ resolveExtensionToken: (...a: unknown[]) => resolve(...a) }));
vi.mock("@/lib/extension-sync", () => ({ getExtensionAccountState: (...a: unknown[]) => accountState(...a) }));
vi.mock("@/lib/points", () => ({ spendPoints: (...a: unknown[]) => spend(...a) }));
vi.mock("@/lib/agent/claude-client", () => ({ chatCompletion: (...a: unknown[]) => chat(...a) }));
vi.mock("@/lib/ai-settings", () => ({ getAiSettings: async () => ({ model: "m", apiKey: "k", pricing: {} }) }));

import { POST } from "@/app/api/hub/generate/route";

const business = {
  email: "a@b.c", plan: "Business", licenseStatus: "active", validUntil: null,
  marketplaces: "*", rejectAnalyzer: true, pointsBalance: 50, active: true, hubAccess: true,
};

function req(body: unknown) {
  return new Request("http://x/api/hub/generate", {
    method: "POST",
    headers: { authorization: "Bearer t", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const goodBody = {
  feature: "metadata",
  marketplace: "adobe_stock",
  image: { mime: "image/jpeg", dataBase64: "AAAA" },
};

beforeEach(() => {
  resolve.mockReset(); accountState.mockReset(); spend.mockReset(); chat.mockReset();
  resolve.mockResolvedValue({ userId: "u1" });
  chat.mockResolvedValue({ text: '{"title":"x","keywords":["a"]}', usage: {} });
  spend.mockResolvedValue(49);
});

describe("POST /api/hub/generate", () => {
  it("melayani Business aktif", async () => {
    accountState.mockResolvedValue(business);
    const res = await POST(req(goodBody));
    expect(res.status).toBe(200);
    expect(chat).toHaveBeenCalled();
  });

  it("menolak Pro dengan hub_not_allowed", async () => {
    accountState.mockResolvedValue({ ...business, plan: "Pro", hubAccess: false });
    const res = await POST(req(goodBody));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("hub_not_allowed");
  });

  // Aturan yang paling mudah rusak diam-diam saat urutan pemeriksaan diubah:
  // menolak SETELAH memotong poin berarti pengguna membayar untuk penolakan.
  it("tidak memotong poin dan tidak memanggil AI saat ditolak", async () => {
    accountState.mockResolvedValue({ ...business, plan: "Pro", hubAccess: false });
    await POST(req(goodBody));
    expect(spend).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
  });

  it("menolak lisensi Business yang sudah tidak aktif", async () => {
    accountState.mockResolvedValue({ ...business, active: false });
    expect((await POST(req(goodBody))).status).toBe(403);
    expect(spend).not.toHaveBeenCalled();
  });

  it("tetap menolak saldo poin habis", async () => {
    accountState.mockResolvedValue({ ...business, pointsBalance: 0 });
    expect((await POST(req(goodBody))).status).toBe(402);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/lib/hub-generate-route.test.ts`
Expected: FAIL — modul route tidak ditemukan.

- [ ] **Step 3: Tulis implementasi**

Salin isi `src/app/api/extension/generate/route.ts` apa adanya, lalu sisipkan
pemeriksaan berikut **tepat setelah** blok `if (!state.active)` dan **sebelum**
blok `if (state.pointsBalance <= 0)`:

```ts
  if (!hubAllowed(state)) {
    return NextResponse.json({ ok: false, error: "hub_not_allowed" }, { status: 403 });
  }
```

Ubah juga kunci rate-limit dari `extgen:` menjadi `hubgen:` supaya kuota
aplikasi desktop tidak memakan kuota extension pengguna yang sama, dan catatan
poin dari `Extension ${feature}` menjadi `Nerona Hub ${feature}` supaya rincian
tagihan pengguna bisa dibedakan sumbernya.

**Jangan menyentuh `src/app/api/extension/generate/route.ts`.**

- [ ] **Step 4: Jalankan tes**

Run: `npx vitest run tests/lib/hub-generate-route.test.ts tests/lib/extension-generate-route.test.ts`
Expected: PASS keduanya. Tes extension yang sudah ada wajib tetap hijau tanpa
diubah sama sekali — itu buktinya jalur extension benar-benar tidak tersentuh.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/hub/generate/route.ts tests/lib/hub-generate-route.test.ts
git commit -m "feat: POST /api/hub/generate dengan gerbang Business sebelum poin dipotong"
```

---

### Task 6: Halaman `/hub` dan menu

**Files:**
- Create: `src/app/(app)/hub/page.tsx`
- Create: `src/components/hub/HubDownloadPanel.tsx`
- Modify: `src/lib/nav.ts`
- Modify: `tests/lib/tenant-nav.test.ts`
- Test: `tests/lib/hub-page-state.test.ts`

**Interfaces:**
- Consumes: `getHubDownloads`, `getExtensionAccountState`, `hubAllowed`, sesi NextAuth.
- Produces: halaman di `/hub`; `hubStatusFor(state)` di `src/components/hub/HubDownloadPanel.tsx` yang memilih blok status.

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/lib/hub-page-state.test.ts
import { describe, it, expect } from "vitest";
import { hubStatusFor } from "@/components/hub/HubDownloadPanel";

const base = {
  email: "a@b.c", plan: "Business", licenseStatus: "active", validUntil: null,
  marketplaces: "*", rejectAnalyzer: true, pointsBalance: 10, active: true, hubAccess: true,
};

describe("hubStatusFor", () => {
  it("Business aktif → siap dipakai", () => {
    expect(hubStatusFor(base).kind).toBe("ready");
  });

  it("Pro → butuh upgrade, menyebut nama paketnya", () => {
    const out = hubStatusFor({ ...base, plan: "Pro", hubAccess: false });
    expect(out.kind).toBe("needs_business");
    expect(out.message).toContain("Pro");
  });

  // Kedaluwarsa dibedakan dari "belum pernah Business": ajakan yang benar
  // adalah memperpanjang, bukan membeli paket lain.
  it("Business kedaluwarsa → ajakan perpanjang, bukan ajakan upgrade", () => {
    const out = hubStatusFor({ ...base, active: false, validUntil: new Date("2026-01-01") });
    expect(out.kind).toBe("expired");
    expect(out.ctaHref).toBe("/paket");
  });

  it("tanpa lisensi sama sekali → butuh upgrade", () => {
    expect(hubStatusFor({ ...base, plan: null, licenseStatus: null, active: false, hubAccess: false }).kind)
      .toBe("needs_business");
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/lib/hub-page-state.test.ts`
Expected: FAIL — modul komponen tidak ditemukan.

- [ ] **Step 3: Tulis `hubStatusFor` dan komponennya**

```tsx
// src/components/hub/HubDownloadPanel.tsx (bagian logika)
import type { ExtensionAccountState } from "@/lib/extension-sync";
import { hubAllowed } from "@/lib/hub-access";

export type HubStatus = {
  kind: "ready" | "needs_business" | "expired";
  message: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export function hubStatusFor(state: ExtensionAccountState): HubStatus {
  if (hubAllowed(state)) {
    return { kind: "ready", message: "Lisensi Business kamu aktif. Tempel token dari halaman Profile untuk mulai memakai Nerona Hub." };
  }
  // Pernah Business tapi mati ≠ belum pernah Business. Ajakan yang benar untuk
  // yang pertama adalah memperpanjang; menawarinya "upgrade" terasa salah baca.
  if (state.hubAccess && !state.active) {
    return {
      kind: "expired",
      message: "Lisensi Business kamu sudah berakhir. Perpanjang untuk memakai Nerona Hub lagi.",
      ctaHref: "/paket",
      ctaLabel: "Perpanjang",
    };
  }
  return {
    kind: "needs_business",
    message: `Paket kamu ${state.plan ?? "belum ada"}. Nerona Hub butuh paket Business.`,
    ctaHref: "/paket",
    ctaLabel: "Lihat paket Business",
  };
}
```

Bagian tampilannya: dua tombol unduh (Windows, macOS). Bila URL-nya `null`,
tombolnya `disabled` dengan teks "Belum tersedia" — bukan `<a>` tanpa `href`.
Tombol tetap aktif untuk semua status; yang berubah hanya blok status di bawahnya.

- [ ] **Step 4: Tulis halamannya**

`src/app/(app)/hub/page.tsx` — server component yang mengambil sesi, memanggil
`getExtensionAccountState(session.user.id)` dan `getHubDownloads()`, lalu
merender `HubDownloadPanel`. Ikuti bentuk halaman `(app)` yang sudah ada, misalnya
`src/app/(app)/riwayat-metadata/page.tsx`.

- [ ] **Step 5: Tambahkan entri menu**

Di `src/lib/nav.ts`, tambahkan `{ href: "/hub", label: "Nerona Hub", icon: "box" }`
ke grup yang memuat `/riwayat-metadata`.

- [ ] **Step 6: Perbarui tes menu yang akan gagal**

`tests/lib/tenant-nav.test.ts` mengunci isi menu dan **akan gagal begitu entri
ditambahkan** — itu memang tugasnya. Perbarui asersinya agar memuat `/hub`.
Jangan melemahkan tesnya jadi sekadar "menu tidak kosong"; ia ada untuk mencegah
entri hilang tanpa sengaja.

- [ ] **Step 7: Jalankan seluruh tes**

Run: `npx vitest run`
Expected: PASS semuanya, termasuk seluruh tes yang sudah ada sebelumnya.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/hub src/components/hub src/lib/nav.ts tests/lib/
git commit -m "feat: halaman /hub dengan tiga keadaan lisensi dan menu"
```

---

## Self-Review

**Cakupan spec.** Bagian 3 (halaman) → Tugas 6. Bagian 4 (Setting) → Tugas 3.
Bagian 5 (`/api/hub/me` dan `/api/hub/generate`) → Tugas 4 dan 5. Bagian 6
(kolom `hubAccess`) → Tugas 1 dan 2. Bagian 7 (pengujian) → tersebar; tiap
butirnya punya tes bernama di tugas yang bersangkutan. Bagian 10 risiko 3
(backfill lisensi lama) → Tugas 1 Step 4, di dalam migrasinya sendiri, bukan
sebagai langkah manual yang bisa terlupa.

**Bagian 9 spec (konsekuensi untuk repo `nerona-hub`)** sengaja tidak ada di
rencana ini — itu pekerjaan di repo lain. Yang harus dikerjakan di sana:
`core/src/api.rs` memakai `/api/hub/me` dan `/api/hub/generate`, dan
`403 hub_not_allowed` diterjemahkan jadi pesan "paketmu belum Business", bukan
galat umum. Sudah tercatat di ledger repo itu.

**Nama lintas tugas** sudah disamakan: `ExtensionAccountState` (Tugas 2) dipakai
Tugas 4, 5, 6. `hubAllowed` (Tugas 2) dipakai Tugas 4, 5, 6. `getHubDownloads`
(Tugas 3) dipakai Tugas 6. `hubAccess` (Tugas 1) dibaca semuanya.

**Urutan wajib:** Tugas 1 → 2 mendahului 4, 5, 6. Tugas 3 hanya diperlukan
Tugas 6. Tugas 4 dan 5 tidak saling bergantung.
