# Multi-Product Navigation & Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the site from a single-product (Metadata) homepage into a multi-product hub: a new brand-level Home page, a dedicated Metadata page carrying today's homepage content unchanged, a new public Agent marketing page, and a nav that reflects all of it.

**Architecture:** Pure Next.js App Router routing + presentational marketing components — no new lib logic, no new Prisma models, no new API routes. Two route moves (today's homepage → `/metadata`; today's `/agent` owner dashboard → `/agent/dashboard`), two new pages (`/` rebuilt, new `/agent` marketing page), one new mockup component, and small edits to the shared `Header`/`Footer` and one WhatsApp reply string.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 3 — all existing, no new dependencies.

## Global Constraints

- No new unit tests for marketing pages/components — matches the existing convention where `Hero`, `FeatureSection`, `MarketplaceRow`, and the mockup components have no test files (spec: Testing / Verification).
- Body copy stays Indonesian; only the top-nav labels are English (Home, Agent, Metadata, Learn, Sign In) — an intentional, approved inconsistency, not an oversight (spec: Home Page Page section).
- `/pricing` keeps working exactly as today; it only stops being a standalone top-nav item (spec: Explicitly out of scope).
- The existing Phase-1 owner dashboard's behavior (redirect to `/login` when signed out, "belum aktif" message when the profile isn't active, phone-linking UI when active) must be preserved byte-for-byte at its new path `/agent/dashboard` (spec: Route Changes).

---

### Task 1: Move today's homepage to `/metadata`

**Files:**
- Create: `src/app/metadata/page.tsx`
- (Do not modify `src/app/page.tsx` yet — Task 4 replaces it.)

**Interfaces:**
- Consumes: `Hero`, `FeatureSection`, `MarketplaceTabsMockup`, `KeywordChipsMockup`, `BatchProgressMockup`, `MarketplaceRow`, `PricingTeaser` — all existing components under `src/components/marketing/`, unchanged.
- Produces: a working `/metadata` route rendering identically to today's `/`. No later task depends on this file's internals — later tasks only depend on the route existing.

- [ ] **Step 1: Create `src/app/metadata/page.tsx` with exactly today's homepage content**

```tsx
import { Hero } from "@/components/marketing/Hero";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { MarketplaceTabsMockup } from "@/components/marketing/mockups/MarketplaceTabsMockup";
import { KeywordChipsMockup } from "@/components/marketing/mockups/KeywordChipsMockup";
import { BatchProgressMockup } from "@/components/marketing/mockups/BatchProgressMockup";
import { MarketplaceRow } from "@/components/marketing/MarketplaceRow";
import { PricingTeaser } from "@/components/marketing/PricingTeaser";

export default function MetadataPage() {
  return (
    <main>
      <Hero />
      <FeatureSection
        title="Satu klik. Semua marketplace."
        body="Bekerja langsung di formulir unggah Adobe Stock, Shutterstock, Vecteezy, Canva, dan lainnya — tanpa salin-tempel."
        mockup={<MarketplaceTabsMockup />}
        theme="dark"
        imageSide="left"
      />
      <FeatureSection
        title="Kata kunci yang konsisten."
        body="30 kata kunci hasil AI plus ruang untuk kata kunci Anda sendiri, konsisten di setiap unggahan."
        mockup={<KeywordChipsMockup />}
        theme="light"
        imageSide="right"
      />
      <FeatureSection
        title="Dibuat untuk unggahan massal."
        body="Pilih banyak gambar sekaligus, pantau progres per gambar, dan terapkan ke semua tab marketplace yang terbuka."
        mockup={<BatchProgressMockup />}
        theme="dark"
        imageSide="left"
      />
      <MarketplaceRow />
      <PricingTeaser />
    </main>
  );
}
```

- [ ] **Step 2: Verify the project builds and the new route renders**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds; the route manifest includes `/metadata` (grep the build output for `metadata` if unsure: `npm run build 2>&1 | grep metadata`).

