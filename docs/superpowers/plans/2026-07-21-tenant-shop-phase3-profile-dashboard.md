# Tenant Shop UX — Fase 3: Profile + Dashboard (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename Akun→Profile dengan info pelanggan yang bisa diubah (nama, HP, nama bisnis, ganti password), dan tambah Dashboard tenant (kartu angka + grafik penjualan Recharts + transaksi terbaru + terlaris & stok menipis).

**Architecture:** Logika di `src/lib/profile.ts` dan `src/lib/shop-dashboard.ts` (diuji unit). Route API tipis. Halaman server-component memuat data lewat lib; grafik komponen client Recharts. Reuse `formatRupiah`.

**Tech Stack:** Next.js 14 + TypeScript + Prisma 5 + Vitest + Tailwind + Recharts (baru) + bcryptjs (via `src/lib/password.ts`).

Referensi spec: `docs/superpowers/specs/2026-07-21-tenant-shop-ux-overhaul-design.md` (bagian 8, 9, 10).

## Global Constraints

- Semua query di-scope `userId` (pemilik sesi).
- Kolom baru: `User.phone String?`, `User.businessName String?`.
- Ganti password: hanya untuk akun yang punya `password` (akun email/password, bukan Google-only). Verifikasi password lama dengan `verifyPassword`, simpan hash baru dengan `hashPassword` (dari `src/lib/password.ts`). Password baru minimal 8 karakter.
- Pendapatan = jumlah `total` transaksi berstatus `paid` atau `done`. "Bulan ini" = sejak tanggal 1 bulan kalender.
- Grafik penjualan: pendapatan harian 30 hari terakhir (hari tanpa transaksi = 0). Pakai Recharts, komponen `"use client"`. Warna aksesibel (satu seri), sumbu-Y format Rupiah singkat, tooltip format Rupiah penuh.
- Path: Dashboard `/dashboard`, Profile `/profile`; `/account` redirect ke `/profile`. Nav tenant: Dashboard, Produk, Transaksi, Profile.
- `LOW_STOCK_THRESHOLD` diambil dari `@/lib/shop` (jangan hardcode ulang).
- Fungsi lib di-TDD; komponen/halaman/route diverifikasi via `tsc` + `npm run build` + cek manual.
- Commit path file eksplisit (jangan `git add -A`).

---

### Task 1: Skema — kolom profil User

**Files:**
- Modify: `prisma/schema.prisma` (model `User`)

**Interfaces:**
- Produces: kolom `User.phone: String?`, `User.businessName: String?`. Dipakai Task 2, 3, 4.

- [ ] **Step 1: Tambah kolom**

Di `prisma/schema.prisma`, pada `model User`, setelah baris `name String?` tambahkan:

```prisma
  phone         String?
  businessName  String?
```

- [ ] **Step 2: Migrasi**

Run: `npm run prisma:migrate -- --name user_profile_fields`
Expected: berakhir `Your database is now in sync with your schema.`

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add phone and businessName columns to User"
```

---

### Task 2: `profile.ts` — update profil & ganti password

**Files:**
- Create: `src/lib/profile.ts`
- Test: `tests/lib/profile.test.ts`

**Interfaces:**
- Consumes: `prisma`, `hashPassword`/`verifyPassword` dari `@/lib/password`.
- Produces: `interface ProfileUpdate { name?: string|null; phone?: string|null; businessName?: string|null }`, `updateProfile(userId, update): Promise<void>`, `type ChangePasswordResult = { ok: true } | { ok: false; reason: "no_password" | "wrong_password" }`, `changePassword(userId, currentPassword, newPassword): Promise<ChangePasswordResult>`. Dipakai Task 3.

- [ ] **Step 1: Tulis test yang gagal**

Create `tests/lib/profile.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async () => "new-hash"),
  verifyPassword: vi.fn(),
}));

import { updateProfile, changePassword } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("updateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates only the fields provided", async () => {
    await updateProfile("user-1", { name: "Budi", businessName: "Toko Budi" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Budi", businessName: "Toko Budi" },
    });
  });

  it("passes null to clear a field but omits absent fields", async () => {
    await updateProfile("user-1", { phone: null });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { phone: null },
    });
  });
});

