# Checkout & License Issuance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user buy a "Pro" subscription via Stripe Checkout, have a license key generated and emailed automatically, and see/manage that license and their billing from `/account`.

**Architecture:** A `/pricing` page starts a Stripe Checkout Session via a thin authenticated API route; a signature-verified webhook route (`/api/webhooks/stripe`) is the only writer of `Subscription`/`License`/`Order` state, dispatching to small testable handler functions in `src/lib/stripe-webhooks.ts`. `/account` reads whatever's currently in the database — no polling. All business logic lives in `src/lib/*.ts` modules consumed by thin routes/pages, the same pattern used throughout this project.

**Tech Stack:** `stripe` (Node SDK — Checkout, Billing Portal, webhook signature verification), Prisma (existing), Resend (existing, reused for the license email), Vitest (existing).

## Global Constraints

- Stripe webhooks are the source of truth for subscription/license state — this project never polls the Stripe API to determine current status outside of a webhook delivery.
- `License.status` values are `"active" | "revoked" | "comp" | "expired"` — this phase only ever writes `"active"` and `"expired"`; `"revoked"`/`"comp"` remain reserved for a future admin panel and must never be set by any code in this plan.
- The past-due grace period is exactly 3 days, expressed as a named constant (`PAST_DUE_GRACE_MS`), never a bare number in comparison logic.
- Every Stripe Checkout Session this app creates must lock `customer_email` to the authenticated user's own session email — never accept a client-supplied email for checkout, so the webhook can always resolve the session back to the right `User`.
- Only one `Plan` row exists at launch ("Pro") — code must still look it up by matching Stripe price IDs (never by assuming there's exactly one row / hardcoding an id), since a second tier is expected later with no code changes.
- `Order` rows are write-only in this phase — nothing reads them yet; don't build any read path for `Order`.
- When a webhook's license find-or-create logic reuses an existing `License` row, only `status`, `planId`, and `validUntil` may be overwritten — `source`, `grantedById`, and `notes` must be left untouched, so a future manually-granted license survives a customer later subscribing via Stripe.

---

### Task 1: Prisma schema — subscription tracking fields

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Subscription.pastDueSince DateTime?`, `Subscription.stripeCustomerId String`. Consumed by Task 11 (webhook ongoing-sync handlers) and Task 13 (billing portal).

- [ ] **Step 1: Add the two new fields to the `Subscription` model**

In `prisma/schema.prisma`, find the `Subscription` model and add `stripeCustomerId` and
`pastDueSince`:

```prisma
model Subscription {
  id                   String    @id @default(cuid())
  userId               String
  user                 User      @relation(fields: [userId], references: [id])
  planId               String
  plan                 Plan      @relation(fields: [planId], references: [id])
  stripeSubscriptionId String    @unique
  stripeCustomerId     String
  status               String    // "active" | "trialing" | "past_due" | "canceled"
  currentPeriodEnd     DateTime
  pastDueSince         DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@map("subscriptions")
}
```

(Leave every other model in the file exactly as it is.)

- [ ] **Step 2: Run the migration**

Run: `npm run prisma:migrate -- --name add_subscription_tracking_fields`
Expected: output ends with `Your database is now in sync with your schema.`, and a new folder
appears under `prisma/migrations/`.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add stripeCustomerId and pastDueSince to Subscription"
```

---

### Task 2: Stripe SDK, shared base-URL helper, and environment setup

**Files:**
- Create: `src/lib/base-url.ts`
- Modify: `src/lib/mail.ts`
- Create: `src/lib/stripe.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces: `baseUrl(): string` (exported, replaces the private copy in `mail.ts`), `stripe`
  (a configured `Stripe` client instance). Consumed by Tasks 6, 7, 10, 11, 13.

- [ ] **Step 1: Install the Stripe SDK**

Run: `npm install stripe`

- [ ] **Step 2: Extract the shared `baseUrl()` helper**

Create `src/lib/base-url.ts`:

```ts
export function baseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}
```

- [ ] **Step 3: Update `mail.ts` to use the shared helper**

In `src/lib/mail.ts`, remove the local `baseUrl` function and import the shared one instead.
Replace the full contents of `src/lib/mail.ts`:

```ts
import { Resend } from "resend";
import { baseUrl } from "./base-url";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || "Nerona <onboarding@resend.dev>";

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const link = `${baseUrl()}/verify-email?token=${token}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Verify your Nerona account",
    html: `<p>Click the link below to verify your email address:</p><p><a href="${link}">${link}</a></p>`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const link = `${baseUrl()}/reset-password/${token}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Reset your Nerona password",
    html: `<p>Click the link below to reset your password (expires in 1 hour):</p><p><a href="${link}">${link}</a></p>`,
  });
}
```

- [ ] **Step 4: Run the existing mail tests to confirm nothing broke**

Run: `npx vitest run tests/lib/mail.test.ts`
Expected: PASS — 2 passed (these test behavior, not the internal helper, so they still pass
unchanged).

- [ ] **Step 5: Create the Stripe client singleton**

Create `src/lib/stripe.ts`:

```ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});
```

- [ ] **Step 6: Add the new environment variables to `.env.example`**

Append to `.env.example`:

```
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRICE_ID_MONTHLY=""
STRIPE_PRICE_ID_YEARLY=""
```

- [ ] **Step 7: Document the Stripe account setup in `README.md`**

In `README.md`, add a new numbered step to the Setup section (after the existing Resend step),
and add the corresponding env var descriptions to the bulleted list above it:

```
   - `STRIPE_SECRET_KEY` — from https://dashboard.stripe.com (test mode) → Developers → API
     keys.
   - `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_YEARLY` — create one product ("Nerona Pro")
     with a monthly and a yearly recurring price in test mode, then copy each price's ID.
   - `STRIPE_WEBHOOK_SECRET` — run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
     (requires the Stripe CLI: https://stripe.com/docs/stripe-cli) and copy the webhook signing
     secret it prints. This secret is only valid for that `stripe listen` session — a real
     deployed webhook endpoint gets its own secret from the dashboard later, not needed for
     local development.
```

Add this as a new step between the existing Resend step and the `npm install` step, renumbering
the remaining steps accordingly.

- [ ] **Step 8: Add your own real values to `.env.local`**

Add the four new keys from Step 6 to your own `.env.local` with real test-mode values (this
file is gitignored — do not commit it).

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/lib/base-url.ts src/lib/mail.ts src/lib/stripe.ts .env.example README.md package.json package-lock.json
git commit -m "Add Stripe SDK, shared base-URL helper, and env var wiring"
```

---

### Task 3: License key generator

**Files:**
- Create: `src/lib/license.ts`
- Test: `tests/lib/license.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts`.
- Produces: `generateLicenseKey(): Promise<string>`. Consumed by Task 10
  (`handleCheckoutSessionCompleted`).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/license.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    license: { findUnique: vi.fn() },
  },
}));