- [ ] **Step 3: Manually verify the new route matches the old one**

Run: `npm run dev`, open `http://localhost:3000/metadata` and `http://localhost:3000/` (still the old homepage at this point) side by side — confirm they render identically. Stop the dev server once confirmed.

- [ ] **Step 4: Commit**

```bash
git add src/app/metadata/page.tsx
git commit -m "Add /metadata route with today's homepage content"
```

---

### Task 2: `AgentChatMockup` component

**Files:**
- Create: `src/components/marketing/mockups/AgentChatMockup.tsx`

**Interfaces:**
- Produces: `AgentChatMockup(): JSX.Element`, a self-contained illustrative component with no props, following the same visual family as `MetadataCardMockup` (rounded card, shadow, ring) but styled as WhatsApp-style chat bubbles. Consumed by Task 3 (Agent marketing page) and Task 4 (Home page).

- [ ] **Step 1: Create `src/components/marketing/mockups/AgentChatMockup.tsx`**

```tsx
export function AgentChatMockup() {
  return (
    <div className="rounded-3xl bg-white p-6 text-left shadow-2xl shadow-gray-950/10 ring-1 ring-gray-950/5 dark:bg-gray-900 dark:shadow-none dark:ring-white/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Nerona Agent · WhatsApp
        </p>
        <span className="flex h-2 w-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
        </span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2 text-sm text-white">
          Catat: Bu Sari pesan 2 keripik pedas, belum bayar
        </div>
        <div className="mr-auto max-w-[80%] rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-2 text-sm text-gray-800 dark:bg-white/10 dark:text-gray-100">
          Siap! Pesanan Bu Sari sudah dicatat — 2 keripik pedas, status belum bayar. Ada lagi?
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the project type-checks**

Run: `npx tsc --noEmit`
Expected: no errors (the component isn't imported anywhere yet, so this just confirms the file itself is valid TSX).

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/mockups/AgentChatMockup.tsx
git commit -m "Add AgentChatMockup component"
```

---

### Task 3: Move the owner dashboard to `/agent/dashboard`, add a public `/agent` marketing page

**Files:**
- Create: `src/app/agent/dashboard/page.tsx`
- Modify: `src/app/agent/page.tsx` (full replacement)

**Interfaces:**
- Consumes: `requireUser` (`@/lib/session-guards`, existing), `getOwnProfile` (`@/lib/agent/profile`, existing), `AgentLinkPanel` (`@/components/agent/AgentLinkPanel`, existing), `AgentChatMockup` (Task 2).
- Produces: `/agent/dashboard` behaving exactly as `/agent` did before this task (same redirect/gating behavior). `/agent` becomes a public marketing page. Task 5 depends on `/agent/dashboard` existing as the new link target.

- [ ] **Step 1: Create `src/app/agent/dashboard/page.tsx` with today's `/agent` page content, unchanged**

```tsx
import { requireUser } from "@/lib/session-guards";
import { getOwnProfile } from "@/lib/agent/profile";
import { AgentLinkPanel } from "@/components/agent/AgentLinkPanel";

export default async function AgentDashboardPage() {
  const session = await requireUser();
  const profile = await getOwnProfile(session.user.id);

  if (!profile || profile.status !== "active") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-gray-950 dark:text-white">Nerona Agent</h1>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Akun agent Anda belum aktif. Lakukan pembayaran lalu hubungi admin Nerona untuk
          mengaktifkan akses WhatsApp AI Assistant Anda.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-gray-950 dark:text-white">Nerona Agent</h1>
      <AgentLinkPanel
        displayNumber={process.env.WHATSAPP_DISPLAY_NUMBER ?? ""}
        whatsappPhone={profile.whatsappPhone}
        phoneVerifiedAt={profile.phoneVerifiedAt ? profile.phoneVerifiedAt.toISOString() : null}
      />
    </main>
  );
}
```

- [ ] **Step 2: Replace `src/app/agent/page.tsx` with the new public marketing page**