describe("changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no_password when the account has no password (e.g. Google-only)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ password: null });

    const result = await changePassword("user-1", "old", "newsecret8");

    expect(result).toEqual({ ok: false, reason: "no_password" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns wrong_password when the current password does not match", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ password: "stored-hash" });
    (verifyPassword as any).mockResolvedValue(false);

    const result = await changePassword("user-1", "wrong", "newsecret8");

    expect(result).toEqual({ ok: false, reason: "wrong_password" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("hashes and stores the new password when the current one matches", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ password: "stored-hash" });
    (verifyPassword as any).mockResolvedValue(true);

    const result = await changePassword("user-1", "correct", "newsecret8");

    expect(result).toEqual({ ok: true });
    expect(hashPassword).toHaveBeenCalledWith("newsecret8");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password: "new-hash" },
    });
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan gagal**

Run: `npx vitest run tests/lib/profile.test.ts`
Expected: FAIL — `src/lib/profile.ts` belum ada.

- [ ] **Step 3: Implementasi `src/lib/profile.ts`**

```ts
import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "./password";

export interface ProfileUpdate {
  name?: string | null;
  phone?: string | null;
  businessName?: string | null;
}

export async function updateProfile(userId: string, update: ProfileUpdate): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(update.name !== undefined ? { name: update.name } : {}),
      ...(update.phone !== undefined ? { phone: update.phone } : {}),
      ...(update.businessName !== undefined ? { businessName: update.businessName } : {}),
    },
  });
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: "no_password" | "wrong_password" };

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });
  if (!user?.password) {
    return { ok: false, reason: "no_password" };
  }
  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) {
    return { ok: false, reason: "wrong_password" };
  }
  const hash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { password: hash } });
  return { ok: true };
}
```

- [ ] **Step 4: Jalankan test — pastikan lulus**

Run: `npx vitest run tests/lib/profile.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile.ts tests/lib/profile.test.ts
git commit -m "Add profile update and change-password logic"
```

---

### Task 3: Route API Profile

**Files:**
- Create: `src/app/api/profile/route.ts`
- Create: `src/app/api/profile/password/route.ts`

**Interfaces:**
- Consumes: `updateProfile`, `changePassword` (Task 2); `authOptions`.
- Produces: `PATCH /api/profile` `{ name?, phone?, businessName? }` → `{ ok }`; `POST /api/profile/password` `{ currentPassword, newPassword }` → `{ ok }` / `{ ok:false, message }`. Dikonsumsi Task 4.
- Catatan: route diverifikasi manual.

- [ ] **Step 1: Buat `src/app/api/profile/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateProfile, type ProfileUpdate } from "@/lib/profile";

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const update: ProfileUpdate = {};
  if (typeof body?.name === "string") update.name = body.name.trim() || null;
  if (typeof body?.phone === "string") update.phone = body.phone.trim() || null;
  if (typeof body?.businessName === "string") update.businessName = body.businessName.trim() || null;

  await updateProfile(session.user.id, update);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Buat `src/app/api/profile/password/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { changePassword } from "@/lib/profile";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8) {
    return NextResponse.json(
      { ok: false, message: "Password baru minimal 8 karakter." },
      { status: 400 }
    );
  }

  const result = await changePassword(session.user.id, currentPassword, newPassword);
  if (!result.ok) {
    const message =
      result.reason === "no_password"
        ? "Akun ini memakai login Google, tidak ada password untuk diubah."
        : "Password lama salah.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/profile/route.ts src/app/api/profile/password/route.ts
git commit -m "Add profile update and change-password API routes"
```

---

### Task 4: Halaman Profile + form + redirect + nav

**Files:**
- Create: `src/app/profile/page.tsx`
- Create: `src/components/account/ProfileForm.tsx`
- Create: `src/components/account/PasswordForm.tsx`
- Modify: `src/app/account/page.tsx` (jadi redirect ke `/profile`)
- Modify: `src/components/layout/Header.tsx` (nav: rename Akun→Profile + `/account`→`/profile`; tambah Dashboard)
- Modify: `src/lib/session-guards.ts` (`requireAdmin` redirect `/account`→`/profile`)

**Interfaces:**
- Consumes: `PATCH /api/profile`, `POST /api/profile/password` (Task 3); `requireUser`, `prisma`, existing `ResendVerificationButton`, `LicenseSection`.
- Catatan: diverifikasi manual + build.

- [ ] **Step 1: Buat `src/components/account/ProfileForm.tsx`**

```tsx
"use client";

import { useState } from "react";

interface ProfileFormProps {
  initialName: string;
  initialPhone: string;
  initialBusinessName: string;
}

const inputClass =
  "w-full rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";

export function ProfileForm({ initialName, initialPhone, initialBusinessName }: ProfileFormProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, businessName }),
    });
    setSaving(false);
    setMessage(res.ok ? "Tersimpan." : "Gagal menyimpan.");
  }

  return (
    <div className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <p className="text-sm font-semibold text-ink">Informasi pelanggan</p>
      <div className="mt-3 space-y-3">
        <div>
          <label className="text-sm text-muted">Nama</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-sm text-muted">Nomor HP</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-sm text-muted">Nama bisnis / toko</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
        {message && <span className="text-sm text-muted">{message}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Buat `src/components/account/PasswordForm.tsx`**

```tsx
"use client";

import { useState } from "react";

const inputClass =
  "w-full rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && data?.ok) {
      setOk(true);
      setMessage("Password berhasil diubah.");
      setCurrentPassword("");
      setNewPassword("");
    } else {
      setOk(false);
      setMessage(data?.message || "Gagal mengubah password.");
    }
  }

  return (
    <div className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <p className="text-sm font-semibold text-ink">Ganti password</p>
      <div className="mt-3 space-y-3">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Password lama"
          className={inputClass}
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Password baru (min. 8 karakter)"
          className={inputClass}
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !currentPassword || !newPassword}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Ubah password"}
        </button>
        {message && (
          <span className={`text-sm ${ok ? "text-emerald-600" : "text-rose-500"}`}>{message}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Buat `src/app/profile/page.tsx`**

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { LicenseSection } from "@/components/account/LicenseSection";
import { ProfileForm } from "@/components/account/ProfileForm";
import { PasswordForm } from "@/components/account/PasswordForm";

export const metadata = { title: "Profile — Nerona" };

export default async function ProfilePage() {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      emailVerified: true,
      name: true,
      phone: true,
      businessName: true,
      password: true,
    },
  });
  const license = await prisma.license.findFirst({
    where: { userId: session.user.id },
    include: { plan: true },
  });

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Profile</h1>

        <div className="mt-8 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
          <p className="text-sm text-muted">Email</p>
          <p className="mt-0.5 font-medium text-ink">{session.user.email}</p>
          <p className="mt-4 text-sm text-muted">Peran</p>
          <p className="mt-0.5 font-medium text-ink">{session.user.role ?? "pelanggan"}</p>
        </div>

        {!user?.emailVerified && (
          <div className="mt-6 rounded-3xl border border-gold-400/30 bg-gold-400/10 p-6">
            <p className="text-sm text-brand-blue">Silakan verifikasi alamat email Anda.</p>
            <div className="mt-2">
              <ResendVerificationButton />
            </div>
          </div>
        )}

        <ProfileForm
          initialName={user?.name ?? ""}
          initialPhone={user?.phone ?? ""}
          initialBusinessName={user?.businessName ?? ""}
        />

        {user?.password && <PasswordForm />}

        {license ? (
          <LicenseSection
            licenseKey={license.licenseKey}
            planName={license.plan?.name ?? "Pro"}
            status={license.status}
            validUntil={license.validUntil ? license.validUntil.toLocaleDateString("id-ID") : null}
          />
        ) : (
          <div className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 text-center shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
            <p className="text-sm text-muted">Anda belum punya lisensi aktif.</p>
            <Link
              href="/pricing"
              className="mt-3 inline-block rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-5 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110"
            >
              Lihat harga
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Ganti `src/app/account/page.tsx` jadi redirect**

Ganti seluruh isi:

```tsx
import { redirect } from "next/navigation";

export default function AccountRedirect() {
  redirect("/profile");
}
```

- [ ] **Step 5: Update nav di `src/components/layout/Header.tsx`**

Ganti konstanta `CUSTOMER_NAV`:

```ts
const CUSTOMER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/produk", label: "Produk" },
  { href: "/transaksi", label: "Transaksi" },
  { href: "/profile", label: "Profile" },
];
```

- [ ] **Step 6: Update `requireAdmin` redirect di `src/lib/session-guards.ts`**

Ganti `redirect("/account");` menjadi `redirect("/profile");`.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 8: Commit**

```bash
git add src/app/profile/page.tsx src/components/account/ProfileForm.tsx src/components/account/PasswordForm.tsx src/app/account/page.tsx src/components/layout/Header.tsx src/lib/session-guards.ts
git commit -m "Add editable Profile page, rename Akun->Profile, redirect /account"
```

---

### Task 5: `shop-dashboard.ts` — agregasi ringkasan

**Files:**
- Create: `src/lib/shop-dashboard.ts`
- Test: `tests/lib/shop-dashboard.test.ts`

**Interfaces:**
- Consumes: `prisma`, `LOW_STOCK_THRESHOLD` dari `@/lib/shop`.
- Produces:
  - `getDashboardSummary(userId, now?): Promise<{ revenueThisMonth: number; orderCount: number; activeProductCount: number; unpaidCount: number; recentOrders: {id;customerName;total;status;createdAt}[]; topProducts: {productName;qtySold:number}[]; lowStock: {id;name;stock}[] }>`
  - `getSalesSeries(userId, days?, now?): Promise<{ date: string; revenue: number }[]>`
- Dipakai Task 7.

- [ ] **Step 1: Tulis test yang gagal**

Create `tests/lib/shop-dashboard.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shopOrder: { aggregate: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    shopProduct: { count: vi.fn(), findMany: vi.fn() },
    shopOrderItem: { groupBy: vi.fn() },
  },
}));

