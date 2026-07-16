# Marketing Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder homepage with an Apple-style marketing page for Nerona Metadata that funnels every CTA to the existing `/pricing` checkout flow, and add a shared Header/Footer across the whole site.

**Architecture:** A generic `FeatureSection` component (text + CSS-mockup, alternating light/dark, alternating image side) is built once and reused for four feature blocks. `src/app/page.tsx` becomes a thin server component assembling `Hero`, four `FeatureSection`s, `MarketplaceRow`, and `PricingTeaser` in order. `Header`/`Footer` move into `src/app/layout.tsx` so every page (not just `/`) gets them; the signed-in/signed-out branching that used to live in `page.tsx` moves into `Header`.

**Tech Stack:** Next.js 14 App Router (TypeScript), Tailwind CSS, `next-auth` (`getServerSession`), `next/font/google` (Inter). No new dependencies to install.

## Global Constraints

- No new Prisma models/queries, API routes, or environment variables — this feature is presentation-only.
- No real screenshots — all product visuals are CSS-only mockups built in code (no `public/` image assets).
- Homepage must not mention installing/downloading the extension (extension isn't publicly distributed yet).
- No full pricing table or price digits on the homepage — the pricing section is copy + a link to `/pricing`, which already owns the live Stripe/Plan lookup.
- Marketplace names render as plain text (Adobe Stock, Freepik, Vecteezy, Shutterstock) — no logo image assets, to avoid trademark-logo issues.
- Per the approved spec (`docs/superpowers/specs/2026-07-16-marketing-homepage-design.md`), this codebase does not unit-test static/session-branching UI pages (only `lib` logic and API routes get Vitest tests). Every task below therefore verifies with `npx tsc --noEmit` plus a live `npm run dev` + `curl` content check instead of a Vitest suite — that is intentional, not a shortcut.
- `Header`/`Footer` use the existing `dark:`-adaptive Tailwind style already used by `AuthCard` etc. (they wrap every page, including the already-dark-mode-aware auth pages). The new marketing-only sections (`Hero`, `FeatureSection`, `MarketplaceRow`, `PricingTeaser`) use fixed light/dark colors per section (no `dark:` variants) — this matches the approved wireframe (Option A) and keeps the section rhythm predictable regardless of the visitor's OS theme.

---

## Verification Helper (used by every task)

Each task's "start dev server, curl, stop" steps use this exact pattern (already validated manually in this repo/environment). Run from `C:\Users\alfia\Documents\fahmi\project\produk\nerona\nerona-web`:

```bash
# Free port 3000 if anything is still bound to it (ignore errors if none)
netstat -ano | grep ":3000" | grep LISTENING | awk '{print $5}' | sort -u | while read p; do taskkill //PID "$p" //F; done

# Start the dev server in the background
(npm run dev > /tmp/nerona-dev-check.log 2>&1 &)
sleep 8
cat /tmp/nerona-dev-check.log
```

Then run the task-specific `curl` checks. When done, find and stop the server:

```bash
netstat -ano | grep ":3000" | grep LISTENING
# note the PID in the last column, then:
taskkill //PID <PID> //F
```

---

### Task 1: Shared Header, Footer, and Inter font in the root layout

**Files:**
- Create: `src/components/layout/Header.tsx`
- Create: `src/components/layout/Footer.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `tailwind.config.ts`

**Interfaces:**
- Consumes: `authOptions` from `@/lib/auth` (already exported, already used by `src/app/page.tsx` today).
- Produces: `Header()` — async server component, no props. `Footer()` — sync component, no props. Root layout renders `<Header />{children}<Footer />` inside `<body className="font-sans">`.

- [ ] **Step 1: Create the Header component**

```tsx
// src/components/layout/Header.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function Header() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-black/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white"
        >
          Nerona
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/pricing"
            className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          >
            Pricing
          </Link>
          {session?.user ? (
            <>
              <Link
                href="/account"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                Account
              </Link>
              <a href="/api/auth/signout" className="font-medium text-gray-900 dark:text-white">
                Sign out
              </a>
            </>
          ) : (
            <Link href="/login" className="font-medium text-gray-900 dark:text-white">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create the Footer component**

```tsx
// src/components/layout/Footer.tsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 px-6 py-10 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
      <p className="font-semibold text-gray-900 dark:text-white">Nerona</p>
      <p className="mt-2">&copy; {new Date().getFullYear()} Nerona. All rights reserved.</p>
      <div className="mt-4 flex justify-center gap-4">
        <Link href="/pricing" className="hover:text-gray-900 dark:hover:text-white">
          Pricing
        </Link>
        <Link href="/login" className="hover:text-gray-900 dark:hover:text-white">
          Sign in
        </Link>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Wire Header/Footer and the Inter font into the root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Nerona Metadata",
  description: "License management and orders for the Nerona Metadata extension.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Register the Inter font variable in Tailwind**

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify in a running dev server**

Use the Verification Helper above, then:

```bash
curl -s http://localhost:3000/ | grep -o 'Pricing'
curl -s http://localhost:3000/ | grep -o 'Sign in'
curl -s http://localhost:3000/login | grep -o 'Nerona'
curl -s http://localhost:3000/pricing | grep -o 'Nerona'
```

Expected: each command prints at least one match — confirms the Header now renders on `/`, `/login`, and `/pricing`, and shows "Sign in" (no active session) plus the "Pricing" nav link. Stop the dev server afterward per the helper.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Header.tsx src/components/layout/Footer.tsx src/app/layout.tsx tailwind.config.ts
git commit -m "Add shared Header/Footer and Inter font to root layout"
```

---

### Task 2: CtaLink + Hero, replace homepage content

**Files:**
- Create: `src/components/marketing/CtaLink.tsx`
- Create: `src/components/marketing/Hero.tsx`
- Modify: `src/app/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: nothing from Task 1's code directly (Header/Footer wrap automatically via the layout).
- Produces: `CtaLink({ href: string, tone?: "onDark" | "onLight", children: ReactNode })` — default `tone` is `"onLight"` (dark pill for light backgrounds); `"onDark"` renders a white pill for dark backgrounds. `Hero()` — no props, renders the dark hero band with the "Get Nerona" CTA linking to `/pricing`.

- [ ] **Step 1: Create CtaLink**

```tsx
// src/components/marketing/CtaLink.tsx
import Link from "next/link";

interface CtaLinkProps {
  href: string;
  tone?: "onDark" | "onLight";
  children: React.ReactNode;
}

export function CtaLink({ href, tone = "onLight", children }: CtaLinkProps) {
  const base = "inline-block rounded-full px-6 py-2.5 text-sm font-medium transition";
  const styles =
    tone === "onDark"
      ? "bg-white text-gray-900 hover:bg-gray-100"
      : "bg-gray-900 text-white hover:opacity-90";

  return (
    <Link href={href} className={`${base} ${styles}`}>
      {children}
    </Link>
  );
}
```

- [ ] **Step 2: Create Hero**

```tsx
// src/components/marketing/Hero.tsx
import { CtaLink } from "./CtaLink";

export function Hero() {
  return (
    <section className="bg-gray-900 px-6 py-24 text-center text-white sm:py-32">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Metadata for stock contributors, written for you.
        </h1>
        <p className="mt-6 text-lg text-gray-300 sm:text-xl">
          Nerona generates titles, descriptions, and keywords with AI, then fills them straight
          into your upload forms.
        </p>
        <div className="mt-10">
          <CtaLink href="/pricing" tone="onDark">
            Get Nerona
          </CtaLink>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Replace the homepage with the Hero**

```tsx
// src/app/page.tsx
import { Hero } from "@/components/marketing/Hero";

export default function HomePage() {
  return (
    <main>
      <Hero />
    </main>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Verify in a running dev server**

Use the Verification Helper, then:

```bash
curl -s http://localhost:3000/ | grep -o 'Get Nerona'
curl -s http://localhost:3000/ | grep -o 'Metadata for stock contributors, written for you.'
```

Expected: both strings found. Stop the dev server afterward.

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/CtaLink.tsx src/components/marketing/Hero.tsx src/app/page.tsx
git commit -m "Add Hero and CtaLink, replace homepage placeholder content"
```

---

### Task 3: FeatureSection + Feature 1 & 2 (metadata generation, one-click apply)

**Files:**
- Create: `src/components/marketing/FeatureSection.tsx`
- Create: `src/components/marketing/mockups/MetadataCardMockup.tsx`
- Create: `src/components/marketing/mockups/MarketplaceTabsMockup.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `Hero` from Task 2 (`src/app/page.tsx` already renders `<Hero />` inside `<main>`; this task appends after it, it does not replace it).
- Produces: `FeatureSection({ title: string, body: string, mockup: ReactNode, theme: "light" | "dark", imageSide: "left" | "right" })`. `MetadataCardMockup()` and `MarketplaceTabsMockup()` — no props.

- [ ] **Step 1: Create FeatureSection**

```tsx
// src/components/marketing/FeatureSection.tsx
interface FeatureSectionProps {
  title: string;
  body: string;
  mockup: React.ReactNode;
  theme: "light" | "dark";
  imageSide: "left" | "right";
}

export function FeatureSection({ title, body, mockup, theme, imageSide }: FeatureSectionProps) {
  const isDark = theme === "dark";
  const sectionClass = isDark ? "bg-gray-900 text-white" : "bg-white text-gray-900";
  const bodyClass = isDark ? "text-gray-300" : "text-gray-600";

  return (
    <section className={`${sectionClass} px-6 py-20 sm:py-28`}>
      <div
        className={`mx-auto flex max-w-5xl flex-col items-center gap-12 md:flex-row ${
          imageSide === "left" ? "md:flex-row-reverse" : ""
        }`}
      >
        <div className="flex-1">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
          <p className={`mt-4 text-lg ${bodyClass}`}>{body}</p>
        </div>
        <div className="flex-1">{mockup}</div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create the metadata card mockup (Feature 1)**

```tsx
// src/components/marketing/mockups/MetadataCardMockup.tsx
const KEYWORDS = ["skyline", "golden hour", "aerial view", "coastal city", "harbor"];

export function MetadataCardMockup() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        Generated metadata
      </p>
      <p className="mt-3 text-sm font-semibold text-gray-900">
        Golden hour skyline over a coastal city
      </p>
      <p className="mt-2 text-sm text-gray-600">
        Aerial view of a modern coastal skyline bathed in warm golden-hour light, with calm
        harbor waters reflecting the buildings.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {KEYWORDS.map((word) => (
          <span key={word} className="rounded-full bg-gray-900 px-3 py-1 text-xs text-white">
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the marketplace tabs mockup (Feature 2)**

```tsx
// src/components/marketing/mockups/MarketplaceTabsMockup.tsx
const MARKETPLACES = ["Adobe Stock", "Freepik", "Vecteezy", "Shutterstock"];

export function MarketplaceTabsMockup() {
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6">
      <div className="flex gap-2">
        {MARKETPLACES.map((name, index) => (
          <span
            key={name}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              index === 0 ? "bg-white text-gray-900" : "bg-gray-700 text-gray-300"
            }`}
          >
            {name}
          </span>
        ))}
      </div>
      <div className="mt-4 space-y-2 rounded-xl bg-gray-900 p-4">
        <div className="h-2 w-2/3 rounded bg-gray-600" />
        <div className="h-2 w-full rounded bg-gray-600" />
        <div className="h-2 w-1/2 rounded bg-gray-600" />
      </div>
      <p className="mt-3 text-xs text-gray-400">
        Apply Metadata → fills the Adobe Stock upload form directly.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Append Feature 1 & 2 to the homepage**

```tsx
// src/app/page.tsx
import { Hero } from "@/components/marketing/Hero";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { MetadataCardMockup } from "@/components/marketing/mockups/MetadataCardMockup";
import { MarketplaceTabsMockup } from "@/components/marketing/mockups/MarketplaceTabsMockup";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <FeatureSection
        title="Write once, skip the typing."
        body="AI drafts a title, description, and 30 keywords for every image you upload."
        mockup={<MetadataCardMockup />}
        theme="light"
        imageSide="right"
      />
      <FeatureSection
        title="One click. Every marketplace."
        body="Works directly on Adobe Stock, Freepik, Vecteezy, and Shutterstock's own upload forms — no copy-paste."
        mockup={<MarketplaceTabsMockup />}
        theme="dark"
        imageSide="left"
      />
    </main>
  );
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify in a running dev server**

Use the Verification Helper, then:

```bash
curl -s http://localhost:3000/ | grep -o 'Write once, skip the typing.'
curl -s http://localhost:3000/ | grep -o 'One click. Every marketplace.'
curl -s http://localhost:3000/ | grep -o 'Golden hour skyline over a coastal city'
```

Expected: all three found. Stop the dev server afterward.

- [ ] **Step 7: Commit**

```bash
git add src/components/marketing/FeatureSection.tsx src/components/marketing/mockups/MetadataCardMockup.tsx src/components/marketing/mockups/MarketplaceTabsMockup.tsx src/app/page.tsx
git commit -m "Add FeatureSection and first two feature blocks to homepage"
```

---

### Task 4: Feature 3 & 4 (keywords, batch processing)

**Files:**
- Create: `src/components/marketing/mockups/KeywordChipsMockup.tsx`
- Create: `src/components/marketing/mockups/BatchProgressMockup.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `FeatureSection({ title, body, mockup, theme, imageSide })` from Task 3, exactly as defined there.
- Produces: `KeywordChipsMockup()`, `BatchProgressMockup()` — no props.

- [ ] **Step 1: Create the keyword chips mockup (Feature 3)**

```tsx
// src/components/marketing/mockups/KeywordChipsMockup.tsx
const KEYWORDS = [
  "skyline",
  "golden hour",
  "aerial view",
  "coastal city",
  "harbor",
  "travel",
  "sunset",
  "architecture",
  "waterfront",
  "cityscape",
];

export function KeywordChipsMockup() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        30 keywords, ready to edit
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {KEYWORDS.map((word) => (
          <span
            key={word}
            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700"
          >
            {word}
          </span>
        ))}
        <span className="rounded-full border border-dashed border-gray-400 px-3 py-1 text-xs text-gray-500">
          + add your own
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the batch progress mockup (Feature 4)**

```tsx
// src/components/marketing/mockups/BatchProgressMockup.tsx
const BATCH_ITEMS = [
  { name: "IMG_0148.jpg", status: "Done" },
  { name: "IMG_0149.jpg", status: "Done" },
  { name: "IMG_0150.jpg", status: "Analyzing…" },
  { name: "IMG_0151.jpg", status: "Queued" },
];

export function BatchProgressMockup() {
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Batch progress</p>
      <div className="mt-3 space-y-2">
        {BATCH_ITEMS.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-sm">
            <span className="text-gray-200">{item.name}</span>
            <span
              className={
                item.status === "Done"
                  ? "text-green-400"
                  : item.status === "Analyzing…"
                    ? "text-yellow-400"
                    : "text-gray-500"
              }
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Append Feature 3 & 4 to the homepage**

```tsx
// src/app/page.tsx
import { Hero } from "@/components/marketing/Hero";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { MetadataCardMockup } from "@/components/marketing/mockups/MetadataCardMockup";
import { MarketplaceTabsMockup } from "@/components/marketing/mockups/MarketplaceTabsMockup";
import { KeywordChipsMockup } from "@/components/marketing/mockups/KeywordChipsMockup";
import { BatchProgressMockup } from "@/components/marketing/mockups/BatchProgressMockup";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <FeatureSection
        title="Write once, skip the typing."
        body="AI drafts a title, description, and 30 keywords for every image you upload."
        mockup={<MetadataCardMockup />}
        theme="light"
        imageSide="right"
      />
      <FeatureSection
        title="One click. Every marketplace."
        body="Works directly on Adobe Stock, Freepik, Vecteezy, and Shutterstock's own upload forms — no copy-paste."
        mockup={<MarketplaceTabsMockup />}
        theme="dark"
        imageSide="left"
      />
      <FeatureSection
        title="Keywords that keep pace."
        body="30 AI-generated keywords plus room for your own, kept consistent across every upload."
        mockup={<KeywordChipsMockup />}
        theme="light"
        imageSide="right"
      />
      <FeatureSection
        title="Built for batches."
        body="Pick multiple images, watch progress per image, and apply across every open marketplace tab at once."
        mockup={<BatchProgressMockup />}
        theme="dark"
        imageSide="left"
      />
    </main>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Verify in a running dev server**

Use the Verification Helper, then:

```bash
curl -s http://localhost:3000/ | grep -o 'Keywords that keep pace.'
curl -s http://localhost:3000/ | grep -o 'Built for batches.'
curl -s http://localhost:3000/ | grep -o 'IMG_0148.jpg'
```

Expected: all three found. Stop the dev server afterward.

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/mockups/KeywordChipsMockup.tsx src/components/marketing/mockups/BatchProgressMockup.tsx src/app/page.tsx
git commit -m "Add remaining two feature blocks to homepage"
```

---

### Task 5: MarketplaceRow + PricingTeaser, complete the homepage

**Files:**
- Create: `src/components/marketing/MarketplaceRow.tsx`
- Create: `src/components/marketing/PricingTeaser.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `CtaLink({ href, tone?, children })` from Task 2, exactly as defined there (default `tone` is fine here — light background section).
- Produces: `MarketplaceRow()`, `PricingTeaser()` — no props.

- [ ] **Step 1: Create MarketplaceRow**

```tsx
// src/components/marketing/MarketplaceRow.tsx
const MARKETPLACES = ["Adobe Stock", "Freepik", "Vecteezy", "Shutterstock"];

export function MarketplaceRow() {
  return (
    <section className="bg-gray-100 px-6 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
        Works where you already upload
      </p>
      <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {MARKETPLACES.map((name) => (
          <span key={name} className="text-lg font-semibold text-gray-700">
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create PricingTeaser**

```tsx
// src/components/marketing/PricingTeaser.tsx
import { CtaLink } from "./CtaLink";

export function PricingTeaser() {
  return (
    <section className="bg-white px-6 py-20 text-center sm:py-28">
      <div className="mx-auto max-w-xl">
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
          One plan. Every marketplace.
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          A single Nerona Pro subscription covers every supported marketplace, billed monthly
          or yearly.
        </p>
        <div className="mt-8">
          <CtaLink href="/pricing">See pricing</CtaLink>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Append both to the homepage, completing it**

```tsx
// src/app/page.tsx
import { Hero } from "@/components/marketing/Hero";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { MetadataCardMockup } from "@/components/marketing/mockups/MetadataCardMockup";
import { MarketplaceTabsMockup } from "@/components/marketing/mockups/MarketplaceTabsMockup";
import { KeywordChipsMockup } from "@/components/marketing/mockups/KeywordChipsMockup";
import { BatchProgressMockup } from "@/components/marketing/mockups/BatchProgressMockup";
import { MarketplaceRow } from "@/components/marketing/MarketplaceRow";
import { PricingTeaser } from "@/components/marketing/PricingTeaser";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <FeatureSection
        title="Write once, skip the typing."
        body="AI drafts a title, description, and 30 keywords for every image you upload."
        mockup={<MetadataCardMockup />}
        theme="light"
        imageSide="right"
      />
      <FeatureSection
        title="One click. Every marketplace."
        body="Works directly on Adobe Stock, Freepik, Vecteezy, and Shutterstock's own upload forms — no copy-paste."
        mockup={<MarketplaceTabsMockup />}
        theme="dark"
        imageSide="left"
      />
      <FeatureSection
        title="Keywords that keep pace."
        body="30 AI-generated keywords plus room for your own, kept consistent across every upload."
        mockup={<KeywordChipsMockup />}
        theme="light"
        imageSide="right"
      />
      <FeatureSection
        title="Built for batches."
        body="Pick multiple images, watch progress per image, and apply across every open marketplace tab at once."
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

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Verify in a running dev server**

Use the Verification Helper, then:

```bash
curl -s http://localhost:3000/ | grep -o 'Works where you already upload'
curl -s http://localhost:3000/ | grep -o 'One plan. Every marketplace.'
curl -s http://localhost:3000/ | grep -o 'See pricing'
```

Expected: all three found. Stop the dev server afterward.

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/MarketplaceRow.tsx src/components/marketing/PricingTeaser.tsx src/app/page.tsx
git commit -m "Add marketplace row and pricing teaser, complete homepage"
```

---

### Task 6: Whole-page verification pass

**Files:** none (verification only — no code changes expected).

**Interfaces:**
- Consumes: the fully assembled `src/app/page.tsx` from Task 5, and `Header`/`Footer` from Task 1.

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: exit code 0, no type or lint errors. This also confirms the `next/font/google` Inter import resolves correctly.

- [ ] **Step 2: Signed-out content sweep**

Use the Verification Helper, then:

```bash
curl -s http://localhost:3000/ | grep -o -E 'Get Nerona|Write once, skip the typing.|One click. Every marketplace.|Keywords that keep pace.|Built for batches.|Works where you already upload|One plan. Every marketplace.|See pricing'
```

Expected: all eight strings present, confirming the full homepage renders top to bottom.

- [ ] **Step 3: Cross-page Header/Footer spot check**

```bash
curl -s http://localhost:3000/pricing | grep -o -E 'Nerona|Pricing|Sign in'
curl -s http://localhost:3000/login | grep -o -E 'Nerona|Pricing|Sign in'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/account
```

Expected: `/pricing` and `/login` both return 200 and contain the shared Header's "Nerona" logo link, "Pricing" nav link, and "Sign in" link — confirms wrapping them with the new Header/Footer didn't break either page. `/account` (visited signed-out) should redirect rather than 500 — `requireUser()` in `src/app/account/page.tsx` sends signed-out visitors to sign-in, so expect a 307/302, not 200 or 500. Stop the dev server afterward.

- [ ] **Step 4: Leave a note for manual human verification**

These two checks need a live authenticated session / real browser viewport and can't be scripted here — add this note to the task report so the human knows what's left, matching this repo's existing convention (see `.superpowers/sdd/progress.md`) of flagging human-only checks instead of skipping them silently:

- Sign in with a real account, reload `/`, and confirm the Header shows "Account" + "Sign out" instead of "Sign in".
- Resize the browser to a mobile width (e.g. 375px) and confirm each `FeatureSection` stacks the mockup below the text instead of side-by-side.

No commit needed for this task — it produces no file changes (assuming Steps 1-3 pass with no fixes required).