This deliberately does not reuse the `FeatureSection` component for the two feature blocks below — `FeatureSection` requires a per-section mockup, and inventing two more new mockup components for this page would be unnecessary scope beyond the one `AgentChatMockup` component the design calls for. Instead, the two features render as a simple text grid, matching the same "no invented visuals beyond what's needed" spirit as the rest of the site's simpler sections (e.g. `MarketplaceRow`).

```tsx
import Link from "next/link";
import { AgentChatMockup } from "@/components/marketing/mockups/AgentChatMockup";

const FEATURES = [
  {
    title: "Chat langsung di WhatsApp Anda.",
    body: "Satu nomor WhatsApp Nerona melayani semua pelanggan Nerona Agent. Hubungkan nomor Anda sekali, lalu mulai chat seperti biasa.",
  },
  {
    title: "Ingat percakapan dan bisnis Anda.",
    body: "Nerona Agent mengingat catatan dan fakta penting tentang bisnis Anda dari percakapan sebelumnya, jadi Anda tidak perlu mengulang.",
  },
];

export default function AgentMarketingPage() {
  return (
    <main>
      <section className="bg-white px-6 pb-24 pt-20 text-center dark:bg-black sm:pt-28">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Nerona Agent</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-7xl">
            Asisten AI yang{" "}
            <span className="bg-gradient-to-r from-blue-600 to-sky-400 bg-clip-text text-transparent">
              chat langsung di WhatsApp.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500 dark:text-gray-400 sm:text-xl">
            Nerona Agent membantu pemilik usaha kecil mencatat pesanan, mengingat percakapan, dan
            menjawab pelanggan — semua lewat WhatsApp yang sudah Anda pakai setiap hari.
          </p>
          <div className="mx-auto mt-16 max-w-lg">
            <AgentChatMockup />
          </div>
        </div>
      </section>

      <section className="bg-[#f5f5f7] px-6 py-24 dark:bg-gray-950 sm:py-32">
        <div className="mx-auto grid max-w-5xl gap-12 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">
                {feature.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white px-6 py-16 text-center dark:bg-black">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sudah pelanggan?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Masuk ke akun Anda
          </Link>
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Verify the project builds**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds; route manifest includes both `/agent` and `/agent/dashboard` (`npm run build 2>&1 | grep "agent"`).

- [ ] **Step 4: Manually verify both routes**

Run: `npm run dev`.
- Open `http://localhost:3000/agent` in a private/incognito window — expect the new public marketing page to render with no redirect.
- Open `http://localhost:3000/agent/dashboard` in the same private window — expect a redirect to `/login` (unchanged gating behavior, just at the new path).

Stop the dev server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add src/app/agent/dashboard/page.tsx src/app/agent/page.tsx
git commit -m "Move owner dashboard to /agent/dashboard, add public /agent marketing page"
```

---

### Task 4: Rebuild `/` as the brand-level Home page

**Files:**
- Modify: `src/app/page.tsx` (full replacement)

**Interfaces:**
- Consumes: `FeatureSection` (existing), `MetadataCardMockup` (existing, `@/components/marketing/mockups/MetadataCardMockup`), `AgentChatMockup` (Task 2).
- Produces: the new Home page at `/`. No later task depends on this file's internals.

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
import Link from "next/link";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { MetadataCardMockup } from "@/components/marketing/mockups/MetadataCardMockup";
import { AgentChatMockup } from "@/components/marketing/mockups/AgentChatMockup";

export default function HomePage() {
  return (
    <main>
      <section className="bg-white px-6 pb-24 pt-20 text-center dark:bg-black sm:pt-28">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Nerona</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-7xl">
            Satu perusahaan,{" "}
            <span className="bg-gradient-to-r from-blue-600 to-sky-400 bg-clip-text text-transparent">
              alat AI untuk kontributor dan pemilik bisnis.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500 dark:text-gray-400 sm:text-xl">
            Dari metadata otomatis untuk kontributor stock, sampai asisten AI WhatsApp untuk
            pemilik usaha kecil — Nerona membangun alat yang bekerja untuk Anda.
          </p>
          <div className="mt-8 flex items-center justify-center gap-6">
            <Link
              href="/metadata"
              className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              Lihat Metadata
            </Link>
            <Link
              href="/agent"
              className="text-sm font-medium text-blue-600 transition hover:underline dark:text-blue-400"
            >
              Lihat Agent <span aria-hidden="true">›</span>
            </Link>
          </div>
        </div>
      </section>

      <FeatureSection
        title="Nerona Metadata"
        body="Judul, deskripsi, dan kata kunci dibuat otomatis dengan AI, lalu diisi langsung ke formulir unggah Adobe Stock, Shutterstock, Vecteezy, Canva, dan lainnya."
        mockup={<MetadataCardMockup />}
        theme="dark"
        imageSide="left"
      />
      <FeatureSection
        title="Nerona Agent"
        body="Asisten AI yang chat langsung di WhatsApp — catat pesanan, ingat percakapan, dan bantu jawab pelanggan, tanpa aplikasi baru untuk dipelajari."
        mockup={<AgentChatMockup />}
        theme="light"
        imageSide="right"
      />
    </main>
  );
}
```