import { getDashboardSummary, getSalesSeries } from "@/lib/shop-dashboard";
import { prisma } from "@/lib/prisma";

describe("getDashboardSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.shopOrder.aggregate as any).mockResolvedValue({ _sum: { total: 150000 } });
    (prisma.shopOrder.count as any).mockResolvedValue(3);
    (prisma.shopProduct.count as any).mockResolvedValue(7);
    (prisma.shopOrder.findMany as any).mockResolvedValue([
      { id: "o1", customerName: "A", total: 50000, status: "paid", createdAt: new Date() },
    ]);
    (prisma.shopOrderItem.groupBy as any).mockResolvedValue([
      { productName: "Kopi", _sum: { qty: 12 } },
    ]);
    (prisma.shopProduct.findMany as any).mockResolvedValue([{ id: "p1", name: "Teh", stock: 2 }]);
  });

  it("returns revenue summed only from paid/done orders this month", async () => {
    const now = new Date("2026-07-19T10:00:00");
    const result = await getDashboardSummary("user-1", now);

    expect(result.revenueThisMonth).toBe(150000);
    const aggArg = (prisma.shopOrder.aggregate as any).mock.calls[0][0];
    expect(aggArg._sum).toEqual({ total: true });
    expect(aggArg.where.userId).toBe("user-1");
    expect(aggArg.where.status).toEqual({ in: ["paid", "done"] });
    expect(aggArg.where.createdAt).toEqual({ gte: new Date(2026, 6, 1) });
  });

  it("maps counts, top products, and low stock into the summary shape", async () => {
    const result = await getDashboardSummary("user-1", new Date("2026-07-19T10:00:00"));

    expect(result.orderCount).toBe(3);
    expect(result.activeProductCount).toBe(7);
    expect(result.topProducts).toEqual([{ productName: "Kopi", qtySold: 12 }]);
    expect(result.lowStock).toEqual([{ id: "p1", name: "Teh", stock: 2 }]);
    expect(result.recentOrders).toHaveLength(1);
  });

  it("counts unpaid orders by status new", async () => {
    (prisma.shopOrder.count as any).mockResolvedValueOnce(3).mockResolvedValueOnce(5);
    const result = await getDashboardSummary("user-1", new Date("2026-07-19T10:00:00"));
    expect(result.unpaidCount).toBe(5);
    const unpaidCall = (prisma.shopOrder.count as any).mock.calls[1][0];
    expect(unpaidCall.where).toEqual({ userId: "user-1", status: "new" });
  });
});

