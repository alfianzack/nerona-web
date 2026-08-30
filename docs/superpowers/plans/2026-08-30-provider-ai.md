# Provider AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memindahkan semua kunci gateway ke satu tabel `AiProvider` yang dipilih per baris model, dan mengunci panel Model AI + Provider ke `owner_admin`.

**Architecture:** Tabel `ai_providers` menyimpan nama, baseUrl, dan kunci. `AiModel.providerId` wajib menunjuk ke sana; kolom `baseUrl`/`apiKey` di `ai_models` dan baris `Setting.ai_api_key` dihapus. `resolveAiForUser` tetap satu-satunya pintu panggilan — ia sekarang mengambil kunci dari provider baris itu, dengan rantai jatuh ke `SUMOPOD_API_KEY`/`SUMOPOD_BASE_URL` supaya deploy yang tidak pernah mengisi Setting tidak mati.

**Tech Stack:** Next.js 14 (App Router), Prisma 5 + PostgreSQL, vitest 1.6, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-30-provider-ai-design.md`

## Global Constraints

- Bahasa komentar & teks UI: **Indonesia**, mengikuti berkas di sekitarnya. Komentar menjelaskan **sebab**, bukan mengulang kode.
- Kunci API **tidak pernah** dikirim utuh ke browser. Daftar mengembalikan bentuk tersamar `****` + 4 huruf terakhir. Kolom kunci kosong dari browser = "biarkan yang tersimpan", bukan "hapus".
- Kosong berarti "lanjut ke sumber berikutnya", bukan "tidak ada kunci": `provider.apiKey` kosong → `SUMOPOD_API_KEY`; `provider.baseUrl` kosong → `SUMOPOD_BASE_URL` → `https://ai.sumopod.com/v1`.
- Tarif **tidak pernah** disalin dari `settings` di dalam SQL — rantai fallback env tidak terbaca dari sana, dan menyalinnya mengubah tagihan diam-diam.
- Tarif dikunci dari baris yang dipilih **sebelum** panggilan; jangan pernah mencarinya dari id model yang dikembalikan provider.
- Gerbang owner: sesi tanpa `role` → **401**; sesi ber-`role` selain `owner_admin` → **403**.
- Perintah tes: `npm test` (vitest run). Satu berkas: `npx vitest run tests/lib/<nama>.test.ts`.
- Migrasi: `npm run prisma:migrate` (lokal, `dotenv -e .env.local`).

---

### Task 1: Skema & migrasi

**Files:**
- Modify: `prisma/schema.prisma` (tambah `AiProvider`; ubah `AiModel`)
- Create: `prisma/migrations/20260830000000_ai_providers/migration.sql`

**Interfaces:**
- Consumes: tabel `ai_models` dan `settings` yang sudah ada.
- Produces: model Prisma `AiProvider` (`id`, `label`, `baseUrl`, `apiKey`, `isDefault`, `sortOrder`, `createdAt`, `updatedAt`, relasi `models`), dan `AiModel.providerId: string` + `AiModel.provider`. Baris provider bawaan berid tetap `prov_sumopod_default`.

Tugas ini tidak punya tes unit — yang diuji adalah SQL terhadap basis data sungguhan. Pembuktiannya menjalankan migrasi dan memeriksa hasilnya langsung.

- [ ] **Step 1: Tambahkan model `AiProvider` ke schema**

Sisipkan tepat di atas `model AiModel` di `prisma/schema.prisma`:

```prisma
/// Gateway tempat panggilan AI dikirim, beserta kuncinya. Didaftarkan sekali,
/// dipakai banyak baris AiModel — supaya kunci yang sama tidak pernah ditempel
/// dua kali dan diputar di satu tempat saja.
model AiProvider {
  id        String   @id @default(cuid())
  label     String
  baseUrl   String
  /// Kosong = jatuh ke SUMOPOD_API_KEY. Kosong berarti "lanjut ke sumber
  /// berikutnya", bukan "tidak ada kunci".
  apiKey    String   @default("")
  isDefault Boolean  @default(false)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  models AiModel[]

  @@map("ai_providers")
}
```

- [ ] **Step 2: Ubah `AiModel`**

Di `model AiModel`, hapus dua baris `baseUrl String?` dan `apiKey String?`, lalu tambahkan:

```prisma
  /// Wajib. Kolom opsional akan berarti "kosong = pakai gateway global", dan
  /// gateway global itulah yang dihapus perubahan ini.
  providerId String
  provider   AiProvider @relation(fields: [providerId], references: [id], onDelete: Restrict)
```

dan di bagian bawah blok, di samping `@@map("ai_models")`:

```prisma
  @@index([providerId])
```

- [ ] **Step 3: Tulis migrasi**

Buat `prisma/migrations/20260830000000_ai_providers/migration.sql`:

```sql
-- Semua kunci gateway pindah ke satu tempat.
--
-- Kunci disalin dari `settings`, TARIF TIDAK. Peringatan di migrasi
-- 20260828000000_ai_models masih berlaku: SQL tidak bisa membaca rantai
-- fallback env (AI_PRICE_IN / POINTS_PER_USD), jadi menyalin tarif dari
-- settings bisa diam-diam mengubah tagihan saat deploy. Kunci aman disalin
-- justru karena kosong tetap berarti "pakai env".
CREATE TABLE "ai_providers" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- Id tetap, bukan cuid: SQL tidak bisa memanggil cuid(), dan baris ini harus
-- bisa ditunjuk oleh pernyataan-pernyataan di bawah.
INSERT INTO "ai_providers" ("id", "label", "baseUrl", "apiKey", "isDefault", "sortOrder", "updatedAt")
VALUES (
    'prov_sumopod_default',
    'SumoPod',
    'https://ai.sumopod.com/v1',
    COALESCE((SELECT "value" FROM "settings" WHERE "key" = 'ai_api_key'), ''),
    true,
    0,
    CURRENT_TIMESTAMP
);

ALTER TABLE "ai_models" ADD COLUMN "providerId" TEXT;

-- Baris yang punya gateway sendiri (kunci ATAU alamat) dapat providernya
-- sendiri. Memakai apiKey saja akan membuang baseUrl milik baris yang memakai
-- kunci bersama di alamat lain.
INSERT INTO "ai_providers" ("id", "label", "baseUrl", "apiKey", "isDefault", "sortOrder", "updatedAt")
SELECT
    'prov_' || "id",
    'Gateway ' || "label",
    COALESCE(NULLIF(TRIM("baseUrl"), ''), 'https://ai.sumopod.com/v1'),
    COALESCE("apiKey", ''),
    false,
    0,
    CURRENT_TIMESTAMP
FROM "ai_models"
WHERE COALESCE(TRIM("apiKey"), '') <> '' OR COALESCE(TRIM("baseUrl"), '') <> '';

UPDATE "ai_models" SET "providerId" = 'prov_' || "id"
WHERE COALESCE(TRIM("apiKey"), '') <> '' OR COALESCE(TRIM("baseUrl"), '') <> '';

UPDATE "ai_models" SET "providerId" = 'prov_sumopod_default' WHERE "providerId" IS NULL;

ALTER TABLE "ai_models" ALTER COLUMN "providerId" SET NOT NULL;
ALTER TABLE "ai_models" DROP COLUMN "baseUrl";
ALTER TABLE "ai_models" DROP COLUMN "apiKey";

CREATE INDEX "ai_models_providerId_idx" ON "ai_models"("providerId");

-- RESTRICT, bukan SET NULL seperti users.aiModelId. Tenant yang kehilangan
-- pilihan model masih jatuh ke baris bawaan; model yang kehilangan gateway
-- tidak punya cadangan apa pun — ia hanya gagal saat dipanggil.
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Satu tempat kunci berarti satu tempat. Tanpa baris ini tersisa satu Setting
-- yang tidak dibaca siapa pun tetapi terlihat seperti kunci yang berlaku.
DELETE FROM "settings" WHERE "key" = 'ai_api_key';
```

