# Penyambungan Tanpa Salin-Tempel Token — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pengguna menyambungkan Extension Metadata dan Nerona Hub ke akunnya tanpa pernah melihat, menyalin, atau menempel token.

**Architecture:** Dua mekanisme, sesuai kemampuan platform. Extension hidup di dalam browser yang sudah memegang sesi login, jadi dasbor mengoper token langsung lewat `window.postMessage` ke content script khusus. Hub adalah proses terpisah tanpa akses cookie, jadi ia memakai kode pasangan: Hub membuat kode, membuka browser, pengguna mencocokkan kode lalu menyetujui, dan Hub menukar `deviceSecret`-nya dengan token lewat polling.

**Tech Stack:** Next.js App Router + Prisma + vitest (`nerona-web`); Chrome MV3 content script (`nerona_medata`); Rust + Tauri 2 + reqwest + mockito (`nerona-hub`).

**Spec:** `docs/superpowers/specs/2026-08-06-penyambungan-tanpa-token-design.md`

## Global Constraints

- **Tiga repo terpisah, tiga riwayat git.** `nerona-web`, `nerona_medata`, dan `nerona-hub` masing-masing repo sendiri. Commit di repo tempat berkasnya berada. Jangan pernah `git add` lintas repo.
- **Semua perintah cargo wajib `cargo +stable-x86_64-pc-windows-gnu ...`.** Mesin pengembang tidak punya linker MSVC dan akunnya bukan administrator. `cargo check` dan `cargo clippy --workspace --all-targets` bekerja termasuk crate Tauri; `cargo test` **tidak bisa menaut** di `app/src-tauri`. Karena itu semua logika yang layak dites wajib tinggal di crate `core/`.
- **Penjaga yang menyangkut uang atau tindakan tak bisa dibatalkan ditaruh di Rust, bukan React.** `App.tsx` me-render layar secara kondisional, jadi pindah nav meng-unmount komponen dan menghancurkan state/ref apa pun yang dipakai sebagai kunci.
- **Tidak ada kolom alamat server di antarmuka mana pun.** Alamat nerona-web adalah konstanta di `app/src-tauri/src/config.rs` (`https://nerona-web.vercel.app`, ditimpa env `NERONA_WEB_BASE_URL`) dan di `access/access-config.js`. Kolom alamat jadi sasaran penipuan.
- **Bahasa antarmuka Indonesia**, termasuk pesan galat. Pesan galat selalu menyebut langkah berikutnya, bukan cuma menyatakan kegagalan (`core/src/error.rs:35`).
- **Token yang sudah ada tetap berlaku.** Tidak ada migrasi yang memaksa pengguna menyambung ulang.
- **Prompt generate metadata di extension tidak boleh disentuh** dalam pekerjaan ini.
- Jalankan tes web dengan `npm test` (= `vitest run`) dari `nerona-web/`.

---

## Struktur berkas

### `nerona-web`

| Berkas | Tanggung jawab |
| --- | --- |
| `prisma/schema.prisma` | tambah model `DevicePairing` + relasi balik di `User` dan `ExtensionToken` |
| `prisma/migrations/20260806000000_add_device_pairings/migration.sql` | SQL migrasinya |
| `src/lib/device-pairing.ts` | **baru** — seluruh aturan pasangan: buat kode, setujui, klaim. Tidak tahu apa-apa soal HTTP |
| `src/app/api/extension/pair/start/route.ts` | **baru** — tanpa auth, dibatasi laju per IP |
| `src/app/api/extension/pair/poll/route.ts` | **baru** — auth `Bearer {deviceSecret}` |
| `src/app/api/extension/pair/approve/route.ts` | **baru** — auth sesi web |
| `src/app/(app)/hubungkan/page.tsx` | **baru** — halaman persetujuan |
| `src/app/(app)/hubungkan/FormPersetujuan.tsx` | **baru** — klien; tombol Setujui/Tolak |
| `src/components/account/ExtensionConnectPanel.tsx` | ditulis ulang jadi "Perangkat terhubung" |
| `tests/lib/device-pairing.test.ts` | **baru** |
| `tests/lib/pair-routes.test.ts` | **baru** |

Aturan yang dipegang: **`device-pairing.ts` tidak pernah menyentuh `Request`/`NextResponse`**, dan route tidak pernah menyentuh `prisma` langsung. Itu yang membuat aturannya bisa dites tanpa membangun HTTP.

### `nerona_medata`

| Berkas | Tanggung jawab |
| --- | --- |
| `access/nerona-connect.js` | **baru** — content script khusus origin nerona-web |
| `manifest.json` | satu entri `content_scripts` baru |
| `popup.html` / `popup.js` | kartu status + kolom tempel token pindah ke `<details>` |

### `nerona-hub`

| Berkas | Tanggung jawab |
| --- | --- |
| `core/src/pairing.rs` | **baru** — `mulai` + `tunggu` (polling). Bisa dites |
| `core/src/lib.rs` | daftarkan modul |
| `app/src-tauri/src/akun.rs` | tiga perintah baru + nama perangkat |
| `app/src-tauri/src/main.rs` | daftarkan perintah + plugin opener |
| `app/src-tauri/Cargo.toml` | `tauri-plugin-opener` |
| `app/src-tauri/capabilities/default.json` | izin opener |
| `app/src/layar/Akun.tsx` | tiga keadaan: belum tersambung / menunggu / tersambung |
| `app/src/App.tsx` | segarkan status saat window difokuskan |

---

## Koreksi terhadap spec

Spec menulis tes `pairing.rs` dijalankan "lawan `testserver.rs` yang sudah ada". Itu keliru: `core/src/testserver.rs` adalah **server FTP** (libunftp), dipakai tes `transfer` dan `pipeline`. Untuk HTTP, crate `core` sudah punya **`mockito 1.7.2`** di `[dev-dependencies]`, dan itulah yang dipakai `core/src/api.rs` (lihat `api.rs:174`). Rencana ini memakai mockito. Tidak ada dependensi tes baru yang perlu ditambahkan.

---

### Task 1: Model `DevicePairing` dan aturannya

**Files:**
- Modify: `nerona-web/prisma/schema.prisma`
- Create: `nerona-web/prisma/migrations/20260806000000_add_device_pairings/migration.sql`
- Create: `nerona-web/src/lib/device-pairing.ts`
- Test: `nerona-web/tests/lib/device-pairing.test.ts`

**Interfaces:**
- Consumes: `prisma` dari `@/lib/prisma`; `createExtensionToken(userId, label?)` dari `@/lib/extension-auth` (sudah ada, `src/lib/extension-auth.ts:4`).
- Produces:
  ```ts
  export const PAIRING_TTL_MS: number;          // 600_000
  export function makeCode(): string;            // 8 char, tanpa tanda hubung
  export function formatCode(code: string): string;   // "4KQ97ZTM" -> "4KQ9-7ZTM"
  export function normalizeCode(input: string): string; // buang "-", huruf besar
  export type StartResult = { code: string; deviceSecret: string; expiresAt: Date };
  export function startPairing(input: { kind: string; label: string }): Promise<StartResult>;
  export type ApproveResult = { ok: true } | { ok: false; reason: "not_found" | "expired" | "already_handled" };
  export function approvePairing(input: { userId: string; code: string; setuju: boolean }): Promise<ApproveResult>;
  export type ClaimResult =
    | { status: "pending" } | { status: "denied" } | { status: "expired" }
    | { status: "approved"; token: string } | { status: "not_found" };
  export function claimPairing(deviceSecret: string): Promise<ClaimResult>;
  ```

- [ ] **Step 1: Tambahkan model ke `prisma/schema.prisma`**

Tempelkan tepat di bawah `model ExtensionToken { ... }` (berakhir di `prisma/schema.prisma:538`):

```prisma
// Pasangan perangkat untuk Nerona Hub. Extension TIDAK memakai tabel ini —
// ia menerima token langsung di halaman nerona-web lewat content script.
//
// `code` dan `deviceSecret` sengaja dua kolom berbeda. Kode itu pendek supaya
// bisa dibaca mata, jadi ia memang bocor — cukup terlihat di layar. Kalau kode
// juga yang menukar token, siapa pun yang mengintip layar bisa mencuri
// sambungannya. Kode hanya MENUNJUK permintaan; deviceSecret yang MENGAMBIL.
model DevicePairing {
  id           String          @id @default(cuid())
  code         String          @unique
  deviceSecret String          @unique
  kind         String
  label        String
  status       String          @default("pending") // pending|approved|claimed|denied
  userId       String?
  user         User?           @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenId      String?
  token        ExtensionToken? @relation(fields: [tokenId], references: [id], onDelete: SetNull)
  createdAt    DateTime        @default(now())
  approvedAt   DateTime?
  expiresAt    DateTime

  @@index([expiresAt])
  @@map("device_pairings")
}
```

Lalu tambahkan relasi balik. Di `model ExtensionToken`, sebelum `@@index([userId])`:

```prisma
  pairings   DevicePairing[]
```

Di `model User`, sebaris dengan relasi lainnya (letakkan setelah relasi `ExtensionToken` yang sudah ada di sana):

```prisma
  devicePairings DevicePairing[]
```

- [ ] **Step 2: Tulis SQL migrasinya**

Buat `prisma/migrations/20260806000000_add_device_pairings/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "device_pairings" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "deviceSecret" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "tokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_pairings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_pairings_code_key" ON "device_pairings"("code");
CREATE UNIQUE INDEX "device_pairings_deviceSecret_key" ON "device_pairings"("deviceSecret");
CREATE INDEX "device_pairings_expiresAt_idx" ON "device_pairings"("expiresAt");

-- AddForeignKey
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_tokenId_fkey"
  FOREIGN KEY ("tokenId") REFERENCES "extension_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Periksa nama tabel `users` cocok dengan `@@map` di `model User` sebelum melanjutkan — buka `prisma/schema.prisma` dan cari `@@map` di model itu. Kalau berbeda, sesuaikan SQL-nya.

- [ ] **Step 3: Jalankan `npx prisma generate`**

Run: `cd nerona-web && npx prisma generate`
Expected: sukses, dan `prisma.devicePairing` tersedia di tipe klien.

Migrasi ke DB **belum** dijalankan di langkah ini — lihat Task 8.

- [ ] **Step 4: Tulis tes yang gagal**

Buat `tests/lib/device-pairing.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devicePairing: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/extension-auth", () => ({ createExtensionToken: vi.fn() }));