import { generateLicenseKey } from "@/lib/license";
import { prisma } from "@/lib/prisma";

describe("generateLicenseKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces a key matching the NERONA-XXXX-XXXX-XXXX format", async () => {
    (prisma.license.findUnique as any).mockResolvedValue(null);

    const key = await generateLicenseKey();

    expect(key).toMatch(/^NERONA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("retries generation when the first candidate already exists", async () => {
    (prisma.license.findUnique as any)
      .mockResolvedValueOnce({ id: "existing-license" })
      .mockResolvedValueOnce(null);

    const key = await generateLicenseKey();

    expect(prisma.license.findUnique).toHaveBeenCalledTimes(2);
    expect(key).toMatch(/^NERONA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/license.test.ts`
Expected: FAIL — `@/lib/license` does not exist yet.

- [ ] **Step 3: Implement `src/lib/license.ts`**

```ts
import crypto from "node:crypto";
import { prisma } from "./prisma";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomGroup(length: number): string {
  let result = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}

function candidateKey(): string {
  return `NERONA-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}`;
}

export async function generateLicenseKey(): Promise<string> {
  let key = candidateKey();
  while (await prisma.license.findUnique({ where: { licenseKey: key } })) {
    key = candidateKey();
  }
  return key;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/license.test.ts`
Expected: PASS — 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/license.ts tests/lib/license.test.ts
git commit -m "Add license key generator"
```

---

### Task 4: License status helper (grace-period logic)

**Files:**
- Create: `src/lib/license-status.ts`
- Test: `tests/lib/license-status.test.ts`

**Interfaces:**
- Produces: `PAST_DUE_GRACE_MS: number`,
  `computeLicenseStatus(input: { subscriptionStatus: string; pastDueSince: Date | null; now: Date }): "active" | "expired"`.
  Consumed by Task 11 (`handleSubscriptionUpdated`).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/license-status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeLicenseStatus, PAST_DUE_GRACE_MS } from "@/lib/license-status";

describe("computeLicenseStatus", () => {
  it("is active when the subscription is active", () => {
    const result = computeLicenseStatus({
      subscriptionStatus: "active",
      pastDueSince: null,
      now: new Date("2026-01-10"),
    });
    expect(result).toBe("active");
  });

  it("is active when the subscription is trialing", () => {
    const result = computeLicenseStatus({
      subscriptionStatus: "trialing",
      pastDueSince: null,
      now: new Date("2026-01-10"),
    });
    expect(result).toBe("active");
  });

  it("is active when past_due and still within the grace period", () => {
    const pastDueSince = new Date("2026-01-10T00:00:00Z");
    const now = new Date(pastDueSince.getTime() + PAST_DUE_GRACE_MS - 1000);
    const result = computeLicenseStatus({ subscriptionStatus: "past_due", pastDueSince, now });
    expect(result).toBe("active");
  });

  it("is expired when past_due and past the grace period", () => {
    const pastDueSince = new Date("2026-01-10T00:00:00Z");
    const now = new Date(pastDueSince.getTime() + PAST_DUE_GRACE_MS + 1000);
    const result = computeLicenseStatus({ subscriptionStatus: "past_due", pastDueSince, now });
    expect(result).toBe("expired");
  });

  it("is expired when canceled", () => {
    const result = computeLicenseStatus({
      subscriptionStatus: "canceled",
      pastDueSince: null,
      now: new Date("2026-01-10"),
    });
    expect(result).toBe("expired");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/license-status.test.ts`
Expected: FAIL — `@/lib/license-status` does not exist yet.

- [ ] **Step 3: Implement `src/lib/license-status.ts`**

```ts
export const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export function computeLicenseStatus({
  subscriptionStatus,
  pastDueSince,
  now,
}: {
  subscriptionStatus: string;
  pastDueSince: Date | null;
  now: Date;
}): "active" | "expired" {
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return "active";
  }
  if (subscriptionStatus === "past_due" && pastDueSince) {
    const withinGrace = now.getTime() - pastDueSince.getTime() < PAST_DUE_GRACE_MS;
    return withinGrace ? "active" : "expired";
  }
  return "expired";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/license-status.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/license-status.ts tests/lib/license-status.test.ts
git commit -m "Add license status grace-period helper"
```

---

### Task 5: Seed script — upsert the "Pro" Plan row

**Files:**
- Modify: `prisma/seed.ts`

**Interfaces:**
- Consumes: `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_YEARLY` from `.env.local` (Task 2).
- Produces: a `Plan` row named `"Pro"`. Consumed by Task 7 (`createCheckoutSession` looks it up
  by price ID) and Task 10/11 (webhook handlers look it up by price ID).

- [ ] **Step 1: Add the Plan upsert to `prisma/seed.ts`**

Replace the full contents of `prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ownerEmail = process.env.OWNER_ADMIN_EMAIL;
  if (!ownerEmail) {
    throw new Error("Set OWNER_ADMIN_EMAIL in .env.local before running the seed script.");
  }

  const user = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: { email: ownerEmail },
  });

  await prisma.adminRole.upsert({
    where: { userId: user.id },
    update: { role: "owner_admin" },
    create: { userId: user.id, role: "owner_admin" },
  });

  console.log(`Granted owner_admin to ${ownerEmail}`);

  const priceIdMonthly = process.env.STRIPE_PRICE_ID_MONTHLY;
  const priceIdYearly = process.env.STRIPE_PRICE_ID_YEARLY;
  if (!priceIdMonthly || !priceIdYearly) {
    throw new Error(
      "Set STRIPE_PRICE_ID_MONTHLY and STRIPE_PRICE_ID_YEARLY in .env.local before running the seed script."
    );
  }

  const existingPlan = await prisma.plan.findFirst({ where: { name: "Pro" } });
  if (existingPlan) {
    await prisma.plan.update({
      where: { id: existingPlan.id },
      data: { stripePriceIdMonthly: priceIdMonthly, stripePriceIdYearly: priceIdYearly },
    });
  } else {
    await prisma.plan.create({
      data: {
        name: "Pro",
        stripePriceIdMonthly: priceIdMonthly,
        stripePriceIdYearly: priceIdYearly,
        marketplaces: "*",
        rejectAnalyzer: true,
      },
    });
  }

  console.log("Seeded Pro plan");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Run the seed script**

Run: `npm run prisma:seed`
Expected: output includes `Granted owner_admin to ...` and `Seeded Pro plan`.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "Seed the Pro plan from Stripe price env vars"
```

---

### Task 6: License email helper

**Files:**
- Modify: `src/lib/mail.ts`
- Modify: `tests/lib/mail.test.ts`

**Interfaces:**
- Produces: `sendLicenseEmail(email: string, licenseKey: string): Promise<void>`. Consumed by
  Task 10 (`handleCheckoutSessionCompleted`).

- [ ] **Step 1: Write the failing test (extends the existing test file)**

Add this `describe` block to the end of `tests/lib/mail.test.ts` (keep everything else in the
file unchanged):

```ts
describe("sendLicenseEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an email containing the license key", async () => {
    await sendLicenseEmail("user@example.com", "NERONA-AB12-CD34-EF56");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.html).toContain("NERONA-AB12-CD34-EF56");
  });
});
```

Add `sendLicenseEmail` to the existing import line at the top of the file:

```ts
import { sendLicenseEmail, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/mail";
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `npx vitest run tests/lib/mail.test.ts`
Expected: FAIL — `sendLicenseEmail` is not exported yet.

- [ ] **Step 3: Add `sendLicenseEmail` to `src/lib/mail.ts`**

Append this function to `src/lib/mail.ts` (leave everything else in the file unchanged):

```ts
export async function sendLicenseEmail(email: string, licenseKey: string): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Your Nerona Pro license key",
    html: `<p>Thanks for subscribing to Nerona Pro! Your license key is:</p><p><code>${licenseKey}</code></p><p>Paste it into the extension popup to activate it. You can view it any time from your <a href="${baseUrl()}/account">account page</a>.</p>`,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/mail.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mail.ts tests/lib/mail.test.ts
git commit -m "Add sendLicenseEmail helper"
```

---

### Task 7: Checkout session creation logic

**Files:**
- Create: `src/lib/checkout.ts`
- Test: `tests/lib/checkout.test.ts`

**Interfaces:**
- Consumes: `stripe` (Task 2), `prisma`, `baseUrl` (Task 2).
- Produces: `type CheckoutInterval = "monthly" | "yearly"`,
  `createCheckoutSession(email: string, interval: CheckoutInterval): Promise<{ url: string } | null>`.
  Consumed by Task 8 (`POST /api/checkout`).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/checkout.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plan: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
  },
}));

import { createCheckoutSession } from "@/lib/checkout";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no Plan row exists", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue(null);

    const result = await createCheckoutSession("user@example.com", "monthly");

    expect(result).toBeNull();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("creates a subscription-mode session with the monthly price and the user's locked email", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue({
      id: "plan-1",
      stripePriceIdMonthly: "price_monthly",
      stripePriceIdYearly: "price_yearly",
    });
    (stripe.checkout.sessions.create as any).mockResolvedValue({ url: "https://checkout.stripe.com/session-1" });

    const result = await createCheckoutSession("user@example.com", "monthly");

    expect(result).toEqual({ url: "https://checkout.stripe.com/session-1" });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer_email: "user@example.com",
        line_items: [{ price: "price_monthly", quantity: 1 }],
      })
    );
  });

  it("uses the yearly price when interval is yearly", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue({
      id: "plan-1",
      stripePriceIdMonthly: "price_monthly",
      stripePriceIdYearly: "price_yearly",
    });
    (stripe.checkout.sessions.create as any).mockResolvedValue({ url: "https://checkout.stripe.com/session-2" });

    await createCheckoutSession("user@example.com", "yearly");

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ line_items: [{ price: "price_yearly", quantity: 1 }] })
    );
  });

  it("returns null when Stripe doesn't return a session URL", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue({
      id: "plan-1",
      stripePriceIdMonthly: "price_monthly",
      stripePriceIdYearly: "price_yearly",
    });
    (stripe.checkout.sessions.create as any).mockResolvedValue({ url: null });

    const result = await createCheckoutSession("user@example.com", "monthly");

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/checkout.test.ts`
Expected: FAIL — `@/lib/checkout` does not exist yet.

- [ ] **Step 3: Implement `src/lib/checkout.ts`**

```ts
import { stripe } from "./stripe";
import { prisma } from "./prisma";
import { baseUrl } from "./base-url";

export type CheckoutInterval = "monthly" | "yearly";

export async function createCheckoutSession(
  email: string,
  interval: CheckoutInterval
): Promise<{ url: string } | null> {
  const plan = await prisma.plan.findFirst();
  if (!plan) {
    return null;
  }

  const priceId = interval === "monthly" ? plan.stripePriceIdMonthly : plan.stripePriceIdYearly;
  if (!priceId) {
    return null;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl()}/account`,
    cancel_url: `${baseUrl()}/pricing`,
  });

  if (!session.url) {
    return null;
  }
  return { url: session.url };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/checkout.test.ts`
Expected: PASS — 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/checkout.ts tests/lib/checkout.test.ts
git commit -m "Add checkout session creation logic"
```

---

### Task 8: `POST /api/checkout` route

**Files:**
- Create: `src/app/api/checkout/route.ts`

**Interfaces:**
- Consumes: `createCheckoutSession` (Task 7), `authOptions` (existing, `src/lib/auth.ts`).

- [ ] **Step 1: Create `src/app/api/checkout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCheckoutSession, type CheckoutInterval } from "@/lib/checkout";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const interval: CheckoutInterval = body?.interval === "yearly" ? "yearly" : "monthly";

  const result = await createCheckoutSession(session.user.email, interval);
  if (!result) {
    return NextResponse.json({ ok: false, message: "Unable to start checkout." }, { status: 400 });
  }
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify the route requires auth**

Run: `npm run dev`, then in another terminal:

```bash
curl -s -X POST http://localhost:3000/api/checkout -H "Content-Type: application/json" -d "{\"interval\":\"monthly\"}"
```

Expected: `{"ok":false}` with a 401 status (no session cookie sent). Stop the dev server once
confirmed.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/checkout/route.ts"
git commit -m "Add POST /api/checkout route"
```

---

### Task 9: Pricing page

**Files:**
- Create: `src/app/pricing/page.tsx`

**Interfaces:**
- Consumes: `AuthCard`/`AuthButton` (`src/components/auth/`, existing), `POST /api/checkout`
  (Task 8).

- [ ] **Step 1: Create `src/app/pricing/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthButton } from "@/components/auth/AuthButton";