- [ ] **Step 4: Periksa schema dan terapkan migrasi**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid`

Run: `npm run prisma:migrate`
Expected: migrasi `20260830000000_ai_providers` diterapkan, tidak ada prompt drift, tidak ada permintaan reset. Kalau Prisma menawarkan **reset database**, JANGAN diterima — itu tanda schema dan SQL tidak cocok. Perbaiki SQL-nya dulu.

- [ ] **Step 5: Buktikan hasilnya di basis data**

Run: `npx dotenv -e .env.local -- npx prisma db execute --stdin` dengan masukan:

```sql
SELECT "id", "label", "isDefault", ("apiKey" <> '') AS "punya_kunci" FROM "ai_providers";
```

Expected: satu baris `prov_sumopod_default` / `SumoPod` / `isDefault = true`. `punya_kunci` bernilai true kalau `ai_api_key` tadinya terisi, false kalau kuncinya selama ini datang dari env — keduanya benar.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260830000000_ai_providers
git commit -m "feat(db): tabel ai_providers, kunci gateway pindah dari Setting"
```

Catatan untuk pelaksana: setelah tugas ini `npm run build` akan MERAH sampai Task 3 selesai, karena `ai-models.ts` masih menyebut `row.apiKey` dan `row.baseUrl`. `npm test` tetap hijau (vitest tidak memeriksa tipe). Ini disengaja dan berumur dua tugas.

---

### Task 2: `lib/ai-providers.ts`

**Files:**
- Create: `src/lib/ai-providers.ts`
- Modify: `src/lib/agent/claude-client.ts:3` (ekspor literal alamat bawaan)
- Test: `tests/lib/ai-providers.test.ts`

**Interfaces:**
- Consumes: `prisma.aiProvider`, `prisma.aiModel.count`.
- Produces:
  - `FALLBACK_BASE_URL: string` dari `@/lib/agent/claude-client`
  - `resolveProviderCredentials(provider: { baseUrl: string; apiKey: string } | null): { apiKey: string; baseUrl: string }`
  - `AiProviderError` dengan `code: "not_found" | "label_required" | "base_url_required" | "in_use"`
  - `listProvidersForAdmin(): Promise<Array<{ id, label, baseUrl, isDefault, sortOrder, apiKeyMasked, apiKeySet }>>`
  - `getProviderById(id: string): Promise<{ id, label, baseUrl, apiKey } | null>`
  - `createProvider(input: AiProviderInput)`, `updateProvider(id, input)`, `deleteProvider(id)`, `setDefaultProvider(id)`
  - `AiProviderInput = { label: string; baseUrl: string; apiKey?: string; sortOrder?: number }` — `apiKey` undefined berarti biarkan yang tersimpan

- [ ] **Step 1: Tulis tes yang gagal**

Buat `tests/lib/ai-providers.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiProvider: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    aiModel: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import {
  AiProviderError,
  createProvider,
  deleteProvider,
  listProvidersForAdmin,
  resolveProviderCredentials,
  updateProvider,
} from "@/lib/ai-providers";
import { prisma } from "@/lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUMOPOD_API_KEY = "kunci-env";
  process.env.SUMOPOD_BASE_URL = "https://env.example/v1";
  (prisma.aiModel.count as any).mockResolvedValue(0);
  (prisma.aiProvider.findFirst as any).mockResolvedValue(null);
  (prisma.aiProvider.deleteMany as any).mockResolvedValue({ count: 1 });
  (prisma.$transaction as any).mockImplementation((ops: unknown[]) => Promise.resolve(ops));
});

describe("resolveProviderCredentials", () => {
  it("jatuh ke env saat belum ada provider sama sekali — deploy hari ini tidak boleh mati", () => {
    expect(resolveProviderCredentials(null)).toEqual({
      apiKey: "kunci-env",
      baseUrl: "https://env.example/v1",
    });
  });

  it("jatuh ke env saat providernya ada tapi kuncinya kosong", () => {
    const creds = resolveProviderCredentials({ baseUrl: "https://a.example/v1", apiKey: "" });
    expect(creds.apiKey).toBe("kunci-env");
    expect(creds.baseUrl).toBe("https://a.example/v1");
  });

  it("memakai kunci dan alamat provider saat keduanya terisi", () => {
    expect(resolveProviderCredentials({ baseUrl: "https://a.example/v1", apiKey: "kunci-a" })).toEqual({
      apiKey: "kunci-a",
      baseUrl: "https://a.example/v1",
    });
  });

  it("memakai alamat bawaan saat env alamat tidak diset", () => {
    delete process.env.SUMOPOD_BASE_URL;
    expect(resolveProviderCredentials(null).baseUrl).toBe("https://ai.sumopod.com/v1");
  });
});

describe("listProvidersForAdmin", () => {
  it("tidak pernah mengembalikan kunci utuh, hanya bentuk tersamar", async () => {
    (prisma.aiProvider.findMany as any).mockResolvedValue([
      { id: "p1", label: "SumoPod", baseUrl: "https://a", apiKey: "sk-rahasia7f21", isDefault: true, sortOrder: 0 },
    ]);
    const list = await listProvidersForAdmin();
    expect(list[0].apiKeyMasked).toBe("****7f21");
    expect(list[0].apiKeySet).toBe(true);
    expect(JSON.stringify(list)).not.toContain("sk-rahasia7f21");
  });

  it("menandai provider tanpa kunci sebagai belum terisi", async () => {
    (prisma.aiProvider.findMany as any).mockResolvedValue([
      { id: "p1", label: "SumoPod", baseUrl: "https://a", apiKey: "", isDefault: true, sortOrder: 0 },
    ]);
    const list = await listProvidersForAdmin();
    expect(list[0].apiKeySet).toBe(false);
    expect(list[0].apiKeyMasked).toBe("");
  });
});

describe("createProvider", () => {
  it("menolak nama kosong", async () => {
    await expect(createProvider({ label: "  ", baseUrl: "https://a" })).rejects.toMatchObject({
      code: "label_required",
    });
  });

  it("menolak alamat kosong — provider tanpa alamat tidak bisa dipanggil", async () => {
    await expect(createProvider({ label: "SumoPod", baseUrl: " " })).rejects.toMatchObject({
      code: "base_url_required",
    });
  });

  it("menyimpan kunci kosong sebagai string kosong, bukan null", async () => {
    (prisma.aiProvider.create as any).mockResolvedValue({ id: "p1" });
    await createProvider({ label: "SumoPod", baseUrl: "https://a" });
    expect((prisma.aiProvider.create as any).mock.calls[0][0].data.apiKey).toBe("");
  });
});

describe("updateProvider", () => {
  it("kunci yang tidak dikirim berarti biarkan yang tersimpan", async () => {
    (prisma.aiProvider.findFirst as any).mockResolvedValue({ id: "p1" });
    (prisma.aiProvider.update as any).mockResolvedValue({ id: "p1" });
    await updateProvider("p1", { label: "SumoPod", baseUrl: "https://a" });
    expect((prisma.aiProvider.update as any).mock.calls[0][0].data).not.toHaveProperty("apiKey");
  });

  it("kunci yang dikirim menggantikan yang tersimpan", async () => {
    (prisma.aiProvider.findFirst as any).mockResolvedValue({ id: "p1" });
    (prisma.aiProvider.update as any).mockResolvedValue({ id: "p1" });
    await updateProvider("p1", { label: "SumoPod", baseUrl: "https://a", apiKey: "kunci-baru" });
    expect((prisma.aiProvider.update as any).mock.calls[0][0].data.apiKey).toBe("kunci-baru");
  });
});

describe("deleteProvider", () => {
  it("menolak menghapus provider yang masih dipakai model", async () => {
    (prisma.aiModel.count as any).mockResolvedValue(2);
    await expect(deleteProvider("p1")).rejects.toBeInstanceOf(AiProviderError);
    await expect(deleteProvider("p1")).rejects.toMatchObject({ code: "in_use" });
    expect(prisma.aiProvider.deleteMany).not.toHaveBeenCalled();
  });

  it("menghapus provider yang tidak dipakai siapa pun", async () => {
    await deleteProvider("p1");
    expect(prisma.aiProvider.deleteMany).toHaveBeenCalledWith({ where: { id: "p1" } });
  });

  it("menolak id yang tidak ada", async () => {
    (prisma.aiProvider.deleteMany as any).mockResolvedValue({ count: 0 });
    await expect(deleteProvider("hantu")).rejects.toMatchObject({ code: "not_found" });
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run tests/lib/ai-providers.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ai-providers"`

