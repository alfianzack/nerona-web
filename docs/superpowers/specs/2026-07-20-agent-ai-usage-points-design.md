# Nerona Agent — Sistem Poin Pemakaian Model AI (Design Spec)

- **Tanggal:** 2026-07-20
- **Status:** Disetujui untuk implementasi (menunggu review spec)
- **Ruang lingkup:** `nerona-web` — subsistem Nerona Agent

## 1. Tujuan

Mengganti kuota "X pesan/bulan" per paket dengan kuota **"X poin/bulan"** yang reset tiap
awal bulan. Tiap balasan AI memotong poin sesuai **model yang dipilih tenant**. Tenant dapat
memilih model lintas provider (OpenAI, Gemini, MiniMax, Anthropic) dari daftar yang diizinkan
paketnya. Model yang lebih mahal memotong lebih banyak poin.

Tujuan ini menggantikan mekanisme lama (`limits.ts`, hitung jumlah pesan masuk per bulan).

## 2. Kondisi saat ini (yang diubah)

- `AgentProfile.plan` = `"free" | "pro" | "business"` (string, default `"free"`).
- `src/lib/agent/limits.ts` menegakkan batas **jumlah pesan masuk** per bulan
  (`AGENT_PLAN_LIMITS`: free 50, pro 500, business unlimited), dicek di `webhook-handler.ts`
  via `hasExceededMonthlyLimit` (menghitung baris `AgentMessage` `direction:"in"` sejak awal
  bulan).
- Model AI di-set global lewat env `AGENT_MODEL` — semua tenant memakai model sama.
- Konfigurasi paket agent hidup sebagai konstanta kode (`limits.ts`, `admin.ts`), bukan di
  tabel `Plan` (tabel itu milik lisensi extension, domain terpisah).

## 3. Keputusan yang sudah dikunci

| Keputusan | Nilai |
|-----------|-------|
| Basis kuota | Poin per bulan, reset tiap tanggal 1 (kalender) |
| Cara potong poin | Tarif tetap per model |
| Pemilih model | Tenant memilih sendiri di dashboard, dibatasi paketnya |
| Pelacakan | Pendekatan A: jumlahkan poin terpakai bulan ini (tanpa cron refill) |
| Sumber katalog | Statik, konstanta kode (`models.ts`) |
| Aturan akses paket | Plafon poin per model: Free ≤ 2, Pro ≤ 4, Business = semua |
| Jatah poin/bulan | Free 50, Pro 500, Business 1.500 |
| Default `AGENT_MODEL` (env) | Tetap `claude-sonnet-4-6` (hanya fallback; tak dipakai bila profil punya model) |

## 4. Katalog model (`src/lib/agent/models.ts`)

Id model persis seperti di gateway Sumopod.

| id | label | provider | poin |
|----|-------|----------|:---:|
| `gpt-4o-mini` | GPT-4o mini | OpenAI | 1 |
| `gemini/gemini-2.5-flash` | Gemini 2.5 Flash | Gemini | 1 |
| `MiniMax-M3` | MiniMax M3 | MiniMax | 1 |
| `claude-haiku-4-5` | Claude Haiku 4.5 | Anthropic | 2 |
| `gpt-5` | GPT-5 | OpenAI | 3 |
| `claude-sonnet-5` | Claude Sonnet 5 | Anthropic | 4 |
| `gemini/gemini-3.1-pro-preview` | Gemini 3.1 Pro | Gemini | 4 |
| `gpt-5.4` | GPT-5.4 | OpenAI | 6 |
| `claude-opus-4-8` | Claude Opus 4.8 | Anthropic | 10 |

Tarif poin diturunkan proporsional dari harga asli Sumopod (basis ~$0.001 biaya API per poin
untuk balasan tipikal ±1.200 token input + ±150 token output). Menambah model baru = tambah
satu entri di katalog; ia otomatis masuk paket yang plafon poinnya mencukupi.

### Konstanta