export default function PricingPage() {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubscribe() {
    setError("");
    setLoading(true);

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval }),
    });

    if (res.status === 401) {
      window.location.href = "/login?callbackUrl=/pricing";
      return;
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.url) {
      setError(data?.message || "Something went wrong.");
      setLoading(false);
      return;
    }

    window.location.href = data.url;
  }

  return (
    <AuthCard title="Nerona Pro" subtitle="Full access across every supported marketplace.">
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setInterval("monthly")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            interval === "monthly"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
              : "border border-gray-300 text-gray-900 dark:border-gray-700 dark:text-white"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval("yearly")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            interval === "yearly"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
              : "border border-gray-300 text-gray-900 dark:border-gray-700 dark:text-white"
          }`}
        >
          Yearly
        </button>
      </div>

      {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}

      <div className="mt-6">
        <AuthButton onClick={handleSubscribe} disabled={loading}>
          {loading ? "Redirecting..." : `Subscribe (${interval})`}
        </AuthButton>
      </div>
    </AuthCard>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify**

Run: `npm run dev`, open `http://localhost:3000/pricing` — confirm the card renders with a
monthly/yearly toggle and a "Subscribe" button. While signed out, click "Subscribe" and confirm
you're redirected to `/login?callbackUrl=/pricing`. Stop the dev server once confirmed.