- [ ] **Step 3: Ekspor alamat bawaan dari klien**

Di `src/lib/agent/claude-client.ts`, ganti baris 3:

```ts
/** Satu-satunya tempat alamat ini ditulis. */
export const FALLBACK_BASE_URL = "https://ai.sumopod.com/v1";
const BASE_URL = process.env.SUMOPOD_BASE_URL || FALLBACK_BASE_URL;
```

- [ ] **Step 4: Tulis implementasinya**

Buat `src/lib/ai-providers.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { FALLBACK_BASE_URL } from "@/lib/agent/claude-client";

export type AiProviderErrorCode = "not_found" | "label_required" | "base_url_required" | "in_use";

export class AiProviderError extends Error {
  constructor(readonly code: AiProviderErrorCode) {
    super(code);
    this.name = "AiProviderError";
  }
}

export interface ProviderCredentials {
  baseUrl: string;
  apiKey: string;
}

/**
 * Kunci dan alamat yang benar-benar dipakai satu panggilan.
 *
 * Kosong berarti "lanjut ke sumber berikutnya", bukan "tidak ada kunci" —
 * aturan yang sama dengan getAiSettings() sebelum kunci pindah ke sini. Tanpa
 * ini, deploy yang selama ini mengandalkan SUMOPOD_API_KEY akan mati pada saat
 * migrasi berjalan.
 *
 * Env dibaca saat dipanggil, bukan saat modul dimuat, supaya tes bisa
 * menyetelnya tanpa mengatur ulang urutan impor.
 */
export function resolveProviderCredentials(provider: ProviderCredentials | null): ProviderCredentials {
  return {
    apiKey: (provider?.apiKey || "").trim() || process.env.SUMOPOD_API_KEY || "",
    baseUrl:
      (provider?.baseUrl || "").trim() || process.env.SUMOPOD_BASE_URL || FALLBACK_BASE_URL,
  };
}

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 4) return "****";
  return "****" + key.slice(-4);
}

export interface AiProviderInput {
  label: string;
  baseUrl: string;
  /** Undefined = biarkan yang tersimpan. Kunci tidak pernah dikirim balik utuh. */
  apiKey?: string;
  sortOrder?: number;
}

function cleanInput(input: AiProviderInput) {
  const label = (input.label || "").trim();
  const baseUrl = (input.baseUrl || "").trim();
  if (!label) throw new AiProviderError("label_required");
  if (!baseUrl) throw new AiProviderError("base_url_required");
  return { label, baseUrl, sortOrder: input.sortOrder ?? 0 };
}

/** Daftar untuk panel owner — kunci hanya sebagai bentuk tersamar. */
export async function listProvidersForAdmin() {
  const rows = await prisma.aiProvider.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map(({ apiKey, ...rest }) => ({
    ...rest,
    apiKeyMasked: maskKey((apiKey || "").trim()),
    apiKeySet: Boolean((apiKey || "").trim()),
  }));
}

/** Dipakai probe koneksi, yang memang butuh kuncinya utuh di sisi server. */
export async function getProviderById(id: string) {
  return prisma.aiProvider.findFirst({ where: { id } });
}

export async function createProvider(input: AiProviderInput) {
  const data = cleanInput(input);
  return prisma.aiProvider.create({ data: { ...data, apiKey: (input.apiKey || "").trim() } });
}

export async function updateProvider(id: string, input: AiProviderInput) {
  const data = cleanInput(input);
  const existing = await prisma.aiProvider.findFirst({ where: { id } });
  if (!existing) throw new AiProviderError("not_found");
  const apiKey = input.apiKey === undefined ? undefined : input.apiKey.trim();
  return prisma.aiProvider.update({
    where: { id },
    data: { ...data, ...(apiKey === undefined ? {} : { apiKey }) },
  });
}

/**
 * Penolakan diperiksa di sini, bukan hanya diserahkan ke FK RESTRICT: pesan
 * "provider ini masih dipakai N model" bisa ditindaklanjuti, galat kendala
 * basis data tidak.
 */
export async function deleteProvider(id: string) {
  const used = await prisma.aiModel.count({ where: { providerId: id } });
  if (used > 0) throw new AiProviderError("in_use");
  const { count } = await prisma.aiProvider.deleteMany({ where: { id } });
  if (!count) throw new AiProviderError("not_found");
}

/** Tepat satu bawaan, dijaga dalam satu transaksi. */
export async function setDefaultProvider(id: string) {
  const existing = await prisma.aiProvider.findFirst({ where: { id } });
  if (!existing) throw new AiProviderError("not_found");
  await prisma.$transaction([
    prisma.aiProvider.updateMany({ where: {}, data: { isDefault: false } }),
    prisma.aiProvider.update({ where: { id }, data: { isDefault: true } }),
  ]);
}
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `npx vitest run tests/lib/ai-providers.test.ts`
Expected: PASS, 12 tes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai-providers.ts src/lib/agent/claude-client.ts tests/lib/ai-providers.test.ts
git commit -m "feat: lib provider AI dengan rantai fallback env"
```

---

### Task 3: Resolusi memakai provider, kunci keluar dari Setting

**Files:**
- Modify: `src/lib/ai-settings.ts` (buang `KEY_API`, `apiKey`, `maskKey`)
- Modify: `src/lib/ai-models.ts` (resolusi + input + validasi provider)
- Modify: `src/lib/ai-model-input.ts`
- Test: `tests/lib/ai-models.test.ts`, `tests/lib/ai-settings.test.ts`