import {
  PAIRING_TTL_MS, makeCode, formatCode, normalizeCode,
  startPairing, approvePairing, claimPairing,
} from "@/lib/device-pairing";
import { prisma } from "@/lib/prisma";
import { createExtensionToken } from "@/lib/extension-auth";

beforeEach(() => vi.clearAllMocks());

describe("kode", () => {
  it("8 karakter tanpa huruf yang mudah tertukar", () => {
    for (let i = 0; i < 200; i++) {
      expect(makeCode()).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    }
  });
  it("ditampilkan berkelompok, dibaca kembali apa adanya", () => {
    expect(formatCode("4KQ97ZTM")).toBe("4KQ9-7ZTM");
    expect(normalizeCode(" 4kq9-7ztm ")).toBe("4KQ97ZTM");
  });
});

describe("startPairing", () => {
  it("menyimpan baris pending dengan masa berlaku 10 menit", async () => {
    (prisma.devicePairing.create as any).mockResolvedValue({});
    const before = Date.now();
    const out = await startPairing({ kind: "hub", label: "Nerona Hub · PC" });

    expect(out.code).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    expect(out.deviceSecret).toMatch(/^nrd_[0-9a-f]{64}$/);
    expect(out.expiresAt.getTime()).toBeGreaterThanOrEqual(before + PAIRING_TTL_MS - 5000);

    const arg = (prisma.devicePairing.create as any).mock.calls[0][0];
    expect(arg.data).toMatchObject({ kind: "hub", label: "Nerona Hub · PC", status: "pending" });
  });
});

describe("approvePairing", () => {
  const pending = {
    id: "p1", status: "pending", label: "Nerona Hub · PC",
    expiresAt: new Date(Date.now() + 60_000),
  };

  it("membuat token dan menandai approved", async () => {
    (prisma.devicePairing.findUnique as any).mockResolvedValue(pending);
    (createExtensionToken as any).mockResolvedValue("nrx_abc");
    (prisma.devicePairing.update as any).mockResolvedValue({});

    expect(await approvePairing({ userId: "u1", code: "4kq9-7ztm", setuju: true })).toEqual({ ok: true });
    expect(createExtensionToken).toHaveBeenCalledWith("u1", "Nerona Hub · PC");
    expect((prisma.devicePairing.findUnique as any).mock.calls[0][0].where).toEqual({ code: "4KQ97ZTM" });
  });

  it("menolak tanpa membuat token", async () => {
    (prisma.devicePairing.findUnique as any).mockResolvedValue(pending);
    (prisma.devicePairing.update as any).mockResolvedValue({});
    expect(await approvePairing({ userId: "u1", code: "4KQ97ZTM", setuju: false })).toEqual({ ok: true });
    expect(createExtensionToken).not.toHaveBeenCalled();
  });

  it("menolak kode kadaluarsa", async () => {
    (prisma.devicePairing.findUnique as any).mockResolvedValue({
      ...pending, expiresAt: new Date(Date.now() - 1000),
    });
    expect(await approvePairing({ userId: "u1", code: "4KQ97ZTM", setuju: true }))
      .toEqual({ ok: false, reason: "expired" });
    expect(createExtensionToken).not.toHaveBeenCalled();
  });

  it("menolak kode yang sudah ditangani", async () => {
    (prisma.devicePairing.findUnique as any).mockResolvedValue({ ...pending, status: "approved" });
    expect(await approvePairing({ userId: "u1", code: "4KQ97ZTM", setuju: true }))
      .toEqual({ ok: false, reason: "already_handled" });
  });

  it("menolak kode yang tidak ada", async () => {
    (prisma.devicePairing.findUnique as any).mockResolvedValue(null);
    expect(await approvePairing({ userId: "u1", code: "ZZZZZZZZ", setuju: true }))
      .toEqual({ ok: false, reason: "not_found" });
  });
});