- [ ] **Step 4: Commit**

```bash
git add src/app/pricing/page.tsx
git commit -m "Add pricing page"
```

---

### Task 10: Webhook handler — checkout completed

**Files:**
- Create: `src/lib/stripe-webhooks.ts`
- Test: `tests/lib/stripe-webhooks.test.ts`

**Interfaces:**
- Consumes: `prisma`, `stripe` (Task 2), `generateLicenseKey` (Task 3), `sendLicenseEmail`
  (Task 6).
- Produces: `handleCheckoutSessionCompleted(session: import("stripe").Stripe.Checkout.Session): Promise<void>`.
  Consumed by Task 12 (webhook route).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/stripe-webhooks.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    plan: { findFirst: vi.fn() },
    license: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    order: { create: vi.fn() },
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn() },
  },
}));
vi.mock("@/lib/license", () => ({ generateLicenseKey: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendLicenseEmail: vi.fn() }));

import { handleCheckoutSessionCompleted } from "@/lib/stripe-webhooks";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { generateLicenseKey } from "@/lib/license";
import { sendLicenseEmail } from "@/lib/mail";

function fakeSession(overrides = {}) {
  return {
    id: "cs_1",
    subscription: "sub_1",
    customer: "cus_1",
    customer_email: "user@example.com",
    customer_details: { email: "user@example.com" },
    ...overrides,
  } as any;
}