**Interfaces:**
- Consumes: `resolveProviderCredentials`, `AiProviderError` dari Task 2.
- Produces:
  - `AiSettings = { model: string; pricing: AiPricing }` — `apiKey` HILANG
  - `ResolvedAi = { modelId: string; apiKey: string; baseUrl: string; pricing: AiPricing }` — `baseUrl` sekarang **selalu** terisi
  - `AiModelInput` menukar `baseUrl`/`apiKey` dengan `providerId: string`
  - `AiModelErrorCode` bertambah `"provider_required" | "provider_not_found"`

- [ ] **Step 1: Tulis tes yang gagal**

Di `tests/lib/ai-models.test.ts`: tambahkan `aiProvider: { findFirst: vi.fn() }` ke mock prisma, ganti `GLOBAL` jadi `{ model: "gemini-2.0-flash-lite", pricing: { inPerMTok: 0.25, outPerMTok: 1.5, pointsPerUsd: 1_000 } }` (tanpa `apiKey`), dan di `row()` ganti `baseUrl: null, apiKey: null` dengan:

```ts
    providerId: "p1",
    provider: { id: "p1", label: "SumoPod", baseUrl: "https://a.example/v1", apiKey: "kunci-a" },
```

Di `beforeEach`, tambahkan `process.env.SUMOPOD_API_KEY = "kunci-env";` dan `delete process.env.SUMOPOD_BASE_URL;`, lalu `(prisma.aiProvider.findFirst as any).mockResolvedValue(null);`

Ganti tes "behaves exactly like today" dan tambahkan yang baru:

```ts
describe("resolveAiForUser dengan registri kosong", () => {
  it("memakai model & tarif Koneksi AI, dan kunci dari provider bawaan", async () => {
    (prisma.aiProvider.findFirst as any).mockResolvedValue({
      id: "p0",
      baseUrl: "https://bawaan.example/v1",
      apiKey: "kunci-bawaan",
    });
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.modelId).toBe("gemini-2.0-flash-lite");
    expect(resolved.apiKey).toBe("kunci-bawaan");
    expect(resolved.baseUrl).toBe("https://bawaan.example/v1");
    expect(resolved.pricing).toEqual(GLOBAL.pricing);
  });

  it("jatuh ke env saat belum ada provider bawaan sama sekali", async () => {
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.apiKey).toBe("kunci-env");
    expect(resolved.baseUrl).toBe("https://ai.sumopod.com/v1");
  });
});

describe("resolveAiForUser memakai provider baris yang dipilih", () => {
  it("memakai kunci dan alamat provider baris itu, bukan gateway global", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ aiModelId: "m1", aiModel: row() });
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.apiKey).toBe("kunci-a");
    expect(resolved.baseUrl).toBe("https://a.example/v1");
  });

  it("jatuh ke kunci env saat provider baris itu belum diisi kuncinya", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      aiModelId: "m1",
      aiModel: row({ provider: { id: "p1", baseUrl: "https://a.example/v1", apiKey: "" } }),
    });
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.apiKey).toBe("kunci-env");
    expect(resolved.baseUrl).toBe("https://a.example/v1");
  });
});

describe("createModel", () => {
  it("menolak baris tanpa provider — model tanpa gateway tidak bisa dipanggil", async () => {
    await expect(
      createModel({
        label: "X",
        modelId: "x",
        inPerMTok: 1,
        outPerMTok: 1,
        vision: true,
        paidOnly: false,
        active: true,
        providerId: "  ",
      })
    ).rejects.toMatchObject({ code: "provider_required" });
  });

  it("menolak providerId yang tidak ada", async () => {
    (prisma.aiProvider.findFirst as any).mockResolvedValue(null);
    await expect(
      createModel({
        label: "X",
        modelId: "x",
        inPerMTok: 1,
        outPerMTok: 1,
        vision: true,
        paidOnly: false,
        active: true,
        providerId: "hantu",
      })
    ).rejects.toMatchObject({ code: "provider_not_found" });
  });
});
```

Tambahkan `createModel` ke daftar impor di berkas tes itu.

Di `tests/lib/ai-settings.test.ts`: hapus setiap tes dan assertion yang menyentuh `apiKey`, `apiKeyMasked`, atau `apiKeySet`, lalu tambahkan:

```ts
it("tidak lagi mengembalikan kunci — kunci tinggal di tabel provider", async () => {
  const settings = await getAiSettings();
  expect(settings).not.toHaveProperty("apiKey");
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run tests/lib/ai-models.test.ts tests/lib/ai-settings.test.ts`
Expected: FAIL — `resolved.baseUrl` masih `undefined` dan `createModel` belum mengenal `providerId`.

- [ ] **Step 3: Buang kunci dari `ai-settings.ts`**

Di `src/lib/ai-settings.ts`:
- Hapus `const KEY_API = "ai_api_key";` dan keluarkan `KEY_API` dari `ALL_KEYS`.
- `AiSettings` jadi `{ model: string; pricing: AiPricing }`; hapus baris `apiKey` di `getAiSettings`.
- `UpdateAiSettingsInput`: hapus `apiKey?`. Di `updateAiSettings`, hapus blok `const apiKey = ...; if (apiKey) ops.push(...)`.
- Hapus fungsi `maskKey`, serta `apiKeyMasked`/`apiKeySet` dari `AiSettingsView` dan `getAiSettingsView` (termasuk baris `effectiveKey`).

Tambahkan komentar di atas `AiSettings`:

```ts
/**
 * Kunci gateway TIDAK ada di sini. Ia tinggal di tabel AiProvider sejak migrasi
 * 20260830000000_ai_providers — satu tempat, supaya kunci yang sama tidak pernah
 * ditempel dua kali lalu diputar di satu tempat saja.
 */
```

- [ ] **Step 4: Ubah `ai-models.ts`**

- Tambah dua kode ke `AiModelErrorCode`: `| "provider_required" | "provider_not_found"`.
- Impor: `import { resolveProviderCredentials } from "@/lib/ai-providers";`
- `ResolvedAi.baseUrl` jadi `baseUrl: string` (buang tanda tanya dan komentar "Kosong = gateway global").
- `ModelRow`: ganti `baseUrl: string | null; apiKey: string | null;` dengan `providerId: string; provider?: { baseUrl: string; apiKey: string } | null;`
- `resolveAiForUser` jadi:

```ts
export async function resolveAiForUser(userId: string): Promise<ResolvedAi> {
  const [user, global] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { aiModelId: true, aiModel: { include: { provider: true } } },
    }),
    getAiSettings(),
  ]);

  const picked = user?.aiModel && user.aiModel.active ? (user.aiModel as ModelRow) : null;
  // Jatuhnya ke baris DEFAULT, bukan ke termurah. Bedanya adalah selisih antara
  // "tagihan yang owner tetapkan" dan "tagihan yang kebetulan paling murah".
  const row =
    picked ??
    ((await prisma.aiModel.findFirst({
      where: { isDefault: true, active: true },
      include: { provider: true },
    })) as ModelRow | null);

  // Tanpa baris model, model & tarif datang dari Koneksi AI dan kuncinya dari
  // provider bawaan. Tanpa provider bawaan pun, rantainya masih jatuh ke env —
  // nol baris di kedua tabel berarti perilaku sebelum keduanya ada.
  if (!row) {
    const fallback = await prisma.aiProvider.findFirst({ where: { isDefault: true } });
    const creds = resolveProviderCredentials(fallback);
    return { modelId: global.model, ...creds, pricing: global.pricing };
  }

  const creds = resolveProviderCredentials(row.provider ?? null);
  return {
    modelId: row.modelId,
    ...creds,
    pricing: pricingFor(row, global.pricing.pointsPerUsd),
  };
}
```