describe("claimPairing", () => {
  it("menyerahkan token tepat sekali", async () => {
    (prisma.devicePairing.updateMany as any).mockResolvedValueOnce({ count: 1 });
    (prisma.devicePairing.findUnique as any).mockResolvedValue({
      status: "claimed", token: { token: "nrx_abc" },
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await claimPairing("nrd_x")).toEqual({ status: "approved", token: "nrx_abc" });

    // Klaim kedua: updateMany tidak lagi menemukan baris berstatus approved.
    (prisma.devicePairing.updateMany as any).mockResolvedValueOnce({ count: 0 });
    expect(await claimPairing("nrd_x")).toEqual({ status: "pending" });
  });

  it("melaporkan pending, denied, dan kadaluarsa", async () => {
    (prisma.devicePairing.updateMany as any).mockResolvedValue({ count: 0 });

    (prisma.devicePairing.findUnique as any).mockResolvedValueOnce({
      status: "pending", token: null, expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await claimPairing("nrd_x")).toEqual({ status: "pending" });

    (prisma.devicePairing.findUnique as any).mockResolvedValueOnce({
      status: "denied", token: null, expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await claimPairing("nrd_x")).toEqual({ status: "denied" });

    (prisma.devicePairing.findUnique as any).mockResolvedValueOnce({
      status: "pending", token: null, expiresAt: new Date(Date.now() - 1000),
    });
    expect(await claimPairing("nrd_x")).toEqual({ status: "expired" });
  });

  it("melaporkan not_found untuk deviceSecret asing", async () => {
    (prisma.devicePairing.updateMany as any).mockResolvedValue({ count: 0 });
    (prisma.devicePairing.findUnique as any).mockResolvedValue(null);
    expect(await claimPairing("nrd_asing")).toEqual({ status: "not_found" });
  });
});
```

- [ ] **Step 5: Jalankan tes dan pastikan GAGAL**

Run: `cd nerona-web && npx vitest run tests/lib/device-pairing.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/device-pairing"`.

- [ ] **Step 6: Tulis `src/lib/device-pairing.ts`**

```ts
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { createExtensionToken } from "@/lib/extension-auth";

export const PAIRING_TTL_MS = 10 * 60 * 1000;

// Base32 tanpa 0 O 1 I L: kode ini dibaca mata lalu dicocokkan dengan layar
// lain, jadi setiap pasang huruf yang mirip adalah kegagalan pencocokan.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function makeCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalizeCode(input: string): string {
  return input.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

export type StartResult = { code: string; deviceSecret: string; expiresAt: Date };

export async function startPairing(input: { kind: string; label: string }): Promise<StartResult> {
  const code = makeCode();
  const deviceSecret = `nrd_${randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  await prisma.devicePairing.create({
    data: { code, deviceSecret, kind: input.kind, label: input.label, status: "pending", expiresAt },
  });
  return { code, deviceSecret, expiresAt };
}

export type ApproveResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "already_handled" };

export async function approvePairing(input: {
  userId: string;
  code: string;
  setuju: boolean;
}): Promise<ApproveResult> {
  const code = normalizeCode(input.code);
  const row = await prisma.devicePairing.findUnique({ where: { code } });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status !== "pending") return { ok: false, reason: "already_handled" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };

  if (!input.setuju) {
    await prisma.devicePairing.update({ where: { id: row.id }, data: { status: "denied" } });
    return { ok: true };
  }

  const token = await createExtensionToken(input.userId, row.label);
  const created = await prisma.extensionToken.findUnique({ where: { token }, select: { id: true } });
  await prisma.devicePairing.update({
    where: { id: row.id },
    data: { status: "approved", userId: input.userId, tokenId: created?.id ?? null, approvedAt: new Date() },
  });
  return { ok: true };
}

export type ClaimResult =
  | { status: "pending" }
  | { status: "denied" }
  | { status: "expired" }
  | { status: "approved"; token: string }
  | { status: "not_found" };

/**
 * Menyerahkan token TEPAT SEKALI.
 *
 * `updateMany` dengan penjaga `status: "approved"` adalah operasi tunggal di
 * basis data, jadi dua klaim bersamaan hanya membuat salah satunya mendapat
 * `count === 1`. Tanpa penjaga itu, balasan poll yang terekam bisa diputar
 * ulang untuk mengambil token yang sama.
 */
export async function claimPairing(deviceSecret: string): Promise<ClaimResult> {
  const claimed = await prisma.devicePairing.updateMany({
    where: { deviceSecret, status: "approved" },
    data: { status: "claimed" },
  });

  const row = await prisma.devicePairing.findUnique({
    where: { deviceSecret },
    include: { token: { select: { token: true } } },
  });
  if (!row) return { status: "not_found" };

  if (claimed.count === 1) {
    if (!row.token) return { status: "expired" };
    return { status: "approved", token: row.token.token };
  }

  if (row.status === "denied") return { status: "denied" };
  if (row.status === "pending" && row.expiresAt.getTime() <= Date.now()) return { status: "expired" };
  return { status: "pending" };
}
```

Catatan untuk pelaksana: `createExtensionToken` mengembalikan string tokennya, bukan barisnya, jadi `tokenId` dicari dengan satu `findUnique` sesudahnya. Jangan ubah tanda tangan `createExtensionToken` — ia dipakai `ExtensionConnectPanel` dan rute token yang sudah ada.

- [ ] **Step 7: Jalankan tes dan pastikan LULUS**

Run: `cd nerona-web && npx vitest run tests/lib/device-pairing.test.ts`
Expected: PASS, semua kasus.

- [ ] **Step 8: Jalankan seluruh suite**

Run: `cd nerona-web && npm test`
Expected: PASS. Kalau ada yang gagal, itu regresi dari perubahan schema — perbaiki sebelum commit.

- [ ] **Step 9: Commit**

```bash
cd nerona-web
git add prisma/schema.prisma prisma/migrations/20260806000000_add_device_pairings src/lib/device-pairing.ts tests/lib/device-pairing.test.ts
git commit -m "feat(pair): model DevicePairing dan aturan pasangannya"
```

---

### Task 2: Tiga endpoint `pair/*`

**Files:**
- Create: `nerona-web/src/app/api/extension/pair/start/route.ts`
- Create: `nerona-web/src/app/api/extension/pair/poll/route.ts`
- Create: `nerona-web/src/app/api/extension/pair/approve/route.ts`
- Test: `nerona-web/tests/lib/pair-routes.test.ts`

**Interfaces:**
- Consumes: `startPairing`, `approvePairing`, `claimPairing`, `formatCode`, `PAIRING_TTL_MS` dari Task 1; `limitByIp`, `RATE_LIMITS`, `tooManyRequests`, `hit` dari `@/lib/rate-limit`; `getServerSession` + `authOptions`; `baseUrl()` dari `@/lib/base-url`.
- Produces: kontrak HTTP yang dipakai Task 3 dan Task 6.
  - `POST /api/extension/pair/start` → `{ ok: true, code, deviceSecret, approveUrl, expiresInSec }`
  - `GET /api/extension/pair/poll` → `{ ok: true, status: "pending"|"denied"|"expired"|"approved", token? }`
  - `POST /api/extension/pair/approve` → `{ ok: true }` / `{ ok: false, reason }`

- [ ] **Step 1: Periksa nama ekspor `@/lib/base-url`**

Run: `cd nerona-web && grep -n "export" src/lib/base-url.ts`
Catat nama fungsinya. Kalau namanya bukan `baseUrl`, pakai nama yang sebenarnya di seluruh Task 2 dan Task 3.

- [ ] **Step 2: Tulis tes yang gagal**

Buat `tests/lib/pair-routes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/device-pairing", () => ({
  startPairing: vi.fn(),
  approvePairing: vi.fn(),
  claimPairing: vi.fn(),
  formatCode: (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`,
  PAIRING_TTL_MS: 600000,
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { POST as START } from "@/app/api/extension/pair/start/route";
import { GET as POLL } from "@/app/api/extension/pair/poll/route";
import { POST as APPROVE } from "@/app/api/extension/pair/approve/route";
import { startPairing, approvePairing, claimPairing } from "@/lib/device-pairing";
import { getServerSession } from "next-auth";

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
function get(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

// IP diacak per tes supaya pembatas laju di dalam proses tidak bocor antar tes.
let ipCounter = 0;
const freshIp = () => ({ "x-forwarded-for": `10.0.0.${++ipCounter}` });

beforeEach(() => vi.clearAllMocks());

describe("POST /api/extension/pair/start", () => {
  it("mengembalikan kode terformat, deviceSecret, dan approveUrl", async () => {
    (startPairing as any).mockResolvedValue({
      code: "4KQ97ZTM", deviceSecret: "nrd_x", expiresAt: new Date(Date.now() + 600000),
    });
    const res = await START(post("http://t/api/extension/pair/start",
      { kind: "hub", label: "Nerona Hub · PC" }, freshIp()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe("4KQ9-7ZTM");
    expect(body.deviceSecret).toBe("nrd_x");
    expect(body.approveUrl).toContain("/hubungkan?kode=4KQ9-7ZTM");
    expect(body.expiresInSec).toBeGreaterThan(500);
  });

  it("menolak kind yang tidak dikenal", async () => {
    const res = await START(post("http://t/api/extension/pair/start",
      { kind: "aneh", label: "x" }, freshIp()));
    expect(res.status).toBe(400);
    expect(startPairing).not.toHaveBeenCalled();
  });

  it("429 setelah melewati batas laju", async () => {
    (startPairing as any).mockResolvedValue({
      code: "4KQ97ZTM", deviceSecret: "nrd_x", expiresAt: new Date(Date.now() + 600000),
    });
    const ip = freshIp();
    const kirim = () => START(post("http://t/api/extension/pair/start", { kind: "hub", label: "x" }, ip));
    for (let i = 0; i < 5; i++) expect((await kirim()).status).toBe(200);
    expect((await kirim()).status).toBe(429);
  });
});

describe("GET /api/extension/pair/poll", () => {
  it("401 tanpa bearer", async () => {
    expect((await POLL(get("http://t/api/extension/pair/poll"))).status).toBe(401);
  });
  it("404 untuk deviceSecret asing", async () => {
    (claimPairing as any).mockResolvedValue({ status: "not_found" });
    const res = await POLL(get("http://t/api/extension/pair/poll", { authorization: "Bearer nrd_asing" }));
    expect(res.status).toBe(404);
  });
  it("meneruskan token saat disetujui", async () => {
    (claimPairing as any).mockResolvedValue({ status: "approved", token: "nrx_abc" });
    const res = await POLL(get("http://t/api/extension/pair/poll", { authorization: "Bearer nrd_x" }));
    expect(await res.json()).toEqual({ ok: true, status: "approved", token: "nrx_abc" });
  });
  it("meneruskan pending tanpa token", async () => {
    (claimPairing as any).mockResolvedValue({ status: "pending" });
    expect(await (await POLL(get("http://t/api/extension/pair/poll",
      { authorization: "Bearer nrd_x" }))).json()).toEqual({ ok: true, status: "pending" });
  });
});

describe("POST /api/extension/pair/approve", () => {
  it("401 tanpa sesi", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await APPROVE(post("http://t/api/extension/pair/approve",
      { code: "4KQ9-7ZTM", setuju: true }, freshIp()));
    expect(res.status).toBe(401);
    expect(approvePairing).not.toHaveBeenCalled();
  });
  it("meneruskan userId sesi, bukan dari body", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1" } });
    (approvePairing as any).mockResolvedValue({ ok: true });
    const res = await APPROVE(post("http://t/api/extension/pair/approve",
      { code: "4KQ9-7ZTM", setuju: true, userId: "u-penyerang" }, freshIp()));
    expect(res.status).toBe(200);
    expect(approvePairing).toHaveBeenCalledWith({ userId: "u1", code: "4KQ9-7ZTM", setuju: true });
  });
  it("410 untuk kode kadaluarsa", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1" } });
    (approvePairing as any).mockResolvedValue({ ok: false, reason: "expired" });
    const res = await APPROVE(post("http://t/api/extension/pair/approve",
      { code: "4KQ9-7ZTM", setuju: true }, freshIp()));
    expect(res.status).toBe(410);
    expect((await res.json()).reason).toBe("expired");
  });
});
```

- [ ] **Step 3: Jalankan tes dan pastikan GAGAL**

Run: `cd nerona-web && npx vitest run tests/lib/pair-routes.test.ts`
Expected: FAIL — ketiga modul rute belum ada.

- [ ] **Step 4: Tulis `pair/start/route.ts`**

```ts
import { NextResponse } from "next/server";
import { startPairing, formatCode } from "@/lib/device-pairing";
import { limitByIp, tooManyRequests, RATE_LIMITS } from "@/lib/rate-limit";
import { baseUrl } from "@/lib/base-url";

// Satu-satunya endpoint pasangan yang tanpa auth, jadi batas laju di sini
// bukan hiasan: tanpanya siapa pun bisa membanjiri tabel device_pairings.
export async function POST(request: Request) {
  const limited = limitByIp(request, "pair-start", RATE_LIMITS.accountAction);
  if (limited) {
    const { body, init } = tooManyRequests(limited, "Terlalu sering. Coba lagi sebentar.");
    return NextResponse.json(body, init);
  }

  const payload = await request.json().catch(() => ({}));
  const kind = typeof payload?.kind === "string" ? payload.kind : "";
  if (kind !== "hub") {
    return NextResponse.json({ ok: false, reason: "invalid_kind" }, { status: 400 });
  }
  const label = (typeof payload?.label === "string" ? payload.label : "").trim().slice(0, 80)
    || "Perangkat tanpa nama";

  const { code, deviceSecret, expiresAt } = await startPairing({ kind, label });
  const tampil = formatCode(code);
  return NextResponse.json({
    ok: true,
    code: tampil,
    deviceSecret,
    approveUrl: `${baseUrl()}/hubungkan?kode=${tampil}`,
    expiresInSec: Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000)),
  });
}
```

- [ ] **Step 5: Tulis `pair/poll/route.ts`**

```ts
import { NextResponse } from "next/server";
import { claimPairing } from "@/lib/device-pairing";

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function GET(request: Request) {
  const secret = bearerToken(request);
  if (!secret) return NextResponse.json({ ok: false }, { status: 401 });

  const result = await claimPairing(secret);
  if (result.status === "not_found") {
    return NextResponse.json({ ok: false, status: "not_found" }, { status: 404 });
  }
  if (result.status === "approved") {
    return NextResponse.json({ ok: true, status: "approved", token: result.token });
  }
  return NextResponse.json({ ok: true, status: result.status });
}
```

- [ ] **Step 6: Tulis `pair/approve/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { approvePairing } from "@/lib/device-pairing";
import { hit, tooManyRequests, RATE_LIMITS } from "@/lib/rate-limit";

const STATUS: Record<string, number> = { not_found: 404, expired: 410, already_handled: 409 };

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  const limited = hit(
    `pair-approve:${session.user.id}`,
    RATE_LIMITS.accountAction.limit,
    RATE_LIMITS.accountAction.windowMs
  );
  if (!limited.ok) {
    const { body, init } = tooManyRequests(limited, "Terlalu sering. Coba lagi sebentar.");
    return NextResponse.json(body, init);
  }

  const payload = await request.json().catch(() => ({}));
  const code = typeof payload?.code === "string" ? payload.code : "";
  const setuju = payload?.setuju === true;
  if (!code) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  // userId SELALU dari sesi. Body tidak pernah dipercaya menentukan siapa
  // pemilik token yang akan dibuat.
  const result = await approvePairing({ userId: session.user.id, code, setuju });
  if (result.ok) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false, reason: result.reason }, { status: STATUS[result.reason] ?? 400 });
}
```

- [ ] **Step 7: Jalankan tes dan pastikan LULUS**

Run: `cd nerona-web && npx vitest run tests/lib/pair-routes.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd nerona-web
git add src/app/api/extension/pair tests/lib/pair-routes.test.ts
git commit -m "feat(pair): endpoint start, poll, dan approve"
```

---

### Task 3: Halaman persetujuan `/hubungkan`

**Files:**
- Create: `nerona-web/src/app/(app)/hubungkan/page.tsx`
- Create: `nerona-web/src/app/(app)/hubungkan/FormPersetujuan.tsx`

**Interfaces:**
- Consumes: `requireUser()` dari `@/lib/session-guards` (`src/lib/session-guards.ts:7`); endpoint `POST /api/extension/pair/approve` dari Task 2.
- Produces: URL `/hubungkan?kode=XXXX-XXXX` yang dirujuk `approveUrl` di Task 2 dan dibuka Hub di Task 7.

- [ ] **Step 1: Tulis `page.tsx`**

```tsx
import { requireUser } from "@/lib/session-guards";
import { FormPersetujuan } from "./FormPersetujuan";

export const metadata = { title: "Hubungkan perangkat — Nerona" };

export default async function HubungkanPage({
  searchParams,
}: {
  searchParams: Promise<{ kode?: string }>;
}) {
  // requireUser mengalihkan ke login dengan callbackUrl, jadi pengguna yang
  // belum login kembali ke halaman ini lengkap dengan kodenya.
  await requireUser();
  const { kode } = await searchParams;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold text-ink">Hubungkan perangkat</h1>
      <p className="mt-2 text-sm text-muted">
        Cocokkan kode di bawah ini dengan yang tampil di layar Nerona Hub.
      </p>
      <div className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
        <FormPersetujuan kodeAwal={kode ?? ""} />
      </div>
      <p className="mt-4 rounded-2xl bg-rose-500/10 p-4 text-sm text-ink ring-1 ring-rose-500/30">
        Kalau kamu tidak sedang membuka Nerona Hub, jangan setujui. Menyetujui berarti
        memberi perangkat itu akses penuh ke akun dan poinmu.
      </p>
    </div>
  );
}
```

Sebelum menulis, periksa apakah `searchParams` di versi Next repo ini berupa `Promise` — buka satu halaman lain yang memakainya (`grep -rn "searchParams" src/app | head -3`) dan ikuti bentuk yang sama. Kalau bukan Promise, hapus `await` dan ubah tipenya.

- [ ] **Step 2: Tulis `FormPersetujuan.tsx`**

```tsx
"use client";

import { useState } from "react";

const PESAN: Record<string, string> = {
  not_found: "Kode tidak dikenal. Periksa lagi kode yang tampil di Nerona Hub.",
  expired: "Kode sudah kedaluwarsa. Klik Hubungkan akun lagi di Nerona Hub untuk kode baru.",
  already_handled: "Kode ini sudah dipakai. Minta kode baru dari Nerona Hub.",
};

export function FormPersetujuan({ kodeAwal }: { kodeAwal: string }) {
  const [kode, setKode] = useState(kodeAwal);
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<"" | "disetujui" | "ditolak">("");
  const [galat, setGalat] = useState("");

  async function kirim(setuju: boolean) {
    setGalat("");
    setSibuk(true);
    const res = await fetch("/api/extension/pair/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: kode, setuju }),
    });
    const data = await res.json().catch(() => null);
    setSibuk(false);
    if (!res.ok || !data?.ok) {
      setGalat(PESAN[data?.reason] || "Gagal memproses kode. Coba lagi.");
      return;
    }
    setHasil(setuju ? "disetujui" : "ditolak");
  }

  if (hasil === "disetujui") {
    return (
      <p className="text-sm text-ink">
        ✓ Tersambung. Kembali ke Nerona Hub — layarnya akan berubah sendiri dalam
        beberapa detik. Tab ini boleh ditutup.
      </p>
    );
  }
  if (hasil === "ditolak") {
    return <p className="text-sm text-ink">Permintaan ditolak. Tidak ada akses yang diberikan.</p>;
  }

  return (
    <>
      <label htmlFor="kode" className="text-xs font-semibold text-muted">
        Kode dari Nerona Hub
      </label>
      <input
        id="kode"
        value={kode}
        onChange={(e) => setKode(e.target.value)}
        placeholder="4KQ9-7ZTM"
        autoComplete="off"
        className="mt-1 w-full rounded-2xl bg-navy-900/[0.03] px-4 py-3 text-center text-2xl font-semibold tracking-[0.3em] text-ink ring-1 ring-navy-900/10"
      />
      {galat && <p className="mt-3 text-sm text-rose-500">{galat}</p>}
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => kirim(true)}
          disabled={sibuk || !kode.trim()}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-5 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {sibuk ? "Memproses..." : "Setujui"}
        </button>
        <button
          onClick={() => kirim(false)}
          disabled={sibuk || !kode.trim()}
          className="rounded-full bg-navy-900/5 px-5 py-2 text-sm font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-50"
        >
          Tolak
        </button>
      </div>
    </>
  );
}
```

Kolomnya tetap bisa diedit walau kode sudah terisi dari URL — itu jalan keluar kalau pengguna membuka halaman ini sendiri tanpa lewat tombol Hub.

- [ ] **Step 3: Periksa halaman merender**

Run: `cd nerona-web && npx tsc --noEmit`
Expected: bersih. Kalau `searchParams` bertipe salah, di sinilah ketahuan.

- [ ] **Step 4: Jalankan seluruh suite**

Run: `cd nerona-web && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd nerona-web
git add "src/app/(app)/hubungkan"
git commit -m "feat(pair): halaman persetujuan /hubungkan"
```

---

### Task 4: Dasbor jadi "Perangkat terhubung"

**Files:**
- Modify: `nerona-web/src/components/account/ExtensionConnectPanel.tsx` (ditulis ulang penuh)
- Test: `nerona-web/tests/lib/extension-tokens-route.test.ts` (sudah ada — periksa masih lulus)

**Interfaces:**
- Consumes: `GET`/`POST /api/extension/tokens` dan `DELETE /api/extension/tokens/[id]` (semuanya sudah ada).
- Produces: protokol `window.postMessage` yang diikuti Task 5:
  - Dasbor mendengar `{ source: "nerona-ext", type: "HADIR", version }`
  - Dasbor mengirim `{ source: "nerona-web", type: "TOKEN", token }`
  - Dasbor mendengar `{ source: "nerona-ext", type: "TERSAMBUNG", email }` atau `{ source: "nerona-ext", type: "GAGAL", pesan }`

- [ ] **Step 1: Tulis ulang `ExtensionConnectPanel.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

interface TokenRow {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * Extension mengumumkan dirinya lewat postMessage saat halaman ini dimuat.
 * Sebelum ini dasbor cuma bisa MENEBAK apakah extension terpasang, jadi
 * panduan pemasangan selalu tampil penuh bahkan untuk yang sudah terpasang —
 * dan token yang dibuat tapi tak pernah ditempel tidak terdeteksi siapa pun.
 */
export function ExtensionConnectPanel() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [extVersion, setExtVersion] = useState<string | null>(null);
  const [emailTersambung, setEmailTersambung] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [created, setCreated] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/extension/tokens");
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) setTokens(data.tokens);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.source !== "nerona-ext") return;

      if (data.type === "HADIR") setExtVersion(String(data.version || "?"));
      if (data.type === "TERSAMBUNG") {
        setEmailTersambung(String(data.email || ""));
        setSibuk(false);
        setError("");
        load();
      }
      if (data.type === "GAGAL") {
        setSibuk(false);
        setError(String(data.pesan || "Extension menolak token."));
      }
    }
    window.addEventListener("message", onMessage);
    // Extension mungkin sudah mengumumkan diri sebelum React memasang
    // pendengarnya. Satu sapaan balik memaksanya mengumumkan ulang.
    window.postMessage({ source: "nerona-web", type: "HALO" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [load]);

  async function hubungkanExtension() {
    setError("");
    setSibuk(true);
    const res = await fetch("/api/extension/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: `Extension · ${namaBrowser()}` }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setSibuk(false);
      setError("Gagal membuat token. Muat ulang halaman lalu coba lagi.");
      return;
    }
    // Extension membalas TERSAMBUNG / GAGAL; `sibuk` dimatikan di sana.
    window.postMessage(
      { source: "nerona-web", type: "TOKEN", token: data.token },
      window.location.origin
    );
  }

  async function createToken() {
    setError("");
    const res = await fetch("/api/extension/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Token manual" }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError("Gagal membuat token.");
      return;
    }
    setCreated(data.token);
    load();
  }

  async function revoke(id: string) {
    setError("");
    const res = await fetch(`/api/extension/tokens/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Gagal memutuskan perangkat. Muat ulang halaman lalu coba lagi.");
      return;
    }
    setTokens((prev) => prev.filter((t) => t.id !== id));
  }

  const sudahTersambung = Boolean(emailTersambung);

  return (
    <div className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <h2 className="text-lg font-semibold text-ink">Perangkat terhubung</h2>

      {/*
        Extension Nerona Metadata tidak ada di Chrome Web Store, jadi
        pemasangannya lewat "Muat yang belum dikemas" dan TIDAK ADA pembaruan
        otomatis. ZIP di /public dibangun dari repo nerona_medata lewat
        scripts/build-extension.ps1 dan ikut ter-commit — kalau extension
        berubah tanpa skrip itu dijalankan, user mengunduh versi lama tanpa
        tanda apa pun.
      */}
      {!extVersion && (
        <div className="mt-4 rounded-2xl bg-navy-900/[0.03] p-4 ring-1 ring-navy-900/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">1. Unduh extension</p>
              <p className="mt-0.5 text-xs text-muted">
                Simpan lalu ekstrak — foldernya jangan dihapus, Chrome memuatnya langsung dari situ.
              </p>
            </div>
            <a
              href="/nerona-metadata.zip"
              download
              className="whitespace-nowrap rounded-full bg-navy-900/5 px-4 py-2 text-sm font-semibold text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
            >
              Unduh ZIP
            </a>
          </div>
          <p className="mt-4 text-sm font-semibold text-ink">2. Pasang di Chrome</p>
          <ol className="mt-1 list-inside list-decimal space-y-1 text-xs text-muted">
            <li>
              Ekstrak ZIP-nya. Isinya satu folder bernama <code>nerona-metadata</code> — taruh di
              tempat yang tidak akan dipindah, misalnya <code>Documents</code>.
            </li>
            <li>
              Buka <code>chrome://extensions</code>, lalu nyalakan <b>Developer mode</b> di kanan atas.
            </li>
            <li>
              Klik <b>Load unpacked</b> / <b>Muat yang belum dikemas</b>, lalu pilih folder{" "}
              <code>nerona-metadata</code> itu.
            </li>
            <li>Kembali ke halaman ini lalu muat ulang — tombol Hubungkan akan menyala.</li>
          </ol>
        </div>
      )}

      {extVersion && !sudahTersambung && (
        <div className="mt-4 rounded-2xl bg-navy-900/[0.03] p-4 ring-1 ring-navy-900/10">
          <p className="text-sm text-ink">✓ Extension terpasang (versi {extVersion}).</p>
          <button
            onClick={hubungkanExtension}
            disabled={sibuk}
            className="mt-3 rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
          >
            {sibuk ? "Menghubungkan..." : "Hubungkan extension"}
          </button>
        </div>
      )}

      {sudahTersambung && (
        <p className="mt-4 rounded-2xl bg-gold-400/15 p-4 text-sm text-ink ring-1 ring-gold-400/40">
          ✓ Extension tersambung sebagai {emailTersambung}.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}

      <ul className="mt-4 divide-y divide-navy-900/10">
        {tokens.length === 0 && (
          <li className="py-2 text-sm text-muted">Belum ada perangkat terhubung.</li>
        )}
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="text-ink">{t.label || "Perangkat"}</p>
              <p className="text-xs text-muted">
                Dibuat {new Date(t.createdAt).toLocaleDateString("id-ID")}
                {t.lastUsedAt
                  ? ` · dipakai ${new Date(t.lastUsedAt).toLocaleDateString("id-ID")}`
                  : " · belum dipakai"}
              </p>
            </div>
            <button
              onClick={() => revoke(t.id)}
              className="rounded-full bg-navy-900/5 px-3 py-1 text-xs font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
            >
              Putuskan
            </button>
          </li>
        ))}
      </ul>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-muted">
          Kalau tombolnya tidak muncul
        </summary>
        <p className="mt-2 text-xs text-muted">
          Buat token manual di bawah, lalu tempel di popup extension (buka bagian
          &quot;Cara lain&quot; di sana). Dipakai juga untuk Nerona Hub kalau halaman
          persetujuannya tidak bisa dibuka.
        </p>
        {created && (
          <div className="mt-3 rounded-2xl bg-gold-400/15 p-4 ring-1 ring-gold-400/40">
            <p className="text-xs font-semibold text-ink">
              Token baru (salin sekarang — tidak ditampilkan lagi):
            </p>
            <code className="mt-1 block break-all text-sm text-ink">{created}</code>
          </div>
        )}
        <button
          onClick={createToken}
          className="mt-3 rounded-full bg-navy-900/5 px-4 py-2 text-xs font-semibold text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
        >
          Buat token manual
        </button>
      </details>
    </div>
  );
}

function namaBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/")) return "Opera";
  if (ua.includes("Chrome/")) return "Chrome";
  return "Browser";
}
```

- [ ] **Step 2: Periksa tipe**

Run: `cd nerona-web && npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 3: Jalankan seluruh suite**

Run: `cd nerona-web && npm test`
Expected: PASS — khususnya `tests/lib/extension-tokens-route.test.ts` dan `tests/lib/extension-connection.test.ts`.

- [ ] **Step 4: Commit**

```bash
cd nerona-web
git add src/components/account/ExtensionConnectPanel.tsx
git commit -m "feat(pair): dasbor jadi Perangkat terhubung dengan tombol satu klik"
```

---

### Task 5: Extension menerima token tanpa ditempel

**Files:**
- Create: `nerona_medata/access/nerona-connect.js`
- Modify: `nerona_medata/manifest.json`
- Modify: `nerona_medata/popup.html`
- Modify: `nerona_medata/popup.js`

**Interfaces:**
- Consumes: protokol postMessage dari Task 4; `NeronaWebClient.setToken/getToken/fetchAccountState` (`access/nerona-web-client.js`); `NeronaAccess.clearAccessCache()` (`access/access.js:52`).
- Produces: —

- [ ] **Step 1: Tulis `access/nerona-connect.js`**

```js
/**
 * Jembatan penyambungan akun — HANYA berjalan di halaman nerona-web.
 *
 * Sengaja BUKAN bagian dari entri content_scripts marketplace: kelima belas
 * skrip marketplace tidak punya urusan berjalan di dasbor kita sendiri, dan
 * menjalankannya di sana cuma menambah permukaan galat.
 *
 * Kenapa postMessage aman di sini: token dilewatkan di halaman yang
 * penggunanya SUDAH login. Siapa pun yang bisa menjalankan skrip di halaman itu
 * sudah memegang cookie sesinya, jadi tidak ada kemampuan baru yang diberikan.
 * Karena itu origin pengirim dikunci — halaman marketplace mana pun tidak boleh
 * ikut bicara.
 */
(function () {
  const ASAL = location.origin;

  function versi() {
    try {
      return chrome.runtime.getManifest().version;
    } catch (_e) {
      return "?";
    }
  }

  function kirim(pesan) {
    window.postMessage({ source: "nerona-ext", ...pesan }, ASAL);
  }

  function umumkan() {
    kirim({ type: "HADIR", version: versi() });
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (event.origin !== ASAL) return;
    const data = event.data;
    if (!data || data.source !== "nerona-web") return;

    // Dasbor menyapa saat pendengarnya siap; kita mungkin sudah mengumumkan
    // diri sebelum React sempat memasangnya.
    if (data.type === "HALO") {
      umumkan();
      return;
    }

    if (data.type !== "TOKEN") return;
    const token = String(data.token || "").trim();
    if (!token) {
      kirim({ type: "GAGAL", pesan: "Token kosong." });
      return;
    }

    try {
      await globalThis.NeronaWebClient.setToken(token);
      await globalThis.NeronaAccess?.clearAccessCache?.();
      const state = await globalThis.NeronaWebClient.fetchAccountState(token);
      if (state?.ok) {
        kirim({ type: "TERSAMBUNG", email: state.email || "" });
      } else {
        kirim({ type: "GAGAL", pesan: "Server menolak token yang baru dibuat." });
      }
    } catch (e) {
      kirim({ type: "GAGAL", pesan: String(e?.message || e) });
    }
  });

  umumkan();
})();
```

- [ ] **Step 2: Tambahkan entri `content_scripts` di `manifest.json`**

Tambahkan objek berikut ke array `content_scripts`, **setelah** entri marketplace yang sudah ada:

```json
    {
      "matches": [
        "https://nerona-web.vercel.app/*",
        "http://localhost:3000/*"
      ],
      "js": [
        "access/access-config.js",
        "access/nerona-web-client.js",
        "access/access.js",
        "access/nerona-connect.js"
      ],
      "run_at": "document_idle"
    }
```

Ketiga berkas pertama ikut karena `nerona-connect.js` memakai `NeronaWebClient` dan `NeronaAccess`. Naikkan juga `"version"` dari `"1.0.1"` menjadi `"1.1.0"` — nomor itulah yang ditampilkan dasbor sebagai bukti extension terpasang.

- [ ] **Step 3: Jalankan gerbang match pattern**

Run: `cd nerona_medata && node scripts/check-match-patterns.js`
Expected: lulus. Skrip ini memastikan setiap URL yang diakui resolver ikut di-inject manifest; menambah pola baru tidak melanggarnya, tapi jalankan untuk memastikan JSON-nya tetap sah.

- [ ] **Step 4: Ubah `popup.html` jadi kartu status**

Ganti blok `<details class="settings access-panel" open>` yang ada dengan:

```html
      <details class="settings access-panel" open>
        <summary>Akun Nerona</summary>
        <p id="accountStatus" class="hint"></p>
        <button id="refreshAccountBtn" type="button">Segarkan</button>
        <button id="forgetTokenBtn" type="button">Putuskan</button>
        <details class="settings">
          <summary>Cara lain</summary>
          <label for="neronaToken">Token akun</label>
          <input id="neronaToken" type="text" placeholder="nrx_..." autocomplete="off" />
          <button id="connectAccountBtn" type="button">Simpan &amp; cek</button>
        </details>
      </details>
```

Ganti juga baris `<p class="hint">Masukkan token akun Nerona…</p>` menjadi:

```html
      <p class="hint">Buka dasbor Nerona lalu klik <b>Hubungkan extension</b>.</p>
```

- [ ] **Step 5: Tambahkan dua tombol ke `popup.js`**

Di bagian deklarasi elemen paling atas, tambahkan:

```js
const refreshAccountBtn = document.getElementById("refreshAccountBtn");
const forgetTokenBtn = document.getElementById("forgetTokenBtn");
```

Lalu tambahkan sebelum blok `document.addEventListener("DOMContentLoaded", ...)`:

```js
// Cache akses berumur 15 menit (cacheTtlMs di access-config.js). Tanpa tombol
// ini, upgrade paket baru terasa sampai seperempat jam kemudian tanpa
// penjelasan apa pun ke pengguna.
refreshAccountBtn?.addEventListener("click", async () => {
  refreshAccountBtn.disabled = true;
  try {
    await NeronaAccess?.clearAccessCache?.();
    const token = await NeronaWebClient.getToken();
    if (!token) {
      setAccountStatus(ACCOUNT_ERROR_MESSAGES.missing_license, "");
      return;
    }
    await refreshAccountStatus(token);
  } finally {
    refreshAccountBtn.disabled = false;
  }
});

forgetTokenBtn?.addEventListener("click", async () => {
  await NeronaWebClient.setToken("");
  await NeronaAccess?.clearAccessCache?.();
  if (neronaTokenEl) neronaTokenEl.value = "";
  setAccountStatus(ACCOUNT_ERROR_MESSAGES.missing_license, "");
  setStatus("Akun diputuskan.");
});
```

- [ ] **Step 6: Muat ulang extension dan uji manual**

1. Buka `chrome://extensions`, klik ⟳ Reload di kartu Nerona Metadata.
2. Jalankan nerona-web lokal: `cd nerona-web && npm run dev`.
3. Ubah `access/access-config.js` → `neronaWebBaseUrl: "http://localhost:3000"`, reload extension lagi.
4. Buka `http://localhost:3000/dashboard` dalam keadaan login.
5. Expected: panduan pemasangan **tidak** tampil, muncul "✓ Extension terpasang (versi 1.1.0)".
6. Klik **Hubungkan extension**. Expected: berubah jadi "✓ Extension tersambung sebagai …", dan daftar perangkat bertambah satu baris berlabel `Extension · Chrome`.
7. Buka popup extension. Expected: menampilkan paket dan poin tanpa pernah menempel apa pun.
8. **Kembalikan `access-config.js` ke `https://nerona-web.vercel.app` sebelum commit.**

- [ ] **Step 7: Commit**

```bash
cd nerona_medata
git add access/nerona-connect.js manifest.json popup.html popup.js
git commit -m "feat: terima token dari dasbor tanpa ditempel"
```

---

### Task 6: `core/src/pairing.rs`

**Files:**
- Create: `nerona-hub/core/src/pairing.rs`
- Modify: `nerona-hub/core/src/lib.rs`

**Interfaces:**
- Consumes: `AppError`/`Result` dari `crate::error` (`core/src/error.rs:6`), termasuk `AppError::from_api_status`.
- Produces:
  ```rust
  pub struct Pasangan { pub code: String, pub device_secret: String,
                        pub approve_url: String, pub expires_in_sec: u64 }
  pub enum Hasil { Disetujui(String), Ditolak, Kadaluarsa, WaktuHabis }
  pub async fn mulai(base_url: &str, kind: &str, label: &str) -> Result<Pasangan>
  pub async fn tunggu(base_url: &str, device_secret: &str,
                      jeda: Duration, batas: Duration) -> Result<Hasil>
  ```

- [ ] **Step 1: Daftarkan modul di `core/src/lib.rs`**

Tambahkan sebaris dengan deklarasi modul lain:

```rust
pub mod pairing;
```

- [ ] **Step 2: Tulis `core/src/pairing.rs` beserta tesnya**

`jeda` dan `batas` sengaja jadi parameter, bukan konstanta. Tanpa itu tesnya harus menunggu lima menit sungguhan.

```rust
//! Kode pasangan perangkat: cara Hub mendapat token tanpa pengguna menempel
//! apa pun.
//!
//! `code` yang dilihat pengguna TIDAK dipakai untuk menukar token —
//! `device_secret` yang dipakai. Kode itu pendek supaya bisa dibaca mata, jadi
//! ia memang bocor; kalau ia juga yang menukar token, siapa pun yang mengintip
//! layar bisa mencuri sambungannya.

use crate::error::{AppError, Result};
use serde::Deserialize;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct Pasangan {
    pub code: String,
    pub device_secret: String,
    pub approve_url: String,
    pub expires_in_sec: u64,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Hasil {
    Disetujui(String),
    Ditolak,
    Kadaluarsa,
    WaktuHabis,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MulaiResp {
    code: String,
    device_secret: String,
    approve_url: String,
    expires_in_sec: u64,
}

#[derive(Deserialize)]
struct PollResp {
    status: String,
    token: Option<String>,
}

fn klien() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .unwrap_or_default()
}

pub async fn mulai(base_url: &str, kind: &str, label: &str) -> Result<Pasangan> {
    let base = base_url.trim_end_matches('/');
    let resp = klien()
        .post(format!("{base}/api/extension/pair/start"))
        .json(&serde_json::json!({ "kind": kind, "label": label }))
        .send()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;
    if !resp.status().is_success() {
        return Err(AppError::from_api_status(resp.status().as_u16()));
    }
    let body: MulaiResp = resp
        .json()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;
    Ok(Pasangan {
        code: body.code,
        device_secret: body.device_secret,
        approve_url: body.approve_url,
        expires_in_sec: body.expires_in_sec,
    })
}

/// Polling sampai server memutuskan, atau sampai `batas` terlampaui.
///
/// Kegagalan jaringan di tengah TIDAK membatalkan pasangan: wifi yang putus
/// dua detik akan memaksa pengguna mengulang seluruh alur, padahal
/// persetujuannya mungkin sudah tercatat di server.
pub async fn tunggu(
    base_url: &str,
    device_secret: &str,
    jeda: Duration,
    batas: Duration,
) -> Result<Hasil> {
    let base = base_url.trim_end_matches('/');
    let url = format!("{base}/api/extension/pair/poll");
    let client = klien();
    let mulai_pada = std::time::Instant::now();

    loop {
        if mulai_pada.elapsed() >= batas {
            return Ok(Hasil::WaktuHabis);
        }

        match client.get(&url).bearer_auth(device_secret).send().await {
            Ok(resp) if resp.status().is_success() => {
                let body: PollResp = resp
                    .json()
                    .await
                    .map_err(|e| AppError::Network(e.to_string()))?;
                match body.status.as_str() {
                    "approved" => {
                        let token = body.token.ok_or_else(|| {
                            AppError::Network("server menjawab approved tanpa token".into())
                        })?;
                        return Ok(Hasil::Disetujui(token));
                    }
                    "denied" => return Ok(Hasil::Ditolak),
                    "expired" => return Ok(Hasil::Kadaluarsa),
                    _ => {}
                }
            }
            // 404 berarti pasangannya tidak dikenal server — mengulang hanya
            // memperpanjang penantian yang tidak akan pernah berakhir.
            Ok(resp) if resp.status().as_u16() == 404 => return Ok(Hasil::Kadaluarsa),
            Ok(resp) => return Err(AppError::from_api_status(resp.status().as_u16())),
            Err(_) => { /* blip jaringan: coba lagi di putaran berikutnya */ }
        }

        tokio::time::sleep(jeda).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CEPAT: Duration = Duration::from_millis(10);

    #[tokio::test]
    async fn mulai_membaca_kode_dan_rahasia() {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("POST", "/api/extension/pair/start")
            .with_status(200)
            .with_body(
                r#"{"ok":true,"code":"4KQ9-7ZTM","deviceSecret":"nrd_x",
                    "approveUrl":"https://w/hubungkan?kode=4KQ9-7ZTM","expiresInSec":600}"#,
            )
            .create_async()
            .await;

        let p = mulai(&server.url(), "hub", "Nerona Hub · PC").await.unwrap();
        assert_eq!(p.code, "4KQ9-7ZTM");
        assert_eq!(p.device_secret, "nrd_x");
        assert_eq!(p.expires_in_sec, 600);
    }

    #[tokio::test]
    async fn tunggu_melewati_pending_lalu_menerima_token() {
        let mut server = mockito::Server::new_async().await;
        let _pending = server
            .mock("GET", "/api/extension/pair/poll")
            .match_header("authorization", "Bearer nrd_x")
            .with_status(200)
            .with_body(r#"{"ok":true,"status":"pending"}"#)
            .expect(2)
            .create_async()
            .await;
        let _ok = server
            .mock("GET", "/api/extension/pair/poll")
            .with_status(200)
            .with_body(r#"{"ok":true,"status":"approved","token":"nrx_abc"}"#)
            .create_async()
            .await;

        let hasil = tunggu(&server.url(), "nrd_x", CEPAT, Duration::from_secs(5))
            .await
            .unwrap();
        assert_eq!(hasil, Hasil::Disetujui("nrx_abc".into()));
    }

    #[tokio::test]
    async fn tunggu_melaporkan_penolakan() {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("GET", "/api/extension/pair/poll")
            .with_status(200)
            .with_body(r#"{"ok":true,"status":"denied"}"#)
            .create_async()
            .await;
        assert_eq!(
            tunggu(&server.url(), "nrd_x", CEPAT, Duration::from_secs(5)).await.unwrap(),
            Hasil::Ditolak
        );
    }

    #[tokio::test]
    async fn tunggu_melaporkan_kadaluarsa() {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("GET", "/api/extension/pair/poll")
            .with_status(200)
            .with_body(r#"{"ok":true,"status":"expired"}"#)
            .create_async()
            .await;
        assert_eq!(
            tunggu(&server.url(), "nrd_x", CEPAT, Duration::from_secs(5)).await.unwrap(),
            Hasil::Kadaluarsa
        );
    }

    #[tokio::test]
    async fn pasangan_tak_dikenal_berhenti_bukan_mengulang() {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("GET", "/api/extension/pair/poll")
            .with_status(404)
            .with_body(r#"{"ok":false,"status":"not_found"}"#)
            .expect(1)
            .create_async()
            .await;
        assert_eq!(
            tunggu(&server.url(), "nrd_asing", CEPAT, Duration::from_secs(5)).await.unwrap(),
            Hasil::Kadaluarsa
        );
    }

    #[tokio::test]
    async fn menyerah_setelah_batas_waktu() {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("GET", "/api/extension/pair/poll")
            .with_status(200)
            .with_body(r#"{"ok":true,"status":"pending"}"#)
            .create_async()
            .await;
        assert_eq!(
            tunggu(&server.url(), "nrd_x", CEPAT, Duration::from_millis(60)).await.unwrap(),
            Hasil::WaktuHabis
        );
    }
}
```

- [ ] **Step 3: Jalankan tes**

Run: `cd nerona-hub && cargo +stable-x86_64-pc-windows-gnu test -p nerona-hub-core pairing`
Expected: 6 tes lulus.

- [ ] **Step 4: Clippy**

Run: `cd nerona-hub && cargo +stable-x86_64-pc-windows-gnu clippy --workspace --all-targets -- -D warnings`
Expected: bersih.

- [ ] **Step 5: Commit**

```bash
cd nerona-hub
git add core/src/pairing.rs core/src/lib.rs
git commit -m "feat(pairing): mesin kode pasangan dengan polling"
```

---

### Task 7: Hub menyambung tanpa tempel

**Files:**
- Modify: `nerona-hub/app/src-tauri/Cargo.toml`
- Modify: `nerona-hub/app/src-tauri/capabilities/default.json`
- Modify: `nerona-hub/app/src-tauri/src/akun.rs`
- Modify: `nerona-hub/app/src-tauri/src/main.rs`
- Modify: `nerona-hub/app/src/layar/Akun.tsx`
- Modify: `nerona-hub/app/src/App.tsx`

**Interfaces:**
- Consumes: `pairing::mulai`, `pairing::tunggu`, `pairing::Hasil` dari Task 6; `creds::save_token` (`core/src/creds.rs:65`); `config::base_url()`; `dari_akun`/`kosong` yang sudah ada di `akun.rs`.
- Produces: perintah Tauri
  - `mulai_pasangan() -> Result<InfoPasangan, String>` dengan `InfoPasangan { kode, approveUrl }`
  - `tunggu_pasangan() -> Result<StatusAkun, String>`
  - `batal_pasangan()`
  - `segarkan_akun() -> Result<StatusAkun, String>`

- [ ] **Step 1: Tambahkan plugin opener**

Di `app/src-tauri/Cargo.toml`, sebaris dengan plugin lain:

```toml
tauri-plugin-opener = "2"
```

Di `app/src-tauri/capabilities/default.json`, tambahkan ke array `permissions`:

```json
    "opener:allow-open-url"
```

Run: `cd nerona-hub && cargo +stable-x86_64-pc-windows-gnu check --workspace`
Expected: kompilasi. **Kalau gagal karena identifier izin tidak dikenal**, jalankan `cargo +stable-x86_64-pc-windows-gnu check` sekali lagi setelah `build.rs` membangkitkan skema, lalu buka `app/src-tauri/gen/schemas/desktop-schema.json` dan cari identifier opener yang benar. `build.rs` memang memvalidasi identifier izin — salah nama gagal di `cargo check`, bukan saat runtime.

Di `app/src-tauri/src/main.rs`, daftarkan pluginnya sebaris dengan plugin lain (`.plugin(tauri_plugin_dialog::init())` dan kawan-kawan):

```rust
        .plugin(tauri_plugin_opener::init())
```

- [ ] **Step 2: Tambahkan perintah ke `akun.rs`**

Tempelkan di akhir `app/src-tauri/src/akun.rs`:

```rust
use nerona_hub_core::pairing;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

/// Penjaganya di Rust, bukan React. `App.tsx` me-render layar secara
/// kondisional, jadi pindah nav meng-unmount `Akun.tsx` — kunci apa pun yang
/// tinggal di state React akan hancur di tengah polling, dan dua pasangan
/// berjalan bersamaan berarti dua token dibuat untuk satu perangkat.
static PASANGAN_AKTIF: AtomicBool = AtomicBool::new(false);
static RAHASIA: Mutex<Option<String>> = Mutex::new(None);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InfoPasangan {
    pub kode: String,
    pub approve_url: String,
}

/// Nama perangkat supaya daftar "Perangkat terhubung" di dasbor bisa dipakai
/// memutuskan mana yang mau dicabut.
///
/// Lewat variabel lingkungan, bukan crate tambahan. Di aplikasi GUI macOS
/// `HOSTNAME` sering tidak terekspor, jadi cadangannya memang akan terpakai —
/// pengguna masih bisa membedakan perangkat dari kolom "dipakai terakhir".
fn nama_perangkat() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "perangkat ini".to_string())
}

#[tauri::command]
pub async fn mulai_pasangan(app: tauri::AppHandle) -> Result<InfoPasangan, String> {
    if PASANGAN_AKTIF.swap(true, Ordering::SeqCst) {
        return Err("Sudah ada permintaan penyambungan yang berjalan. Klik Batal dulu.".into());
    }

    let label = format!("Nerona Hub · {}", nama_perangkat());
    let hasil = pairing::mulai(&config::base_url(), "hub", &label).await;
    let p = match hasil {
        Ok(p) => p,
        Err(e) => {
            PASANGAN_AKTIF.store(false, Ordering::SeqCst);
            return Err(e.user_message());
        }
    };

    *RAHASIA.lock().map_err(|_| "Kunci internal rusak.".to_string())? =
        Some(p.device_secret.clone());

    use tauri_plugin_opener::OpenerExt;
    // Gagal membuka browser bukan alasan membatalkan pasangannya: kodenya
    // sudah tampil di layar dan pengguna bisa membuka alamatnya sendiri.
    let _ = app.opener().open_url(p.approve_url.clone(), None::<&str>);

    Ok(InfoPasangan {
        kode: p.code,
        approve_url: p.approve_url,
    })
}

#[tauri::command]
pub async fn tunggu_pasangan() -> Result<StatusAkun, String> {
    let rahasia = RAHASIA
        .lock()
        .map_err(|_| "Kunci internal rusak.".to_string())?
        .clone()
        .ok_or_else(|| "Belum ada permintaan penyambungan.".to_string())?;

    let hasil = pairing::tunggu(
        &config::base_url(),
        &rahasia,
        Duration::from_secs(2),
        Duration::from_secs(300),
    )
    .await;

    let selesai = || {
        PASANGAN_AKTIF.store(false, Ordering::SeqCst);
        if let Ok(mut g) = RAHASIA.lock() {
            *g = None;
        }
    };

    match hasil {
        Ok(pairing::Hasil::Disetujui(token)) => {
            // Verifikasi LEBIH DULU, simpan kemudian — sama seperti
            // `simpan_token`. Token tersimpan yang ternyata ditolak membuat
            // setiap layar lain gagal dengan pesan yang menunjuk ke tempat
            // yang salah.
            let acc = api::new(&config::base_url(), &token)
                .me()
                .await
                .map_err(|e| {
                    selesai();
                    e.user_message()
                })?;
            creds::save_token(&token).map_err(|e| {
                selesai();
                e.user_message()
            })?;
            selesai();
            Ok(dari_akun(acc))
        }
        Ok(pairing::Hasil::Ditolak) => {
            selesai();
            Err("Permintaan ditolak di browser. Klik Hubungkan akun lagi kalau itu tidak disengaja.".into())
        }
        Ok(pairing::Hasil::Kadaluarsa) => {
            selesai();
            Err("Kode sudah kedaluwarsa. Klik Hubungkan akun untuk kode baru.".into())
        }
        Ok(pairing::Hasil::WaktuHabis) => {
            selesai();
            Err("Belum ada persetujuan setelah 5 menit. Klik Hubungkan akun untuk mencoba lagi.".into())
        }
        Err(e) => {
            selesai();
            Err(e.user_message())
        }
    }
}

#[tauri::command]
pub fn batal_pasangan() {
    PASANGAN_AKTIF.store(false, Ordering::SeqCst);
    if let Ok(mut g) = RAHASIA.lock() {
        *g = None;
    }
}

/// Sama dengan `akun_status`, dinamai terpisah supaya maksud pemanggilnya
/// terbaca di UI: ini tombol Segarkan, bukan pemuatan awal.
#[tauri::command]
pub async fn segarkan_akun() -> Result<StatusAkun, String> {
    akun_status().await
}
```

- [ ] **Step 3: Daftarkan keempat perintah**

Di `app/src-tauri/src/main.rs`, di dalam `tauri::generate_handler![...]`, tambahkan setelah `akun::lupakan_token`:

```rust
            akun::mulai_pasangan,
            akun::tunggu_pasangan,
            akun::batal_pasangan,
            akun::segarkan_akun,
```

- [ ] **Step 4: Periksa kompilasi**

Run: `cd nerona-hub && cargo +stable-x86_64-pc-windows-gnu check --workspace`
Expected: bersih.

Run: `cd nerona-hub && cargo +stable-x86_64-pc-windows-gnu clippy --workspace --all-targets -- -D warnings`
Expected: bersih.

- [ ] **Step 5: Ubah `Akun.tsx`**

Tambahkan tipe dan state di dalam komponen `Akun`:

```tsx
type InfoPasangan = { kode: string; approveUrl: string };

const [pasangan, setPasangan] = useState<InfoPasangan | null>(null);
```

Tambahkan dua fungsi:

```tsx
  async function hubungkan() {
    setSibuk(true);
    setGalat(null);
    try {
      const info = await invoke<InfoPasangan>("mulai_pasangan");
      setPasangan(info);
      // Polling berjalan di Rust; perintah ini baru membalas saat sudah ada
      // keputusan, ditolak, atau lewat 5 menit.
      pakaiStatus(await invoke<StatusAkun>("tunggu_pasangan"));
      setPasangan(null);
    } catch (e) {
      setGalat(String(e));
      setPasangan(null);
    } finally {
      setSibuk(false);
    }
  }

  async function batal() {
    await invoke("batal_pasangan");
    setPasangan(null);
    setSibuk(false);
  }
```

Ganti bagian yang merender formulir tempel-token (saat `status?.adaToken` bernilai false) dengan:

```tsx
      {pasangan ? (
        <div className="kartu">
          <p>Cocokkan kode ini dengan yang muncul di browser, lalu klik Setujui.</p>
          <p className="kode-pasangan">{pasangan.kode}</p>
          <p className="keterangan">Menunggu persetujuan… (batas 5 menit)</p>
          <button onClick={batal}>Batal</button>
          <a href={pasangan.approveUrl} target="_blank" rel="noreferrer">
            Buka lagi halaman persetujuan
          </a>
        </div>
      ) : (
        <button onClick={hubungkan} disabled={sibuk}>
          {sibuk ? "Menyiapkan…" : "Hubungkan akun"}
        </button>
      )}

      <details>
        <summary>Cara lain</summary>
        <p className="keterangan">
          Kalau halaman persetujuan tidak bisa dibuka, buat token manual di dasbor
          Nerona lalu tempel di sini.
        </p>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="nrx_..."
        />
        <button onClick={simpan} disabled={sibuk || !token.trim()}>
          Simpan token
        </button>
      </details>
```

Saat `status?.adaToken` bernilai true, tambahkan tombol Segarkan di dekat tombol "Lupakan token" yang sudah ada:

```tsx
        <button
          onClick={async () => {
            setSibuk(true);
            try {
              pakaiStatus(await invoke<StatusAkun>("segarkan_akun"));
            } catch (e) {
              setGalat(String(e));
            } finally {
              setSibuk(false);
            }
          }}
          disabled={sibuk}
        >
          Segarkan
        </button>
```

Tambahkan gaya kodenya ke `app/src/styles.css`:

```css
.kode-pasangan {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-align: center;
  margin: 0.75rem 0;
}
```

- [ ] **Step 6: Segarkan status saat window difokuskan (`App.tsx`)**

Tambahkan setelah `useEffect` yang memanggil `muatUlang` pertama kali:

```tsx
  // Upgrade paket terbaca sendiri karena `/me` selalu dibaca segar di server.
  // Yang tidak otomatis adalah KAPAN Hub bertanya: tanpa ini, Hub yang
  // dibiarkan terbuka di layar Antrean selama pembelian tidak akan pernah
  // menampilkan marketplace yang baru terbuka sampai aplikasinya ditutup.
  useEffect(() => {
    const onFocus = () => void muatUlang();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [muatUlang]);
```

- [ ] **Step 7: Periksa tipe frontend**

Run: `cd nerona-hub/app && npx tsc --noEmit && npm run build`
Expected: bersih, vite build lolos.

- [ ] **Step 8: Commit**

```bash
cd nerona-hub
git add app/src-tauri/Cargo.toml app/src-tauri/capabilities/default.json app/src-tauri/src/akun.rs app/src-tauri/src/main.rs app/src/layar/Akun.tsx app/src/App.tsx app/src/styles.css Cargo.lock
git commit -m "feat(akun): sambungkan lewat kode pasangan, tanpa tempel token"
```

---

### Task 8: Migrasi, ZIP, dan daftar uji manual

**Files:**
- Modify: `nerona_medata/QA_CHECKLIST.md`
- Modify: `nerona-web/public/nerona-metadata.zip` (dibangun ulang, bukan diedit)

**Interfaces:**
- Consumes: semua task sebelumnya.
- Produces: —

- [ ] **Step 1: Terapkan migrasi ke basis data**

Run: `cd nerona-web && npm run db:migrate`
Expected: `20260806000000_add_device_pairings` diterapkan.

Kalau `.env.local` menunjuk basis data produksi, **berhenti dan konfirmasi ke pemilik dulu** — ini menambah tabel baru, bukan mengubah yang ada, tapi tetap keputusannya.

- [ ] **Step 2: Bangun ulang ZIP extension**

Run: `cd nerona-web && powershell -ExecutionPolicy Bypass -File scripts/build-extension.ps1`
Expected: `public/nerona-metadata.zip` diperbarui.

Skrip itu menurunkan daftar berkasnya dari `manifest.json`, jadi `access/nerona-connect.js` ikut otomatis karena Task 5 mendaftarkannya di `content_scripts`. **Verifikasi**: buka ZIP-nya dan pastikan `nerona-metadata/access/nerona-connect.js` ada di dalamnya. Kalau tidak ada, tombol "Hubungkan extension" tidak akan pernah menyala di mesin pengguna, dan tidak ada tanda apa pun yang menunjukkan sebabnya.

- [ ] **Step 3: Tambahkan langkah uji manual ke `QA_CHECKLIST.md`**

Tambahkan bagian berikut:

```markdown
## Penyambungan akun (tanpa tempel token)

- [ ] Dasbor dibuka tanpa extension terpasang → panduan unduh & pasang tampil
- [ ] Dasbor dibuka dengan extension terpasang → panduan tersembunyi, muncul
      "✓ Extension terpasang (versi X)"
- [ ] Klik "Hubungkan extension" → berubah jadi "tersambung sebagai <email>",
      dan baris "Extension · Chrome" muncul di daftar perangkat
- [ ] Popup extension menampilkan paket & poin tanpa pernah ditempel apa pun
- [ ] Tombol Segarkan di popup memuat ulang saldo (uji dengan mengubah poin di
      admin lalu klik Segarkan — angkanya berubah tanpa menunggu 15 menit)
- [ ] Tombol Putuskan di popup mengosongkan status
- [ ] Klik "Putuskan" di dasbor → extension gagal generate di halaman
      marketplace dengan pesan token ditolak
```

- [ ] **Step 4: Tambahkan uji manual Hub ke `nerona-hub/docs/pemasangan.md`**

Tambahkan di bagian "Untuk pemilik":

```markdown
### Uji penyambungan akun

- [ ] Layar Akun tanpa token → tombol "Hubungkan akun"
- [ ] Klik → browser terbuka ke /hubungkan dengan kode sudah terisi, dan kode
      yang sama terpampang di layar Hub
- [ ] Klik Setujui di browser → layar Hub berubah sendiri dalam <5 detik
- [ ] Baris "Nerona Hub · <NAMA>" muncul di daftar perangkat di dasbor
- [ ] Klik Batal saat menunggu, lalu Hubungkan akun lagi → dapat kode baru
- [ ] Setujui kode yang SUDAH dipakai → browser menampilkan "sudah dipakai"
- [ ] Tunggu >10 menit lalu Setujui → browser menampilkan "kedaluwarsa"
- [ ] Pindah ke layar lain saat menunggu lalu kembali → tidak ada dua
      permintaan berjalan (klik Hubungkan akun lagi harus ditolak dengan pesan)
- [ ] Upgrade paket di admin saat Hub terbuka, lalu klik Segarkan → paket baru
      tampil tanpa menutup aplikasi
```

- [ ] **Step 5: Commit di dua repo**

```bash
cd nerona_medata
git add QA_CHECKLIST.md
git commit -m "docs: langkah uji penyambungan akun"

cd ../nerona-hub
git add docs/pemasangan.md
git commit -m "docs: langkah uji penyambungan akun Hub"

cd ../nerona-web
git add public/nerona-metadata.zip
git commit -m "chore: bangun ulang ZIP extension dengan nerona-connect"
```

---

## Yang tidak bisa diverifikasi agen, dan kenapa

- **`tauri dev` / `tauri build` belum pernah dijalankan di mesin ini** dan `cargo test` tidak bisa menaut di `app/src-tauri`. Jadi Task 7 punya gerbang `cargo check` + `clippy` + `tsc` + `vite build`, tapi **tidak ada bukti aplikasinya berjalan**. Layar Akun yang baru, pembukaan browser, dan seluruh alur pasangan ujung-ke-ujung wajib diuji pemilik lewat Task 8 langkah 4.
- **Tidak ada harness tes frontend** di Hub maupun extension. `nerona-connect.js`, `popup.js`, `Akun.tsx`, dan `ExtensionConnectPanel.tsx` tidak boleh diklaim teruji.
- **Batas laju di `rate-limit.ts` hidup di memori proses** dan tidak dibagi antar instance (`src/lib/rate-limit.ts` baris pembuka). Di Vercel yang serverless, batas laju `pair/start` praktis jauh lebih longgar dari yang tertulis. Itu bukan regresi dari pekerjaan ini — seluruh repo sudah begitu — tapi catat kalau `pair/start` jadi sasaran.

## Tindak lanjut yang sengaja ditunda

1. **Baris ringkasan layar Marketplace Hub** (*"6 dari 8 tercakup · 3 belum ada kredensial"*) plus refresh layar itu saat difokuskan. Keputusan pemilik: dipisah. Pembedaan "tidak termasuk paket Anda" vs "kredensial —" sudah ada (`Marketplace.tsx:320` dan `:337`).
2. **Pembersih baris `device_pairings` kadaluarsa.** Baris pending yang tak pernah disetujui menumpuk selamanya. Tidak mendesak — barisnya kecil dan tidak pernah dibaca setelah kadaluarsa — tapi butuh cron atau pembersihan oportunistik di `startPairing`.
3. **Hashing token di DB.** Token tersimpan plaintext di `extension_tokens`. Mengubahnya membatalkan semua token yang sedang dipakai, jadi butuh rencana migrasinya sendiri.
4. **Nama perangkat di macOS.** `HOSTNAME` sering tidak terekspor ke aplikasi GUI, jadi labelnya jatuh ke "perangkat ini". Perbaikannya butuh crate tambahan; tunggu sampai ada pengguna macOS yang benar-benar punya dua perangkat.