function fakeStripeSubscription(overrides = {}) {
  return {
    id: "sub_1",
    status: "active",
    current_period_end: 1_800_000_000,
    items: { data: [{ price: { id: "price_monthly" } }] },
    ...overrides,
  } as any;
}

describe("handleCheckoutSessionCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no-ops when the Subscription already exists (redelivered event)", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue({ id: "existing-sub" });

    await handleCheckoutSessionCompleted(fakeSession());

    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(sendLicenseEmail).not.toHaveBeenCalled();
  });

  it("logs and returns when no User exists for the session's email", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue(null);
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await handleCheckoutSessionCompleted(fakeSession());

    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("creates a Subscription and a new License, then emails the key, on first completion", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue(null);
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1", email: "user@example.com" });
    (stripe.subscriptions.retrieve as any).mockResolvedValue(fakeStripeSubscription());
    (prisma.plan.findFirst as any).mockResolvedValue({ id: "plan-1" });
    (prisma.subscription.create as any).mockResolvedValue({ id: "subscription-row-1" });
    (prisma.license.findFirst as any).mockResolvedValue(null);
    (generateLicenseKey as any).mockResolvedValue("NERONA-AB12-CD34-EF56");
    (prisma.license.create as any).mockResolvedValue({ licenseKey: "NERONA-AB12-CD34-EF56" });

    await handleCheckoutSessionCompleted(fakeSession());

    expect(prisma.subscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        planId: "plan-1",
        stripeSubscriptionId: "sub_1",
        stripeCustomerId: "cus_1",
        status: "active",
      }),
    });
    expect(prisma.license.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        licenseKey: "NERONA-AB12-CD34-EF56",
        status: "active",
        source: "stripe",
        planId: "plan-1",
      }),
    });
    expect(sendLicenseEmail).toHaveBeenCalledWith("user@example.com", "NERONA-AB12-CD34-EF56");
  });

  it("reuses an existing License row instead of creating a duplicate", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue(null);
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1", email: "user@example.com" });
    (stripe.subscriptions.retrieve as any).mockResolvedValue(fakeStripeSubscription());
    (prisma.plan.findFirst as any).mockResolvedValue({ id: "plan-1" });
    (prisma.subscription.create as any).mockResolvedValue({ id: "subscription-row-1" });
    (prisma.license.findFirst as any).mockResolvedValue({
      id: "license-1",
      licenseKey: "NERONA-EXIST-ING1-KEY0",
    });
    (prisma.license.update as any).mockResolvedValue({ licenseKey: "NERONA-EXIST-ING1-KEY0" });

    await handleCheckoutSessionCompleted(fakeSession());

    expect(generateLicenseKey).not.toHaveBeenCalled();
    expect(prisma.license.create).not.toHaveBeenCalled();
    expect(prisma.license.update).toHaveBeenCalledWith({
      where: { id: "license-1" },
      data: expect.objectContaining({ status: "active", planId: "plan-1" }),
    });
    expect(sendLicenseEmail).toHaveBeenCalledWith("user@example.com", "NERONA-EXIST-ING1-KEY0");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/stripe-webhooks.test.ts`
Expected: FAIL — `@/lib/stripe-webhooks` does not exist yet.

- [ ] **Step 3: Implement `handleCheckoutSessionCompleted` in `src/lib/stripe-webhooks.ts`**

Create `src/lib/stripe-webhooks.ts`:

```ts
import type Stripe from "stripe";
import { prisma } from "./prisma";
import { stripe } from "./stripe";
import { generateLicenseKey } from "./license";
import { sendLicenseEmail } from "./mail";

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const stripeSubscriptionId = session.subscription as string;
  const stripeCustomerId = session.customer as string;
  const email = (session.customer_email || session.customer_details?.email || "").toLowerCase();

  const existingSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
  });
  if (existingSubscription) {
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`checkout.session.completed: no User found for email ${email}`);
    return;
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const priceId = stripeSubscription.items.data[0]?.price.id;
  const plan = await prisma.plan.findFirst({
    where: { OR: [{ stripePriceIdMonthly: priceId }, { stripePriceIdYearly: priceId }] },
  });
  if (!plan) {
    console.error(`checkout.session.completed: no Plan found for price ${priceId}`);
    return;
  }

  const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);

  await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      stripeSubscriptionId,
      stripeCustomerId,
      status: stripeSubscription.status,
      currentPeriodEnd,
    },
  });

  const existingLicense = await prisma.license.findFirst({ where: { userId: user.id } });

  let licenseKey: string;
  if (existingLicense) {
    const updated = await prisma.license.update({
      where: { id: existingLicense.id },
      data: { status: "active", planId: plan.id, validUntil: currentPeriodEnd },
    });
    licenseKey = updated.licenseKey;
  } else {
    licenseKey = await generateLicenseKey();
    const created = await prisma.license.create({
      data: {
        userId: user.id,
        licenseKey,
        status: "active",
        source: "stripe",
        planId: plan.id,
        validUntil: currentPeriodEnd,
      },
    });
    licenseKey = created.licenseKey;
  }

  await sendLicenseEmail(user.email, licenseKey);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/stripe-webhooks.test.ts`
Expected: PASS — 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stripe-webhooks.ts tests/lib/stripe-webhooks.test.ts
git commit -m "Add checkout.session.completed webhook handler"
```