- `AiModelInput`: hapus `baseUrl?` dan `apiKey?`, tambah `providerId: string;`
- `cleanInput`: hapus baris `baseUrl`, tambah sebelum `return`:

```ts
  const providerId = (input.providerId || "").trim();
  if (!providerId) throw new AiModelError("provider_required");
```
  dan `providerId` masuk ke objek yang dikembalikan.
- Tambahkan penjaga yang dipakai `createModel` dan `updateModel`:

```ts
/**
 * Diperiksa di sini, bukan diserahkan ke FK: galat kendala basis data sampai ke
 * layar owner sebagai teks yang tidak bisa ditindaklanjuti.
 */
async function assertProviderExists(providerId: string) {
  const found = await prisma.aiProvider.findFirst({ where: { id: providerId } });
  if (!found) throw new AiModelError("provider_not_found");
}
```
- `createModel`: `const data = cleanInput(input); await assertProviderExists(data.providerId); return prisma.aiModel.create({ data });` (hapus seluruh urusan `apiKey`).
- `updateModel`: sama — `cleanInput`, cek `existing`, `await assertProviderExists(data.providerId)`, lalu `prisma.aiModel.update({ where: { id }, data })`. Hapus blok komentar dan logika `apiKey`.
- `listModelsForAdmin`: hapus pembuangan `apiKey`; kembalikan barisnya apa adanya (tidak ada lagi rahasia di tabel ini):

```ts
/** Daftar lengkap untuk panel owner. Tidak ada rahasia di tabel ini lagi. */
export async function listModelsForAdmin() {
  return prisma.aiModel.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
}
```

- [ ] **Step 5: Ubah `ai-model-input.ts`**

Ganti dua baris `baseUrl`/`apiKey` di objek yang dikembalikan dengan:

```ts
    providerId: typeof body?.providerId === "string" ? body.providerId : "",
```

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `npx vitest run tests/lib/ai-models.test.ts tests/lib/ai-settings.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai-settings.ts src/lib/ai-models.ts src/lib/ai-model-input.ts tests/lib/ai-models.test.ts tests/lib/ai-settings.test.ts
git commit -m "feat: resolusi AI mengambil kunci dari provider baris itu"
```

---

### Task 4: Probe koneksi jadi bisa diarahkan

**Files:**
- Modify: `src/lib/ai-connection-test.ts`
- Test: `tests/lib/ai-connection-test.test.ts`

**Interfaces:**
- Produces: `testAiConnection(params: { apiKey: string; baseUrl: string; model: string }): Promise<AiConnectionTestResult>` — tidak lagi membaca `getAiSettings`.

- [ ] **Step 1: Tulis tes yang gagal**

Di `tests/lib/ai-connection-test.test.ts`, buang mock `@/lib/ai-settings` dan panggil dengan parameter. Tambahkan dua tes yang mengunci perilaku yang mudah hilang saat berkas ini diubah:

```ts
it("meneruskan baseUrl provider ke setiap probe", async () => {
  chatCompletionMock.mockResolvedValue({ text: "ok" });
  await testAiConnection({ apiKey: "k", baseUrl: "https://a.example/v1", model: "m" });
  for (const call of chatCompletionMock.mock.calls) {
    expect(call[0].baseUrl).toBe("https://a.example/v1");
  }
});

it("tidak menjalankan probe gambar saat probe teks gagal — sebabnya sama", async () => {
  chatCompletionMock.mockRejectedValue(new Error("401 unauthorized"));
  const result = await testAiConnection({ apiKey: "k", baseUrl: "https://a", model: "m" });
  expect(chatCompletionMock).toHaveBeenCalledTimes(1);
  expect(result.vision.skipped).toBe(true);
});

it("menyensor kunci yang terbawa di pesan galat hulu", async () => {
  chatCompletionMock.mockRejectedValue(new Error("bad key sk-rahasia123 ditolak"));
  const result = await testAiConnection({ apiKey: "sk-rahasia123", baseUrl: "https://a", model: "m" });
  expect(result.text.error).not.toContain("sk-rahasia123");
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run tests/lib/ai-connection-test.test.ts`
Expected: FAIL — `testAiConnection` masih tanpa parameter dan `baseUrl` tidak pernah diteruskan.

- [ ] **Step 3: Ubah implementasinya**

Di `src/lib/ai-connection-test.ts`: hapus impor `getAiSettings`, tambahkan `baseUrl` ke `probe`, dan ubah tanda tangannya:

```ts
async function probe(
  messages: Array<{ role: string; content: unknown }>,
  model: string,
  apiKey: string,
  baseUrl: string
): Promise<ProbeResult> {
  try {
    await chatCompletion({ messages, model, apiKey, baseUrl, maxTokens: 16 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: safeMessage(err, apiKey) };
  }
}

export interface AiConnectionTestParams {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * Menguji satu provider terhadap satu model id, dalam dua langkah supaya
 * kegagalannya bisa didiagnosis: probe teks (kuncinya sah dan modelnya
 * terjangkau?) dan probe gambar (modelnya bisa membaca gambar sama sekali?).
 * Extension mengirim gambar untuk setiap fitur metadata, jadi lulus teks saja
 * belum cukup untuk menyebut sebuah konfigurasi baik.
 *
 * Ongkosnya dua penyelesaian sangat kecil dengan kunci owner. Bukan poin tenant.
 */
export async function testAiConnection({
  apiKey,
  baseUrl,
  model,
}: AiConnectionTestParams): Promise<AiConnectionTestResult> {
```

Isi fungsinya tetap sama, hanya setiap panggilan `probe(...)` mendapat argumen keempat `baseUrl`.

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npx vitest run tests/lib/ai-connection-test.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-connection-test.ts tests/lib/ai-connection-test.test.ts
git commit -m "feat: probe koneksi menerima provider dan model id"
```

---

### Task 5: Rute provider dan gerbang owner

**Files:**
- Create: `src/app/api/admin/ai-providers/route.ts`
- Create: `src/app/api/admin/ai-providers/[id]/route.ts`
- Create: `src/app/api/admin/ai-providers/[id]/test/route.ts`
- Create: `src/lib/ai-errors.ts` (pindahan dari `ai-model-errors.ts`)
- Delete: `src/lib/ai-model-errors.ts`, `src/app/api/admin/ai-settings/test/route.ts`, `tests/lib/ai-settings-test-route.test.ts`
- Modify: `src/app/api/admin/ai-models/route.ts`, `src/app/api/admin/ai-models/[id]/route.ts`, `src/app/api/model/route.ts` (impor + gerbang)
- Modify: `src/app/api/admin/ai-settings/route.ts` (badan tanpa `apiKey`)
- Test: `tests/lib/ai-provider-routes.test.ts`, `tests/lib/ai-model-routes.test.ts`

**Interfaces:**
- Consumes: seluruh ekspor Task 2, `testAiConnection` Task 4.
- Produces: `requireOwner(): Promise<NextResponse | null>` dari `@/lib/ai-errors` — mengembalikan respons penolakan, atau `null` kalau boleh lanjut. Juga `aiErrorResponse(err)` yang menerjemahkan `AiModelError` **dan** `AiProviderError`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `tests/lib/ai-provider-routes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const listMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const setDefaultMock = vi.fn();
const getByIdMock = vi.fn();
const testConnectionMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/ai-providers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai-providers")>("@/lib/ai-providers");
  return {
    ...actual,
    listProvidersForAdmin: (...a: unknown[]) => listMock(...(a as [])),
    createProvider: (...a: unknown[]) => createMock(...(a as [])),
    updateProvider: (...a: unknown[]) => updateMock(...(a as [])),
    deleteProvider: (...a: unknown[]) => deleteMock(...(a as [])),
    setDefaultProvider: (...a: unknown[]) => setDefaultMock(...(a as [])),
    getProviderById: (...a: unknown[]) => getByIdMock(...(a as [])),
  };
});
vi.mock("@/lib/ai-connection-test", () => ({
  testAiConnection: (...a: unknown[]) => testConnectionMock(...(a as [])),
}));