- [ ] **Step 2: Verify the project builds**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manually verify**

Run: `npm run dev`, open `http://localhost:3000/` — expect the new brand-level Home page (not the old Metadata-specific homepage, which now lives at `/metadata`). Click both "Lihat Metadata" and "Lihat Agent" buttons — confirm they navigate to `/metadata` and `/agent` respectively. Stop the dev server once confirmed.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "Rebuild / as the brand-level Home page"
```

---

### Task 5: Update the webhook's unknown-sender link and its test

**Files:**
- Modify: `src/lib/agent/webhook-handler.ts:60`
- Modify: `tests/lib/agent/webhook-handler.test.ts:161`

**Interfaces:**
- Consumes: `baseUrl` (`@/lib/base-url`, existing, unchanged).
- Produces: the unknown-sender reply now points to `/agent/dashboard` instead of `/agent`, matching Task 3's route move.

- [ ] **Step 1: Update the reply text in `src/lib/agent/webhook-handler.ts`**

Find (around line 57-61):

```ts
    await replyStatic(
      phone,
      null,
      `Nomor ini belum terdaftar di Nerona Agent. Daftar dulu di ${baseUrl()}/agent`
    );
```

Replace with:

```ts
    await replyStatic(
      phone,
      null,
      `Nomor ini belum terdaftar di Nerona Agent. Daftar dulu di ${baseUrl()}/agent/dashboard`
    );
```

- [ ] **Step 2: Update the matching test assertion in `tests/lib/agent/webhook-handler.test.ts`**

Find (around line 161):

```ts
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("http://localhost:3000/agent")
    );
```

Replace with:

```ts
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("http://localhost:3000/agent/dashboard")
    );
```

- [ ] **Step 3: Run the test to verify it passes with the updated assertion**

Run: `npx vitest run tests/lib/agent/webhook-handler.test.ts`
Expected: PASS — 11 passed (same count as before; this only changes what one existing test asserts, it doesn't add or remove a test case).

- [ ] **Step 4: Run the full suite and type-check**

Run: `npm test`
Expected: all tests passing (137, matching the count from the last full Phase-1 verification — no test count change from this task).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/webhook-handler.ts tests/lib/agent/webhook-handler.test.ts
git commit -m "Point webhook's unknown-sender reply at /agent/dashboard"
```

---

### Task 6: Update `Header.tsx` and `Footer.tsx` to the new 5-tab nav

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/Footer.tsx`

**Interfaces:**
- Consumes: routes from Tasks 1-4 (`/`, `/metadata`, `/agent`, `/learn` — `/learn` already existed and is unchanged).
- Produces: the site-wide nav and footer reflecting the new structure. No later task depends on this file's internals.

- [ ] **Step 1: Replace `src/components/layout/Header.tsx`**

```tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const navLink =
  "text-xs text-gray-800 transition hover:text-gray-950 dark:text-gray-300 dark:hover:text-white";