---

### Task 11: Webhook handlers — ongoing subscription sync

**Files:**
- Modify: `src/lib/stripe-webhooks.ts`
- Modify: `tests/lib/stripe-webhooks.test.ts`

**Interfaces:**
- Consumes: `computeLicenseStatus`, `PAST_DUE_GRACE_MS` (Task 4).
- Produces: `handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void>`,
  `handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void>`,
  `handleInvoicePaid(invoice: Stripe.Invoice): Promise<void>`. Consumed by Task 12 (webhook
  route).

- [ ] **Step 1: Write the failing tests (append to the existing test file)**

Add these `describe` blocks to the end of `tests/lib/stripe-webhooks.test.ts` (keep everything
else in the file unchanged):

```ts
describe("handleSubscriptionUpdated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs and returns when no Subscription row is found", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue(null);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await handleSubscriptionUpdated({ id: "sub_missing", status: "active", current_period_end: 1_800_000_000 } as any);

    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("sets the license active and clears pastDueSince when status returns to active", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue({
      id: "subscription-row-1",
      userId: "user-1",
      pastDueSince: new Date("2026-01-01"),
    });

    await handleSubscriptionUpdated({
      id: "sub_1",
      status: "active",
      current_period_end: 1_800_000_000,
    } as any);

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "subscription-row-1" },
      data: expect.objectContaining({ status: "active", pastDueSince: null }),
    });
    expect(prisma.license.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: expect.objectContaining({ status: "active" }),
    });
  });

  it("sets pastDueSince on first past_due delivery and keeps the license active (within grace)", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue({
      id: "subscription-row-1",
      userId: "user-1",
      pastDueSince: null,
    });

    await handleSubscriptionUpdated({
      id: "sub_1",
      status: "past_due",
      current_period_end: 1_800_000_000,
    } as any);

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "subscription-row-1" },
      data: expect.objectContaining({ status: "past_due", pastDueSince: expect.any(Date) }),
    });
    expect(prisma.license.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: expect.objectContaining({ status: "active" }),
    });
  });

  it("expires the license once past_due has exceeded the grace period", async () => {
    const longAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    (prisma.subscription.findUnique as any).mockResolvedValue({
      id: "subscription-row-1",
      userId: "user-1",
      pastDueSince: longAgo,
    });

    await handleSubscriptionUpdated({
      id: "sub_1",
      status: "past_due",
      current_period_end: 1_800_000_000,
    } as any);

    expect(prisma.license.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: expect.objectContaining({ status: "expired" }),
    });
  });
});

describe("handleSubscriptionDeleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs and returns when no Subscription row is found", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue(null);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await handleSubscriptionDeleted({ id: "sub_missing" } as any);

    expect(prisma.subscription.update).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("marks the Subscription canceled and the License expired", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue({ id: "subscription-row-1", userId: "user-1" });

    await handleSubscriptionDeleted({ id: "sub_1" } as any);

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "subscription-row-1" },
      data: { status: "canceled" },
    });
    expect(prisma.license.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { status: "expired" },
    });
  });
});

describe("handleInvoicePaid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when the invoice has no subscription", async () => {
    await handleInvoicePaid({ id: "in_1", subscription: null } as any);

    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("logs and returns when no Subscription row is found", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue(null);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await handleInvoicePaid({ id: "in_1", subscription: "sub_missing" } as any);

    expect(prisma.order.create).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("creates an Order row for the invoice", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue({ id: "subscription-row-1", userId: "user-1" });

    await handleInvoicePaid({
      id: "in_1",
      subscription: "sub_1",
      amount_paid: 1200,
      currency: "usd",
      status: "paid",
    } as any);

    expect(prisma.order.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        stripeInvoiceId: "in_1",
        amount: 1200,
        currency: "usd",
        status: "paid",
        refunded: false,
      },
    });
  });
});
```