import { GET, POST } from "@/app/api/admin/ai-providers/route";
import { DELETE, PATCH } from "@/app/api/admin/ai-providers/[id]/route";
import { POST as TEST } from "@/app/api/admin/ai-providers/[id]/test/route";
import { AiProviderError } from "@/lib/ai-providers";

const ctx = { params: { id: "p1" } };

function req(payload: unknown, method = "POST"): Request {
  return new Request("http://localhost/api/admin/ai-providers", {
    method,
    body: JSON.stringify(payload),
  });
}

const VALID = { label: "SumoPod", baseUrl: "https://a.example/v1" };

beforeEach(() => {
  vi.clearAllMocks();
  getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "owner_admin" } });
  listMock.mockResolvedValue([]);
  createMock.mockResolvedValue({ id: "p1" });
  updateMock.mockResolvedValue({ id: "p1" });
  getByIdMock.mockResolvedValue({ id: "p1", baseUrl: "https://a.example/v1", apiKey: "kunci" });
  testConnectionMock.mockResolvedValue({ ok: true });
});

describe("gerbang owner", () => {
  it("menolak sesi tanpa role dengan 401", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });
    expect((await GET()).status).toBe(401);
    expect((await POST(req(VALID))).status).toBe(401);
  });

  it("menolak admin support dengan 403 — ia masuk, hanya tidak berwenang", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });
    expect((await GET()).status).toBe(403);
    expect((await POST(req(VALID))).status).toBe(403);
    expect((await PATCH(req(VALID, "PATCH"), ctx)).status).toBe(403);
    expect((await DELETE(req({}, "DELETE"), ctx)).status).toBe(403);
    expect((await TEST(req({ model: "m" }), ctx)).status).toBe(403);
    expect(createMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("meloloskan owner", async () => {
    expect((await GET()).status).toBe(200);
  });
});

describe("POST", () => {
  it("meneruskan kunci ke lapisan bawah saat dikirim", async () => {
    await POST(req({ ...VALID, apiKey: "kunci-baru" }));
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "kunci-baru" }));
  });

  it("tidak mengirim kunci sama sekali saat kolomnya kosong — kosong = biarkan", async () => {
    await POST(req({ ...VALID, apiKey: "" }));
    expect(createMock.mock.calls[0][0]).not.toHaveProperty("apiKey");
  });
});

describe("PATCH", () => {
  it("menjadikan bawaan sebagai aksi tersendiri, bukan kolom formulir", async () => {
    await PATCH(req({ isDefault: true }, "PATCH"), ctx);
    expect(setDefaultMock).toHaveBeenCalledWith("p1");
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("DELETE", () => {
  it("menerjemahkan penolakan 'masih dipakai' jadi 409 dengan pesan yang bisa ditindaklanjuti", async () => {
    deleteMock.mockRejectedValue(new AiProviderError("in_use"));
    const res = await DELETE(req({}, "DELETE"), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toContain("masih dipakai");
  });
});

describe("POST test", () => {
  it("menguji kunci tersimpan provider itu terhadap model id yang diketik", async () => {
    await TEST(req({ model: "claude-opus-5" }), ctx);
    expect(testConnectionMock).toHaveBeenCalledWith({
      apiKey: "kunci",
      baseUrl: "https://a.example/v1",
      model: "claude-opus-5",
    });
  });

  it("menolak permintaan tanpa model id — provider tidak bisa diuji sendirian", async () => {
    const res = await TEST(req({ model: "" }), ctx);
    expect(res.status).toBe(400);
    expect(testConnectionMock).not.toHaveBeenCalled();
  });
});
```

Di `tests/lib/ai-model-routes.test.ts`: tambahkan tes gerbang yang sama untuk rute admin model, dan sesuaikan `VALID_MODEL` dengan `providerId: "p1"`:

```ts
it("menolak admin support di rute model dengan 403", async () => {
  getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });
  expect((await adminGet()).status).toBe(403);
  expect((await adminPost(body(VALID_MODEL, "POST"))).status).toBe(403);
  expect((await adminPatch(body(VALID_MODEL), ctx)).status).toBe(403);
  expect((await adminDelete(body({}, "DELETE"), ctx)).status).toBe(403);
});

it("tidak mengubah rute tenant — tenant biasa tetap boleh memilih model", async () => {
  getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });
  accountStateMock.mockResolvedValue({ active: true, plan: "pro" });
  expect((await tenantGet()).status).toBe(200);
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `npx vitest run tests/lib/ai-provider-routes.test.ts tests/lib/ai-model-routes.test.ts`
Expected: FAIL — rute `ai-providers` belum ada.

- [ ] **Step 3: Buat `src/lib/ai-errors.ts`**

Salin isi `src/lib/ai-model-errors.ts`, lalu tambahkan provider dan gerbang owner:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AiModelError, type AiModelErrorCode } from "@/lib/ai-models";
import { AiProviderError, type AiProviderErrorCode } from "@/lib/ai-providers";

/**
 * Satu tempat menerjemahkan penolakan model & provider jadi jawaban HTTP,
 * supaya rute tenant dan rute owner tidak menjelaskan sebab yang sama dengan
 * kata berbeda.
 */
const MODEL_MESSAGES: Record<AiModelErrorCode, string> = {
  not_found: "Model tidak ditemukan.",
  inactive: "Model itu sedang tidak aktif.",
  no_vision: "Model itu tidak bisa membaca gambar, jadi tidak bisa dipakai untuk metadata.",
  paid_only: "Model itu hanya untuk paket berbayar.",
  label_required: "Nama model wajib diisi.",
  model_id_required: "Model id wajib diisi.",
  rate_invalid: "Tarif harus angka 0 atau lebih.",
  provider_required: "Provider wajib dipilih.",
  provider_not_found: "Provider itu tidak ditemukan.",
};

const MODEL_STATUS: Partial<Record<AiModelErrorCode, number>> = {
  not_found: 404,
  paid_only: 403,
  provider_not_found: 404,
};

const PROVIDER_MESSAGES: Record<AiProviderErrorCode, string> = {
  not_found: "Provider tidak ditemukan.",
  label_required: "Nama provider wajib diisi.",
  base_url_required: "Alamat gateway wajib diisi.",
  in_use: "Provider itu masih dipakai model. Pindahkan modelnya dulu, baru hapus providernya.",
};

const PROVIDER_STATUS: Partial<Record<AiProviderErrorCode, number>> = {
  not_found: 404,
  in_use: 409,
};

export function aiErrorResponse(err: unknown) {
  if (err instanceof AiModelError) {
    return NextResponse.json(
      { ok: false, message: MODEL_MESSAGES[err.code] },
      { status: MODEL_STATUS[err.code] ?? 400 }
    );
  }
  if (err instanceof AiProviderError) {
    return NextResponse.json(
      { ok: false, message: PROVIDER_MESSAGES[err.code] },
      { status: PROVIDER_STATUS[err.code] ?? 400 }
    );
  }
  throw err;
}

/**
 * Model dan provider menetapkan tarif dan memegang kunci — keduanya uang, jadi
 * `support` tidak cukup. 403, bukan 401: ia memang masuk, hanya tidak
 * berwenang. Pola yang sama dengan api/admin/prompts.
 */
export async function requireOwner(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) return NextResponse.json({ ok: false }, { status: 401 });
  if (session.user.role !== "owner_admin") {
    return NextResponse.json({ ok: false, message: "Hanya owner." }, { status: 403 });
  }
  return null;
}
```

Hapus `src/lib/ai-model-errors.ts`, dan di `src/app/api/model/route.ts` ganti impor `aiModelErrorResponse` dari `@/lib/ai-model-errors` menjadi `aiErrorResponse` dari `@/lib/ai-errors` (termasuk pemakaiannya di blok catch).

- [ ] **Step 4: Pasang gerbang owner di rute model**

Di `src/app/api/admin/ai-models/route.ts` dan `src/app/api/admin/ai-models/[id]/route.ts`: hapus fungsi lokal `admin()` beserta impor `getServerSession`/`authOptions`, lalu ganti tiap penjaga

```ts
  if (!(await admin())) return NextResponse.json({ ok: false }, { status: 401 });
```

dengan

```ts
  const denied = await requireOwner();
  if (denied) return denied;
```

dan ganti setiap `aiModelErrorResponse` menjadi `aiErrorResponse` (impor dari `@/lib/ai-errors`).

- [ ] **Step 5: Buat rute provider**

`src/app/api/admin/ai-providers/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createProvider, listProvidersForAdmin, type AiProviderInput } from "@/lib/ai-providers";
import { aiErrorResponse, requireOwner } from "@/lib/ai-errors";