export async function Header() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-950/5 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-black/70">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-gray-950 dark:text-white"
        >
          Nerona
        </Link>
        <nav className="flex items-center gap-7">
          <Link href="/" className={navLink}>
            Home
          </Link>
          <Link href="/agent" className={navLink}>
            Agent
          </Link>
          <Link href="/metadata" className={navLink}>
            Metadata
          </Link>
          <Link href="/learn" className={navLink}>
            Learn
          </Link>
          {session?.user ? (
            <>
              <Link href="/account" className={navLink}>
                Account
              </Link>
              {session.user.role && (
                <Link href="/admin" className={navLink}>
                  Admin
                </Link>
              )}
              <a
                href="/api/auth/signout"
                className="rounded-full bg-gray-950 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
              >
                Sign Out
              </a>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Replace `src/components/layout/Footer.tsx`**

```tsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-950/5 bg-[#f5f5f7] px-6 py-12 dark:border-white/10 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold tracking-tight text-gray-950 dark:text-white">
          Nerona
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Metadata otomatis untuk kontributor stock.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
          <Link href="/" className="transition hover:text-gray-950 dark:hover:text-white">
            Home
          </Link>
          <Link href="/agent" className="transition hover:text-gray-950 dark:hover:text-white">
            Agent
          </Link>
          <Link href="/metadata" className="transition hover:text-gray-950 dark:hover:text-white">
            Metadata
          </Link>
          <Link href="/learn" className="transition hover:text-gray-950 dark:hover:text-white">
            Learn
          </Link>
          <Link href="/login" className="transition hover:text-gray-950 dark:hover:text-white">
            Sign In
          </Link>
        </div>
        <p className="mt-6 border-t border-gray-950/5 pt-6 text-xs text-gray-400 dark:border-white/10 dark:text-gray-500">
          &copy; {new Date().getFullYear()} Nerona. Hak cipta dilindungi.
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Verify the project builds**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manually verify the nav and footer**

Run: `npm run dev`. On any page, confirm the header shows Home · Agent · Metadata · Learn, followed by Sign In (signed out) — click each and confirm it lands on `/`, `/agent`, `/metadata`, `/learn` respectively. Scroll to the footer on `/metadata` and confirm the same 5 links appear and work. Stop the dev server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Header.tsx src/components/layout/Footer.tsx
git commit -m "Update nav and footer to the new Home/Agent/Metadata/Learn/Sign In structure"
```

---

### Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: all tests passing (137 — unchanged count from Task 5, since this task makes no further test changes).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds. Confirm the route manifest includes all of: `/`, `/metadata`, `/agent`, `/agent/dashboard`, `/learn` (`npm run build 2>&1 | grep -E "^\├|^\└"` or just eyeball the printed route list).

- [ ] **Step 3: Manual click-through checklist**

Run: `npm run dev`.
1. `/` renders the new brand-level Home page (Nerona tagline, two product sections, no pricing/marketplace content).
2. `/metadata` renders exactly what the old homepage used to show (Hero, 3 feature sections, marketplace row, pricing teaser).
3. `/agent` renders the new public marketing page, no login redirect, no signup button.
4. `/agent/dashboard` redirects to `/login` when signed out (same as `/agent` used to).
5. Header and footer both show Home/Agent/Metadata/Learn(/Sign In or Account+Admin+Sign Out) consistently across all pages.
6. `/pricing` still loads directly (not linked from top nav anymore, but still reachable, e.g. via the Metadata page's own "Lihat Harga" button).

---

## Phase complete when

- `npm test` passes (137 tests).
- `npm run build` succeeds with `/`, `/metadata`, `/agent`, `/agent/dashboard` all present.
- The manual checklist in Task 7 Step 3 passes.
- The webhook's unknown-sender reply points to `/agent/dashboard`, verified both by the updated test and by reading the source.