Update the test file's import line to include the three new functions:

```ts
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaid,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "@/lib/stripe-webhooks";
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run tests/lib/stripe-webhooks.test.ts`
Expected: FAIL — the three new handlers are not exported yet.

- [ ] **Step 3: Add the three handlers to `src/lib/stripe-webhooks.ts`**

Add this import to the top of `src/lib/stripe-webhooks.ts`:

```ts
import { computeLicenseStatus } from "./license-status";
```

Append these three functions to the end of `src/lib/stripe-webhooks.ts`:

```ts
export async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!existing) {
    console.error(`customer.subscription.updated: no Subscription row for ${subscription.id}`);
    return;
  }

  const now = new Date();
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const pastDueSince = subscription.status === "past_due" ? existing.pastDueSince ?? now : null;

  await prisma.subscription.update({
    where: { id: existing.id },
    data: { status: subscription.status, currentPeriodEnd, pastDueSince },
  });

  const licenseStatus = computeLicenseStatus({
    subscriptionStatus: subscription.status,
    pastDueSince,
    now,
  });

  await prisma.license.updateMany({
    where: { userId: existing.userId },
    data: { status: licenseStatus, validUntil: currentPeriodEnd },
  });
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!existing) {
    console.error(`customer.subscription.deleted: no Subscription row for ${subscription.id}`);
    return;
  }

  await prisma.subscription.update({
    where: { id: existing.id },
    data: { status: "canceled" },
  });

  await prisma.license.updateMany({
    where: { userId: existing.userId },
    data: { status: "expired" },
  });
}

export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const stripeSubscriptionId = invoice.subscription as string | null;
  if (!stripeSubscriptionId) {
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
  });
  if (!subscription) {
    console.error(`invoice.paid: no Subscription row for ${stripeSubscriptionId}`);
    return;
  }

  await prisma.order.create({
    data: {
      userId: subscription.userId,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status ?? "paid",
      refunded: false,
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/stripe-webhooks.test.ts`
Expected: PASS — 13 passed.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stripe-webhooks.ts tests/lib/stripe-webhooks.test.ts
git commit -m "Add ongoing subscription sync webhook handlers"
```

---

### Task 12: Stripe webhook route

**Files:**
- Create: `src/app/api/webhooks/stripe/route.ts`

**Interfaces:**
- Consumes: `stripe` (Task 2), `handleCheckoutSessionCompleted` (Task 10),
  `handleSubscriptionUpdated`/`handleSubscriptionDeleted`/`handleInvoicePaid` (Task 11).

- [ ] **Step 1: Create `src/app/api/webhooks/stripe/route.ts`**

```ts
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaid,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "@/lib/stripe-webhooks";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature ?? "",
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`Stripe webhook handler failed for event ${event.id} (${event.type}):`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

Note: Next.js App Router route handlers never auto-parse the request body (unlike the old Pages
Router API routes) — calling `request.text()` here returns the untouched raw bytes needed for
Stripe's signature check, with no extra route config required.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify signature rejection**

Run: `npm run dev`, then in another terminal:

```bash
curl -s -X POST http://localhost:3000/api/webhooks/stripe -H "Content-Type: application/json" -d "{\"type\":\"checkout.session.completed\"}"
```

Expected: `{"error":"Invalid signature"}` with a 400 status (no valid `stripe-signature` header
sent). Stop the dev server once confirmed.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/webhooks/stripe/route.ts"
git commit -m "Add Stripe webhook route"
```

---

### Task 13: Billing portal logic and route

**Files:**
- Create: `src/lib/billing-portal.ts`
- Test: `tests/lib/billing-portal.test.ts`
- Create: `src/app/api/billing-portal/route.ts`

**Interfaces:**
- Consumes: `stripe` (Task 2), `baseUrl` (Task 2), `prisma`.
- Produces: `createBillingPortalSession(userId: string): Promise<{ url: string } | null>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/billing-portal.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    billingPortal: { sessions: { create: vi.fn() } },
  },
}));

import { createBillingPortalSession } from "@/lib/billing-portal";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