describe("getSalesSeries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns one entry per day with zeroes filled for empty days", async () => {
    (prisma.shopOrder.findMany as any).mockResolvedValue([]);
    const now = new Date("2026-07-19T10:00:00");

    const series = await getSalesSeries("user-1", 7, now);

    expect(series).toHaveLength(7);
    expect(series[6].date).toBe("2026-07-19");
    expect(series[0].date).toBe("2026-07-13");
    expect(series.every((d) => d.revenue === 0)).toBe(true);
  });

  it("buckets order totals into their day", async () => {
    (prisma.shopOrder.findMany as any).mockResolvedValue([
      { total: 20000, createdAt: new Date("2026-07-19T08:00:00") },
      { total: 5000, createdAt: new Date("2026-07-19T20:00:00") },
      { total: 9000, createdAt: new Date("2026-07-18T12:00:00") },
    ]);
    const now = new Date("2026-07-19T10:00:00");

    const series = await getSalesSeries("user-1", 7, now);

    const byDate = Object.fromEntries(series.map((d) => [d.date, d.revenue]));
    expect(byDate["2026-07-19"]).toBe(25000);
    expect(byDate["2026-07-18"]).toBe(9000);
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan gagal**

Run: `npx vitest run tests/lib/shop-dashboard.test.ts`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Implementasi `src/lib/shop-dashboard.ts`**

```ts
import { prisma } from "./prisma";
import { LOW_STOCK_THRESHOLD } from "./shop";

const REVENUE_STATUSES = ["paid", "done"];

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getDashboardSummary(userId: string, now: Date = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [revenueAgg, orderCount, activeProductCount, unpaidCount, recentOrders, topItems, lowStock] =
    await Promise.all([
      prisma.shopOrder.aggregate({
        _sum: { total: true },
        where: { userId, status: { in: REVENUE_STATUSES }, createdAt: { gte: monthStart } },
      }),
      prisma.shopOrder.count({ where: { userId, createdAt: { gte: monthStart } } }),
      prisma.shopProduct.count({ where: { userId, isActive: true } }),
      prisma.shopOrder.count({ where: { userId, status: "new" } }),
      prisma.shopOrder.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, customerName: true, total: true, status: true, createdAt: true },
      }),
      prisma.shopOrderItem.groupBy({
        by: ["productName"],
        where: { order: { userId, status: { in: REVENUE_STATUSES } } },
        _sum: { qty: true },
        orderBy: { _sum: { qty: "desc" } },
        take: 5,
      }),
      prisma.shopProduct.findMany({
        where: { userId, stock: { lte: LOW_STOCK_THRESHOLD } },
        orderBy: { stock: "asc" },
        take: 5,
        select: { id: true, name: true, stock: true },
      }),
    ]);

  return {
    revenueThisMonth: revenueAgg._sum.total ?? 0,
    orderCount,
    activeProductCount,
    unpaidCount,
    recentOrders,
    topProducts: topItems.map((t) => ({ productName: t.productName, qtySold: t._sum.qty ?? 0 })),
    lowStock,
  };
}

export async function getSalesSeries(userId: string, days = 30, now: Date = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const orders = await prisma.shopOrder.findMany({
    where: { userId, status: { in: REVENUE_STATUSES }, createdAt: { gte: start } },
    select: { total: true, createdAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    buckets.set(dateKey(d), 0);
  }
  for (const order of orders) {
    const key = dateKey(order.createdAt);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + order.total);
    }
  }

  return Array.from(buckets.entries()).map(([date, revenue]) => ({ date, revenue }));
}
```

- [ ] **Step 4: Jalankan test — pastikan lulus**

Run: `npx vitest run tests/lib/shop-dashboard.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shop-dashboard.ts tests/lib/shop-dashboard.test.ts
git commit -m "Add dashboard summary and daily sales series aggregation"
```

---

### Task 6: Recharts + komponen `SalesChart`

**Files:**
- Modify: `package.json` / `package-lock.json` (tambah `recharts`)
- Create: `src/components/shop/SalesChart.tsx`

**Interfaces:**
- Produces: `SalesChart({ data }: { data: { date: string; revenue: number }[] })`. Dipakai Task 7.

- [ ] **Step 1: Install recharts**

Run: `npm install recharts@^2.15.0`
Expected: terpasang, `package.json` mencantumkan `recharts`.

- [ ] **Step 2: Buat `src/components/shop/SalesChart.tsx`**

```tsx
"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah } from "@/components/shop/ProductManager";

interface SalesChartProps {
  data: { date: string; revenue: number }[];
}

function shortRupiah(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}rb`;
  return String(value);
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function SalesChart({ data }: SalesChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,140,0.15)" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fontSize: 11, fill: "currentColor" }}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={shortRupiah}
            tick={{ fontSize: 11, fill: "currentColor" }}
            width={44}
          />
          <Tooltip
            formatter={(value: number) => [formatRupiah(value), "Pendapatan"]}
            labelFormatter={(label: string) => shortDate(label)}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/shop/SalesChart.tsx
git commit -m "Add recharts and SalesChart component"
```

---

### Task 7: Halaman Dashboard

**Files:**
- Create: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `requireUser`, `getDashboardSummary`, `getSalesSeries` (Task 5), `SalesChart` (Task 6), `formatRupiah`.
- Catatan: diverifikasi manual + build.

- [ ] **Step 1: Buat `src/app/dashboard/page.tsx`**

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { getDashboardSummary, getSalesSeries } from "@/lib/shop-dashboard";
import { formatRupiah } from "@/components/shop/ProductManager";
import { SalesChart } from "@/components/shop/SalesChart";

export const metadata = { title: "Dashboard — Nerona" };

const STATUS_LABEL: Record<string, string> = {
  new: "Baru",
  paid: "Dibayar",
  done: "Selesai",
  cancelled: "Batal",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireUser();
  const [summary, series] = await Promise.all([
    getDashboardSummary(session.user.id),
    getSalesSeries(session.user.id),
  ]);

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-5xl px-6 py-14 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Dashboard</h1>

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Pendapatan bulan ini" value={formatRupiah(summary.revenueThisMonth)} />
          <Stat label="Transaksi bulan ini" value={String(summary.orderCount)} />
          <Stat label="Produk aktif" value={String(summary.activeProductCount)} />
          <Stat label="Belum dibayar" value={String(summary.unpaidCount)} />
        </div>

        <div className="mt-8 rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
          <p className="text-sm font-semibold text-ink">Penjualan 30 hari terakhir</p>
          <div className="mt-4 text-ink">
            <SalesChart data={series} />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Transaksi terbaru</p>
              <Link href="/transaksi" className="text-xs text-brand-blue hover:underline">
                Lihat semua
              </Link>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {summary.recentOrders.length === 0 && (
                <li className="text-muted">Belum ada transaksi.</li>
              )}
              {summary.recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3">
                  <span className="text-ink">{o.customerName || "Tanpa nama"}</span>
                  <span className="text-xs text-muted">{STATUS_LABEL[o.status] ?? o.status}</span>
                  <span className="tabular-nums font-medium text-ink">{formatRupiah(o.total)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
              <p className="text-sm font-semibold text-ink">Produk terlaris</p>
              <ul className="mt-3 space-y-2 text-sm">
                {summary.topProducts.length === 0 && <li className="text-muted">Belum ada data.</li>}
                {summary.topProducts.map((p) => (
                  <li key={p.productName} className="flex justify-between gap-3">
                    <span className="text-ink">{p.productName}</span>
                    <span className="text-muted">{p.qtySold} terjual</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
              <p className="text-sm font-semibold text-ink">Stok menipis</p>
              <ul className="mt-3 space-y-2 text-sm">
                {summary.lowStock.length === 0 && <li className="text-muted">Semua stok aman.</li>}
                {summary.lowStock.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span className="text-ink">{p.name}</span>
                    <span className="text-rose-600">sisa {p.stock ?? 0}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check & build**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "Add tenant dashboard page with KPIs, sales chart, recent orders, top/low stock"
```

---

### Task 8: Verifikasi penuh Fase 3

**Files:** none (verifikasi saja).

- [ ] **Step 1: Seluruh unit test**

Run: `npm test`
Expected: lulus termasuk `profile.test.ts` (5) & `shop-dashboard.test.ts` (5). Kegagalan pre-existing di `orders.test.ts` dicatat sebagai di luar ruang lingkup.

- [ ] **Step 2: Build produksi**

Run: `npm run build`
Expected: sukses; route `/dashboard` dan `/profile` ter-build.

- [ ] **Step 3: Cek manual**

Run: `npm run dev`, login.
- `/profile`: ubah Nama/HP/Nama bisnis → Simpan → reload tetap tersimpan. Ganti password (akun email/password) → sukses; salah password lama → pesan error. Akun Google: bagian ganti password tidak muncul.
- `/account` → redirect ke `/profile`.
- `/dashboard`: kartu angka terisi; grafik 30 hari tampil; transaksi terbaru, terlaris, stok menipis tampil.
- Header tenant: Dashboard · Produk · Transaksi · Profile.

---

## Fase 3 complete when

- `npm test` hijau termasuk `profile.test.ts` & `shop-dashboard.test.ts`.
- `npm run build` sukses.
- `/profile` bisa mengubah nama/HP/nama bisnis & ganti password (akun email/password); `/account` redirect ke `/profile`.
- `/dashboard` menampilkan kartu angka, grafik penjualan (Recharts), transaksi terbaru, produk terlaris & stok menipis.
- Nav tenant menampilkan Dashboard, Produk, Transaksi, Profile.

**Selesai:** seluruh spec `2026-07-21-tenant-shop-ux-overhaul-design.md` (Fase 1-3) terimplementasi.