```
PLAN_POINT_CEILING   = { free: 2, pro: 4, business: Infinity }
PLAN_MONTHLY_POINTS  = { free: 50, pro: 500, business: 1500 }
DEFAULT_MODEL        = "claude-haiku-4-5"   // 2 poin, diizinkan semua paket
```

### Helper (interface publik `models.ts`)

- `pointCostFor(modelId: string): number` — poin model; melempar error untuk id tak dikenal
  (id tak dikenal tidak boleh diam-diam gratis).
- `isModelAllowedForPlan(plan: string, modelId: string): boolean` — `pointCostFor(modelId) <= ceiling(plan)`.
- `modelsForPlan(plan: string): AgentModel[]` — katalog terfilter untuk dropdown.
- `defaultModelForPlan(plan: string): string` — `DEFAULT_MODEL` (selalu diizinkan semua paket).
- `monthlyPointsFor(plan: string): number | null` — jatah bulanan; `null` = tak terbatas
  (dipertahankan untuk keamanan tipe walau ketiga paket kini berhingga).

Plan tak dikenal → fallback ke nilai `free` (tidak pernah berarti tak terbatas).

## 5. Perubahan data model (Prisma)

```prisma
model AgentProfile {
  // ...
  agentModel String @default("claude-haiku-4-5") // model pilihan tenant (id katalog)
  // ...
}

model AgentMessage {
  // ...
  points Int @default(0) // poin yang dipotong; diisi hanya pada balasan AI (direction "out")
  // ...
}
```

Migrasi: `npm run prisma:migrate -- --name agent_ai_points`.

## 6. Akuntansi poin (Pendekatan A)

Modul: ganti isi `src/lib/agent/limits.ts` (nama file tetap agar impor lain minim berubah).

- `pointsUsedThisMonth(profileId, now = new Date()): Promise<number>` — `prisma.agentMessage.aggregate`
  `_sum.points` untuk `profileId`, `createdAt >= awal bulan`.
- `hasEnoughPoints(profileId, plan, modelCost, now = new Date()): Promise<boolean>` —
  `true` jika `usedThisMonth + modelCost <= monthlyPointsFor(plan)`. Bila jatah `null` →
  selalu `true`.

Karena hanya balasan AI yang menaruh `points > 0`, penjumlahan otomatis mengabaikan pesan
masuk & balasan statis.

## 7. Alur

### Gate (di `webhook-handler.ts`)

Menggantikan blok `hasExceededMonthlyLimit`:

```
const modelCost = pointCostFor(profile.agentModel);
if (!(await hasEnoughPoints(profile.id, profile.plan, modelCost))) {
  await replyStatic(phone, profile.id,
    "Poin AI bulan ini sudah habis. Upgrade paket atau tunggu awal bulan berikutnya.");
  return { status: 200 };
}
```

### Charge (di `process-job.ts`)

- Tentukan model: `const model = profile.agentModel` (fallback `DEFAULT_MODEL` bila kosong).
- Bila `!isModelAllowedForPlan(profile.plan, model)` → pakai `defaultModelForPlan(profile.plan)`
  (jaring pengaman bila tenant turun paket; UI + admin sudah mencegah kondisi ini).
- Panggil `generateReply({ systemPrompt, history, model })`.
- Setelah `sendWhatsAppText` sukses → `logOutbound({ ..., points: pointCostFor(model) })`.
- Poin hanya dipotong pada balasan sukses; retry job yang gagal tidak double-charge.

### `claude-client.ts`

`generateReply` menerima `model?: string` opsional; memakainya sebagai `model` di body request,
fallback ke `process.env.AGENT_MODEL`.

### `messages.ts`

`logOutbound` menerima `points?: number` (default 0), disimpan ke kolom `AgentMessage.points`.

## 8. Pemilihan model oleh tenant

### API baru: `POST /api/agent/model`

- Auth: sesi pemilik (pola sama seperti route agent lain).
- Body: `{ model: string }`.
- Validasi: `isModelAllowedForPlan(profile.plan, model)`. Bila tidak → `403` dengan alasan.
- Sukses: `prisma.agentProfile.update({ agentModel: model })`, kembalikan model baru.

### Route status (`/api/agent/status`) diperluas