describe("createBillingPortalSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the user has no Subscription row", async () => {
    (prisma.subscription.findFirst as any).mockResolvedValue(null);

    const result = await createBillingPortalSession("user-1");

    expect(result).toBeNull();
    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it("creates a portal session for the user's most recent Stripe customer", async () => {
    (prisma.subscription.findFirst as any).mockResolvedValue({ stripeCustomerId: "cus_1" });
    (stripe.billingPortal.sessions.create as any).mockResolvedValue({
      url: "https://billing.stripe.com/session-1",
    });

    const result = await createBillingPortalSession("user-1");

    expect(result).toEqual({ url: "https://billing.stripe.com/session-1" });
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
    });
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1" })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/billing-portal.test.ts`
Expected: FAIL — `@/lib/billing-portal` does not exist yet.

- [ ] **Step 3: Implement `src/lib/billing-portal.ts`**

```ts
import { stripe } from "./stripe";
import { prisma } from "./prisma";
import { baseUrl } from "./base-url";

export async function createBillingPortalSession(userId: string): Promise<{ url: string } | null> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) {
    return null;
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${baseUrl()}/account`,
  });

  return { url: portalSession.url };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/billing-portal.test.ts`
Expected: PASS — 2 passed.

- [ ] **Step 5: Create `src/app/api/billing-portal/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createBillingPortalSession } from "@/lib/billing-portal";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await createBillingPortalSession(session.user.id);
  if (!result) {
    return NextResponse.json({ ok: false, message: "No subscription found." }, { status: 404 });
  }
  return NextResponse.json(result);
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/billing-portal.ts tests/lib/billing-portal.test.ts "src/app/api/billing-portal/route.ts"
git commit -m "Add billing portal logic and route"
```

---

### Task 14: Account page license section

**Files:**
- Create: `src/components/account/LicenseSection.tsx`
- Modify: `src/app/account/page.tsx`

**Interfaces:**
- Consumes: `POST /api/billing-portal` (Task 13), `prisma` (existing).

- [ ] **Step 1: Create `src/components/account/LicenseSection.tsx`**

```tsx
"use client";

import { useState } from "react";

interface LicenseSectionProps {
  licenseKey: string;
  planName: string;
  status: string;
  validUntil: string | null;
}

export function LicenseSection({ licenseKey, planName, status, validUntil }: LicenseSectionProps) {
  const [copied, setCopied] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    const res = await fetch("/api/billing-portal", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (data?.url) {
      window.location.href = data.url;
      return;
    }
    setPortalLoading(false);
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400">License key</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="rounded bg-gray-100 px-2 py-1 text-sm dark:bg-gray-900">{licenseKey}</code>
        <button onClick={handleCopy} className="text-sm font-medium text-gray-900 underline dark:text-white">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="mt-3 text-sm">Plan: {planName}</p>
      <p className="text-sm">Status: {status}</p>
      {validUntil && <p className="text-sm">Valid until: {validUntil}</p>}
      <button
        onClick={handleManageBilling}
        disabled={portalLoading}
        className="mt-3 text-sm font-medium text-gray-900 underline disabled:opacity-50 dark:text-white"
      >
        {portalLoading ? "Loading..." : "Manage billing"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Replace the full contents of `src/app/account/page.tsx`**

```tsx
import { requireUser } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { LicenseSection } from "@/components/account/LicenseSection";

export default async function AccountPage() {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });
  const license = await prisma.license.findFirst({
    where: { userId: session.user.id },
    include: { plan: true },
  });

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Your account</h1>
      <p className="mt-4">Email: {session.user.email}</p>
      <p>Role: {session.user.role ?? "customer"}</p>
      {!user?.emailVerified && (
        <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-950">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Please verify your email address.
          </p>
          <div className="mt-2">
            <ResendVerificationButton />
          </div>
        </div>
      )}
      {license ? (
        <LicenseSection
          licenseKey={license.licenseKey}
          planName={license.plan?.name ?? "Pro"}
          status={license.status}
          validUntil={license.validUntil ? license.validUntil.toDateString() : null}
        />
      ) : (
        <p className="mt-4 text-sm text-gray-500">
          You don&apos;t have an active license yet.{" "}
          <a href="/pricing" className="font-medium text-gray-900 underline dark:text-white">
            Subscribe
          </a>
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — all existing tests plus this phase's new ones (license, license-status,
checkout, stripe-webhooks, billing-portal, mail) all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/account/LicenseSection.tsx src/app/account/page.tsx
git commit -m "Add license section to account page"
```

---

### Task 15: End-to-end manual verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- None — this task exercises the whole phase together.

- [ ] **Step 1: Add a "Testing" note for the purchase flow to `README.md`**

In the existing `## Testing` section of `README.md`, add a sentence noting that the purchase
flow is verified manually against Stripe's test mode using the Stripe CLI, matching how
OAuth/email flows are already described there.

- [ ] **Step 2: Start webhook forwarding and the dev server**

In one terminal: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` (leave running
— note the webhook signing secret it prints matches what's in your `.env.local`, or update
`.env.local` if it printed a new one and restart the dev server).
In a second terminal: `npm run dev`.

- [ ] **Step 3: Run a real test-mode checkout**

Sign in at `http://localhost:3000/login`, visit `/pricing`, click "Subscribe" for the monthly
plan. Complete Stripe's test checkout with card `4242 4242 4242 4242`, any future expiry, any
CVC. Expected: redirected back to `/account`, and within a few seconds it shows a license key,
plan "Pro", status "active", and a valid-until date. Confirm the license email arrived in your
Resend test account's inbox.

- [ ] **Step 4: Trigger ongoing sync events via the Stripe CLI**

```bash
stripe trigger customer.subscription.updated
```

Expected: the `stripe listen` terminal shows a `200` response from your webhook route.

- [ ] **Step 5: Click "Manage billing" on `/account`**

Expected: redirected to a Stripe-hosted Billing Portal page for your test customer.

- [ ] **Step 6: Commit the README update**

```bash
git add README.md
git commit -m "Document Stripe test-mode verification for the purchase flow"
```