/**
 * Kunci yang dikirim kosong berarti "biarkan yang tersimpan", jadi ia tidak
 * boleh ikut sebagai string kosong — itu akan menghapus kunci yang sudah ada.
 */
function parseInput(body: any): AiProviderInput {
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  return {
    label: typeof body?.label === "string" ? body.label : "",
    baseUrl: typeof body?.baseUrl === "string" ? body.baseUrl : "",
    sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
    ...(apiKey ? { apiKey } : {}),
  };
}

export async function GET() {
  const denied = await requireOwner();
  if (denied) return denied;
  return NextResponse.json({ ok: true, providers: await listProvidersForAdmin() });
}

export async function POST(request: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  try {
    const provider = await createProvider(parseInput(body));
    return NextResponse.json({ ok: true, id: provider.id });
  } catch (err) {
    return aiErrorResponse(err);
  }
}

export { parseInput };
```

`src/app/api/admin/ai-providers/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { deleteProvider, setDefaultProvider, updateProvider } from "@/lib/ai-providers";
import { aiErrorResponse, requireOwner } from "@/lib/ai-errors";
import { parseInput } from "../route";

interface Ctx {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: Ctx) {
  const denied = await requireOwner();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  try {
    // Menjadikan bawaan menyentuh SEMUA baris, jadi ia aksi tersendiri — bukan
    // kolom formulir yang diam-diam ikut terbawa satu klik "Simpan".
    if (body?.isDefault === true) {
      await setDefaultProvider(params.id);
      return NextResponse.json({ ok: true });
    }
    const provider = await updateProvider(params.id, parseInput(body));
    return NextResponse.json({ ok: true, id: provider.id });
  } catch (err) {
    return aiErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    await deleteProvider(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
```

`src/app/api/admin/ai-providers/[id]/test/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getProviderById, resolveProviderCredentials } from "@/lib/ai-providers";
import { testAiConnection } from "@/lib/ai-connection-test";
import { requireOwner } from "@/lib/ai-errors";

interface Ctx {
  params: { id: string };
}

/**
 * Provider tidak bisa diuji sendirian — yang menjawab sebuah panggilan adalah
 * pasangan gateway DAN model. Model id-nya diketik saat menguji dan tidak
 * disimpan; ia hanya bahan uji.
 */
export async function POST(request: Request, { params }: Ctx) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const model = typeof body?.model === "string" ? body.model.trim() : "";
  if (!model) {
    return NextResponse.json({ ok: false, message: "Isi model id untuk diuji." }, { status: 400 });
  }

  const provider = await getProviderById(params.id);
  if (!provider) {
    return NextResponse.json({ ok: false, message: "Provider tidak ditemukan." }, { status: 404 });
  }

  const { apiKey, baseUrl } = resolveProviderCredentials(provider);
  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      result: {
        ok: false,
        configured: false,
        model,
        text: { ok: false, skipped: true },
        vision: { ok: false, skipped: true },
      },
    });
  }

  const result = await testAiConnection({ apiKey, baseUrl, model });
  return NextResponse.json({ ok: true, result });
}
```

- [ ] **Step 6: Hapus rute uji lama dan kunci di rute pengaturan**

```bash
git rm -r src/app/api/admin/ai-settings/test tests/lib/ai-settings-test-route.test.ts
```

Di `src/app/api/admin/ai-settings/route.ts`, hapus `apiKey` dari badan yang diteruskan ke `updateAiSettings`. Di `tests/lib/ai-settings-route.test.ts`, hapus assertion apa pun tentang `apiKey`.

- [ ] **Step 7: Jalankan seluruh tes**

Run: `npm test`
Expected: PASS semuanya. Kalau `tool-loop`, `extension-generate-route`, atau `extension-me-route` merah, sebabnya hampir pasti `baseUrl` yang dulu `undefined` sekarang berisi alamat — perbarui harapannya, jangan kembalikan perilakunya.

- [ ] **Step 8: Commit**

```bash
git add -A src/app/api src/lib/ai-errors.ts tests/lib
git commit -m "feat(api): rute provider AI, gerbang owner untuk model & provider"
```

---

### Task 6: Panel owner

**Files:**
- Create: `src/components/admin/AdminAiProvidersPanel.tsx`
- Modify: `src/components/admin/AdminAiSettingsPanel.tsx` (menyusut)
- Modify: `src/components/admin/AdminAiModelsPanel.tsx` (dropdown provider)
- Modify: `src/app/(admin)/admin/pengaturan/page.tsx` (dua panel di balik gerbang owner)

**Interfaces:**
- Consumes: `GET/POST /api/admin/ai-providers`, `PATCH/DELETE /api/admin/ai-providers/[id]`, `POST /api/admin/ai-providers/[id]/test`.

- [ ] **Step 1: Susutkan panel Koneksi AI**

Di `AdminAiSettingsPanel.tsx` buang semuanya yang menyangkut kunci dan probe: state `apiKey`, `apiKeyMasked`, `apiKeySet`, `testing`, `testResult`, fungsi `handleTest`, `invalidateTestResult`, `hasUnsavedConnectionEdits`, `keyPlaceholder`, kolom `ai-key`, tombol "Cek koneksi" beserta keterangannya, dan komponen `ProbeRow`, `ConnectionTestReport`, beserta antarmuka `Probe`/`ConnectionTestResult`. Simpan `ISIAN_MONO`, `RateField`, dan ikon otaknya.

Judul dan tombolnya jadi:

```tsx
          <h2 className="text-title-2 text-ink">Bawaan &amp; tarif poin</h2>
          <p className="text-caption text-muted">
            Model bawaan dan kurs poin untuk agen dan extension
          </p>