Kembalikan juga: `agentModel`, `pointsUsed`, `pointsAllowance` (`monthlyPointsFor(plan)`),
`pointsRemaining`, `availableModels` (`modelsForPlan(plan)` — id, label, provider, poin).

### Dashboard (`/agent`)

- Tampilkan **model aktif**, **meter poin** (terpakai / jatah, sisa).
- **Dropdown pemilih model** berisi `availableModels`; memilih memicu `POST /api/agent/model`.
- Model di luar paket tidak ditampilkan (atau tampil terkunci dengan ajakan upgrade).

## 9. Admin

`activateAgentProfile(userEmail, plan)` (di `admin.ts`): saat paket di-set/diubah, bila
`profile.agentModel` tidak lagi diizinkan paket baru → reset ke `defaultModelForPlan(plan)`.
Mencegah tenant "terjebak" pada model yang tak boleh setelah turun paket.

## 10. Penanganan error

| Kondisi | Perilaku |
|---------|----------|
| Poin bulan ini habis | Balasan statis "poin habis"; job tidak dibuat; tidak memanggil model |
| Tenant pilih model di luar paket | API `403`; dashboard tampilkan alasan/ajakan upgrade |
| `agentModel` tak diizinkan saat proses (turun paket) | Fallback ke `defaultModelForPlan(plan)` |
| Model gateway error / gagal | Jalur retry + permintaan maaf lama tetap berlaku (tak berubah) |

## 11. Ringkasan modul

**Baru**
- `src/lib/agent/models.ts` — katalog + konstanta + helper.
- `src/app/api/agent/model/route.ts` — ganti model tenant.
- `tests/lib/agent/models.test.ts`.

**Diubah**
- `prisma/schema.prisma` — `AgentProfile.agentModel`, `AgentMessage.points`.
- `src/lib/agent/limits.ts` — dari hitung pesan → jumlah poin (`pointsUsedThisMonth`,
  `hasEnoughPoints`).
- `src/lib/agent/claude-client.ts` — `generateReply` menerima `model`.
- `src/lib/agent/messages.ts` — `logOutbound` menerima `points`.
- `src/lib/agent/process-job.ts` — pakai `profile.agentModel`, catat poin.
- `src/lib/agent/webhook-handler.ts` — gate berbasis poin.
- `src/lib/agent/admin.ts` — reset model saat paket berubah.
- `src/app/api/agent/status/route.ts` — kembalikan info poin & model.
- `src/app/agent/page.tsx` (+ komponen dashboard terkait) — meter poin & pemilih model.
- Test terkait: `limits.test.ts`, `messages.test.ts`, `process-job.test.ts`,
  `claude-client.test.ts`.

## 12. Rencana pengujian

- **`models.ts`**: `pointCostFor` (dikenal/tak dikenal), `isModelAllowedForPlan` per paket &
  batas plafon, `modelsForPlan`, `defaultModelForPlan`, `monthlyPointsFor` (termasuk fallback
  plan tak dikenal).
- **`limits.ts`**: `pointsUsedThisMonth` (agregasi, batas awal bulan), `hasEnoughPoints`
  (tepat di jatah, lewat jatah, model mahal vs murah).
- **`messages.ts`**: `logOutbound` menulis `points`.
- **`process-job.ts`**: memakai `profile.agentModel`, meneruskan model ke `generateReply`,
  memotong poin hanya saat sukses, fallback model saat tak diizinkan.
- **`claude-client.ts`**: meneruskan `model` yang diberikan ke request.
- **Route** (`/api/agent/model`, `/api/agent/status`): pola repo → diverifikasi manual;
  logika inti diuji lewat unit test modul di bawahnya.

## 13. Di luar ruang lingkup (fase berikutnya)

- Katalog dinamis dari endpoint `/models` Sumopod (Pendekatan B).
- Top-up / saldo berbayar / rollover poin (Pendekatan B pada pelacakan).
- Penagihan berbasis token nyata / harga sadar-cache.
- Panel admin untuk menyetel tarif poin & jatah tanpa deploy.
```