```

```tsx
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
```

Badan `handleSave` mengirim `{ model, priceIn, priceOut, pointsPerUsd }` — tanpa `apiKey`.

Pada hint kolom model, sebutkan dari mana kuncinya sekarang datang:

```tsx
          hint="Id model yang dipakai saat daftar Model AI masih kosong. Kuncinya dari provider bawaan."
```

- [ ] **Step 2: Ganti kolom kunci di panel Model AI dengan dropdown provider**

Di `AdminAiModelsPanel.tsx`:
- `ModelRow`: ganti `baseUrl: string | null; apiKeySet: boolean;` dengan `providerId: string;`
- `KOSONG`: hapus `baseUrl` dan `apiKey`, tambah `providerId: ""`
- Tambah state `const [providers, setProviders] = useState<Array<{ id: string; label: string; isDefault: boolean }>>([]);` dan muat bersama yang lain di `muat()` dari `/api/admin/ai-providers` (`data.providers`)
- `bukaSunting`: `providerId: row.providerId`
- `bukaBaru`: `setDraft({ ...KOSONG, providerId: providers.find((p) => p.isDefault)?.id ?? providers[0]?.id ?? "" })` — pilihan awal yang masuk akal, bukan kolom kosong yang pasti ditolak
- `simpan`: `providerId: draft.providerId` di payload; buang `baseUrl` dan `apiKey`
- Lencana `{row.apiKeySet && <Badge tone="neutral">Gateway sendiri</Badge>}` diganti nama providernya:

```tsx
                    <Badge tone="neutral">
                      {providers.find((p) => p.id === row.providerId)?.label ?? "Provider terhapus"}
                    </Badge>
```

- Dua `Field` `model-base-url` dan `model-api-key` diganti satu pilihan:

```tsx
          <label className="grid gap-1.5">
            <span className="text-label text-ink">Provider</span>
            <select
              className="rounded-control px-3 py-2 text-body text-ink ring-1 ring-border"
              value={draft.providerId}
              onChange={(e) => setDraft({ ...draft, providerId: e.target.value })}
            >
              <option value="">— pilih provider —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="text-caption text-muted">
              Kunci dan alamat gateway diambil dari provider ini, tidak diisi lagi di sini.
            </span>
          </label>
```

- [ ] **Step 3: Tulis panel Provider**

Buat `src/components/admin/AdminAiProvidersPanel.tsx` mengikuti bentuk `AdminAiModelsPanel` (Card, daftar `<li>` ber-`ring-1 ring-border`, formulir yang muncul saat `editingId !== null`, `kirim()` yang memuat ulang setelah berhasil). Isinya:

- Daftar: nama, `<p className="mt-0.5 font-mono text-caption text-muted">{row.baseUrl}</p>`, kunci tersamar (`row.apiKeySet ? row.apiKeyMasked : "belum ada kunci — pakai SUMOPOD_API_KEY"`), lencana `<Badge tone="info">Bawaan</Badge>` saat `isDefault`
- Tombol per baris: "Jadikan bawaan" (kalau belum), "Sunting", "Hapus"
- Formulir: `label`, `baseUrl` (mono, placeholder `https://api.provider.com/v1`), `apiKey` (`type="password"`, hint `"Kosongkan untuk tetap memakai kunci yang tersimpan"`)
- Blok uji: satu `Field` model id + tombol "Cek", memanggil `POST /api/admin/ai-providers/${id}/test` dengan `{ model }`, lalu menampilkan hasilnya dengan `ProbeRow` dan `ConnectionTestReport` yang **dipindahkan** dari `AdminAiSettingsPanel` (salin apa adanya, termasuk komentar tentang glyph teks — alasannya masih berlaku)
- Pesan galat dari respons ditampilkan apa adanya; rute sudah mengirim teks yang bisa ditindaklanjuti (mis. "masih dipakai model")

- [ ] **Step 4: Pasang di halaman pengaturan**

Di `src/app/(admin)/admin/pengaturan/page.tsx`, impor panel baru dan pindahkan dua panel ke balik gerbang yang sudah ada:

```tsx
      {session.user.role === "owner_admin" && (
        <>
          <Sel>
            <AdminAiProvidersPanel />
          </Sel>
          <Sel>
            <AdminAiModelsPanel />
          </Sel>
          <Sel>
            <AdminPromptPanel />
          </Sel>
        </>
      )}
```

Hapus `<Sel><AdminAiModelsPanel /></Sel>` yang lama. Perbarui komentar di atas `requireAdmin()` supaya menyebut ketiganya, bukan hanya prompt.

- [ ] **Step 5: Periksa tipe dan tes**

Run: `npx tsc --noEmit`
Expected: tidak ada galat. Ini pemeriksaan pertama yang benar-benar menutup Task 1 — `npm test` tidak memeriksa tipe.

Run: `npm test`
Expected: PASS semuanya.

- [ ] **Step 6: Lihat dengan mata sendiri**

Run: `npm run dev`, masuk sebagai `owner_admin`, buka `/admin/pengaturan`. Periksa berurutan:

1. Panel **Provider AI** menampilkan `SumoPod` dengan lencana Bawaan
2. "Cek" dengan model id yang benar → hijau di teks & gambar
3. "Cek" dengan model id ngawur → merah, dan pesannya tidak memuat kunci
4. Tambah model baru: dropdown provider terisi, menyimpan tanpa memilih provider ditolak dengan "Provider wajib dipilih."
5. Hapus provider yang dipakai model itu → ditolak dengan "masih dipakai model"
6. Panel **Bawaan & tarif poin** tidak lagi punya kolom API key
7. Masuk sebagai admin `support` → panel Provider AI dan Model AI tidak muncul

- [ ] **Step 7: Commit**

```bash
git add src/components/admin src/app/\(admin\)
git commit -m "feat(ui): panel provider AI, panel model owner-only"
```

---

## Sesudah semua tugas

- [ ] `npm test` hijau seluruhnya
- [ ] `npx tsc --noEmit` bersih
- [ ] `npm run build` berhasil
- [ ] Migrasi belum diterapkan ke produksi — `20260828000000_ai_models` dan `20260830000000_ai_providers` menyusul bersama saat owner siap. Sesudah diterapkan, owner harus membuka panel Provider AI dan memastikan baris SumoPod punya kunci (kalau selama ini kuncinya dari env, kolomnya akan kosong dan itu benar).
- [ ] Set `SUMOPOD_API_KEY` di environment produksi SEBELUM migrasi dijalankan. Migrasi dan deploy berjalan terpisah (lihat `docs/vercel.md`), jadi urutan mana pun meninggalkan jendela rawan: migrasi dulu berarti kode lama masih mencari baris `Setting` yang baru saja dihapus migrasi, deploy dulu berarti kode baru menanyai tabel yang belum ada. Keduanya gagal aman, tapi kunci sudah ada di env menutup jendelanya sama sekali.
- [ ] Sesudah diterapkan, periksa juga Base URL baris SumoPod, bukan cuma kuncinya — migrasi menuliskan `https://ai.sumopod.com/v1` apa adanya (SQL tidak bisa membaca env), dan `baseUrl` yang terisi di baris itu sekarang didahulukan daripada `SUMOPOD_BASE_URL`.
