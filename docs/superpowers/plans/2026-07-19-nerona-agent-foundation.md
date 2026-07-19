# Nerona Agent Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the core plumbing for nerona-agent: the full data model, a WhatsApp Cloud API webhook that authenticates senders and routes them to the right tenant, a background job + cron-retry pipeline, phone-number linking, an echo-level Claude-powered chat (memory + history, no tools yet), and admin activation — enough for an activated owner to text the Nerona number and have a real AI conversation.

**Architecture:** All code lives in `nerona-web` (Next.js App Router). Business logic sits in small, single-responsibility modules under `src/lib/agent/`, each with Prisma calls behind plain exported functions (mirroring the existing `src/lib/admin-grants.ts` / `src/lib/tokens.ts` style). Route handlers under `src/app/api/` are thin adapters that call those modules and translate results to HTTP responses — this keeps the branching logic unit-testable and matches the project's existing convention of verifying routes manually while unit-testing the logic underneath. The webhook ACKs Meta immediately and hands off the slow Claude call to `waitUntil` (via `@vercel/functions`) so it survives past the response; a Vercel Cron sweeps any job that gets stuck.

**Tech Stack:** Next.js 14 (App Router) + TypeScript + Prisma 5 (existing). New: `@anthropic-ai/sdk` for the Claude tool loop's foundation call, `@vercel/functions` for `waitUntil`, WhatsApp Cloud API (Graph API) via plain `fetch`, Vercel Cron via `vercel.json`.

## Global Constraints

- Every database query touching agent data must be scoped by `profileId` — tenant isolation is enforced in code, never left to the model (spec: Data Model).
- One central Nerona-owned WhatsApp number serves all tenants; tenants are identified by their verified sender phone number, never a per-tenant Meta account (spec: Purpose).
- Only the business owner (the verified phone tied to their `AgentProfile`) is ever routed to the AI — no customer-facing chat in this design (spec: Purpose).
- Every reply is sent inside Meta's 24-hour customer-service window because it is always a reply to an owner-initiated message — no proactive/template messages (spec: Architecture & Message Flow).
- Deploy target is Vercel: the webhook ACKs immediately and processes via `waitUntil`, with a cron sweep as the retry safety net (spec: Architecture & Message Flow).
- Prisma CLI commands always go through the `npm run prisma:*` scripts, never raw `npx prisma ...` — the Prisma CLI doesn't auto-load `.env.local` (existing project convention).

---

## Before you start: accounts only you can create

1. **Meta / WhatsApp Cloud API:** at https://developers.facebook.com create an app (type "Business"), add the WhatsApp product, and set up a WhatsApp Business Account with one phone number (Meta provides a free test number + test recipient list — enough for all of this phase's development). From the app dashboard collect:
   - A permanent access token (Meta Business Settings → System Users → generate token with `whatsapp_business_messaging` permission) → `WHATSAPP_ACCESS_TOKEN`
   - The test number's Phone Number ID (WhatsApp → API Setup) → `WHATSAPP_PHONE_NUMBER_ID`
   - The app secret (App Settings → Basic) → `WHATSAPP_APP_SECRET`
   - Invent a random string → `WHATSAPP_VERIFY_TOKEN`
   - The test number itself, in international display form (e.g. `+1 555 123 4567`) → `WHATSAPP_DISPLAY_NUMBER`

   You won't be able to configure the webhook URL in Meta until Task 10 gives you a route to point it at — for local development, use a tunnel (e.g. `ngrok http 3000`) and set the webhook URL to `https://<tunnel>/api/whatsapp/webhook`, verify token = your `WHATSAPP_VERIFY_TOKEN`, subscribed field = `messages`.

2. **Anthropic:** an API key from https://console.anthropic.com → `ANTHROPIC_API_KEY`.

---

### Task 1: Prisma schema — full agent data model

**Files:**
- Modify: `prisma/schema.prisma:54-73` (add `agentProfile` relation to `model User`)
- Modify: `prisma/schema.prisma` (append 8 new models at end of file)

**Interfaces:**
- Produces: Postgres tables `agent_profiles`, `agent_notes`, `agent_memories`, `agent_products`, `agent_orders`, `agent_order_items`, `agent_messages`, `agent_jobs`. Every later task in this plan queries these via `prisma.agentProfile`, `prisma.agentMessage`, `prisma.agentJob`, `prisma.agentMemory`.

- [ ] **Step 1: Add the `agentProfile` relation field to `model User`**

In `prisma/schema.prisma`, find:

```prisma
  accounts                   Account[]
  sessions                   Session[]
  adminRole                  AdminRole?
  licenses                   License[]        @relation("UserLicenses")
  grantedLicenses            License[]        @relation("GrantedByAdmin")
  orders                     Order[]
  emailVerificationTokens    EmailVerificationToken[]
  passwordResetTokens        PasswordResetToken[]
  enrollments                Enrollment[]
  lessonProgress             LessonProgress[]

  @@map("users")
}
```

Replace with (adding one line):

```prisma
  accounts                   Account[]
  sessions                   Session[]
  adminRole                  AdminRole?
  licenses                   License[]        @relation("UserLicenses")
  grantedLicenses            License[]        @relation("GrantedByAdmin")
  orders                     Order[]
  emailVerificationTokens    EmailVerificationToken[]
  passwordResetTokens        PasswordResetToken[]
  enrollments                Enrollment[]
  lessonProgress             LessonProgress[]
  agentProfile               AgentProfile?

  @@map("users")
}
```

- [ ] **Step 2: Append the agent models to the end of `prisma/schema.prisma`**

```prisma
// --- Nerona Agent (WhatsApp AI business assistant) ---

model AgentProfile {
  id                  String    @id @default(cuid())
  userId              String    @unique
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  whatsappPhone       String?   @unique
  phoneVerifiedAt     DateTime?
  linkCode            String?
  linkCodeExpires     DateTime?
  businessName        String?
  timezone            String    @default("Asia/Jakarta")
  status              String    @default("pending") // "pending" | "active" | "disabled"
  googleRefreshToken  String?   @db.Text
  googleCalendarEmail String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  notes    AgentNote[]
  memories AgentMemory[]
  products AgentProduct[]
  orders   AgentOrder[]
  messages AgentMessage[]
  jobs     AgentJob[]

  @@map("agent_profiles")
}

model AgentNote {
  id        String       @id @default(cuid())
  profileId String
  profile   AgentProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  content   String       @db.Text
  createdAt DateTime     @default(now())

  @@map("agent_notes")
}

model AgentMemory {
  id        String       @id @default(cuid())
  profileId String
  profile   AgentProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  fact      String       @db.Text
  source    String       // "auto" | "explicit"
  createdAt DateTime     @default(now())

  @@map("agent_memories")
}

model AgentProduct {
  id          String       @id @default(cuid())
  profileId   String
  profile     AgentProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  name        String
  description String?
  price       Int
  stock       Int?
  isActive    Boolean      @default(true)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  orderItems AgentOrderItem[]

  @@map("agent_products")
}

model AgentOrder {
  id           String       @id @default(cuid())
  profileId    String
  profile      AgentProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  customerName String?
  status       String       @default("new") // "new" | "paid" | "done" | "cancelled"
  total        Int
  note         String?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  items AgentOrderItem[]

  @@map("agent_orders")
}

model AgentOrderItem {
  id          String        @id @default(cuid())
  orderId     String
  order       AgentOrder    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId   String?
  product     AgentProduct? @relation(fields: [productId], references: [id])
  productName String
  qty         Int
  unitPrice   Int

  @@map("agent_order_items")
}

model AgentMessage {
  id          String        @id @default(cuid())
  profileId   String?
  profile     AgentProfile? @relation(fields: [profileId], references: [id], onDelete: Cascade)
  waMessageId String?       @unique
  phone       String
  direction   String        // "in" | "out"
  body        String        @db.Text
  createdAt   DateTime      @default(now())

  @@map("agent_messages")
}

model AgentJob {
  id          String       @id @default(cuid())
  waMessageId String       @unique
  profileId   String
  profile     AgentProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  payload     String       @db.Text
  status      String       @default("pending") // "pending" | "processing" | "done" | "failed"
  attempts    Int          @default(0)
  lastError   String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@map("agent_jobs")
}
```

- [ ] **Step 3: Run the migration**

Run: `npm run prisma:migrate -- --name agent_foundation`
Expected: output ends with `Your database is now in sync with your schema.` and a new folder `prisma/migrations/<timestamp>_agent_foundation/` is created.

- [ ] **Step 4: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add Prisma schema for nerona-agent (profiles, notes, memory, products, orders, messages, jobs)"
```

---

### Task 2: WhatsApp Cloud API client

**Files:**
- Create: `src/lib/agent/whatsapp-client.ts`
- Test: `tests/lib/agent/whatsapp-client.test.ts`

**Interfaces:**
- Consumes: `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` from env.
- Produces: `verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean` and `sendWhatsAppText(to: string, body: string): Promise<void>`, both exported from `src/lib/agent/whatsapp-client.ts`. Consumed by Task 9 (`process-job.ts`) and Task 10 (`webhook-handler.ts`).

- [ ] **Step 1: Add the new env vars**

Append to `.env.example`:

```
WHATSAPP_ACCESS_TOKEN=""
WHATSAPP_PHONE_NUMBER_ID=""
WHATSAPP_APP_SECRET=""
WHATSAPP_VERIFY_TOKEN=""
```

Add the real values you collected in "Before you start" to `.env.local`.

- [ ] **Step 2: Write the failing tests**

Create `tests/lib/agent/whatsapp-client.test.ts`:

```ts
import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendWhatsAppText, verifyWebhookSignature } from "@/lib/agent/whatsapp-client";

describe("verifyWebhookSignature", () => {
  const originalSecret = process.env.WHATSAPP_APP_SECRET;

  beforeEach(() => {
    process.env.WHATSAPP_APP_SECRET = "test-app-secret";
  });

  afterEach(() => {
    process.env.WHATSAPP_APP_SECRET = originalSecret;
  });

  function signaturesFor(body: string): string {
    const hex = crypto.createHmac("sha256", "test-app-secret").update(body, "utf8").digest("hex");
    return `sha256=${hex}`;
  }

  it("returns true for a valid signature", () => {
    const body = '{"hello":"world"}';
    expect(verifyWebhookSignature(body, signaturesFor(body))).toBe(true);
  });

  it("returns false for a tampered body", () => {
    const body = '{"hello":"world"}';
    expect(verifyWebhookSignature('{"hello":"tampered"}', signaturesFor(body))).toBe(false);
  });

  it("returns false when the header is missing", () => {
    expect(verifyWebhookSignature('{"a":1}', null)).toBe(false);
  });

  it("returns false when the header has the wrong scheme", () => {
    expect(verifyWebhookSignature('{"a":1}', "sha1=deadbeef")).toBe(false);
  });
});

describe("sendWhatsAppText", () => {
  const originalToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const originalPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
  });

  afterEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = originalToken;
    process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneId;
    vi.unstubAllGlobals();
  });

  it("POSTs to the Graph API with the expected payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    await sendWhatsAppText("+15551234567", "hello there");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v20.0/123456/messages");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: "whatsapp",
      to: "15551234567",
      type: "text",
      text: { body: "hello there" },
    });
  });

  it("throws when the Graph API responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "invalid token" })
    );

    await expect(sendWhatsAppText("+15551234567", "hi")).rejects.toThrow(/401/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/lib/agent/whatsapp-client.test.ts`
Expected: FAIL — `src/lib/agent/whatsapp-client.ts` does not exist yet.

- [ ] **Step 4: Implement `src/lib/agent/whatsapp-client.ts`**

```ts
import crypto from "node:crypto";

const GRAPH_API_VERSION = "v20.0";

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) {
    return false;
  }
  const [scheme, providedHex] = signatureHeader.split("=");
  if (scheme !== "sha256" || !providedHex) {
    return false;
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return false;
  }

  const expectedHex = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const expected = Buffer.from(expectedHex, "hex");
  const provided = Buffer.from(providedHex, "hex");
  if (expected.length !== provided.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, provided);
}

export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/^\+/, ""),
        type: "text",
        text: { body },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`WhatsApp send failed (${response.status}): ${errorText}`);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/lib/agent/whatsapp-client.test.ts`
Expected: PASS — 6 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent/whatsapp-client.ts tests/lib/agent/whatsapp-client.test.ts .env.example
git commit -m "Add WhatsApp Cloud API client (signature verification + send)"
```

---

### Task 3: Tenant profile lookup and phone linking

**Files:**
- Create: `src/lib/agent/profile.ts`
- Test: `tests/lib/agent/profile.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts`.
- Produces: `normalizePhone(input: string): string`, `findProfileByPhone(phone: string): Promise<AgentProfile | null>`, `getOwnProfile(userId: string): Promise<AgentProfile | null>`, `startPhoneLink(profileId: string, phone: string): Promise<StartPhoneLinkResult>`, `matchesLinkCode(profile: { linkCode: string | null; linkCodeExpires: Date | null }, text: string): boolean`, `markPhoneVerified(profileId: string): Promise<void>`. Consumed by Task 10 (webhook), Task 12 (admin doesn't need this), Task 13 (dashboard routes).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/agent/profile.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import {
  findProfileByPhone,
  getOwnProfile,
  markPhoneVerified,
  matchesLinkCode,
  normalizePhone,
  startPhoneLink,
} from "@/lib/agent/profile";
import { prisma } from "@/lib/prisma";

describe("normalizePhone", () => {
  it("keeps a number already in E.164 form", () => {
    expect(normalizePhone("+15551234567")).toBe("+15551234567");
  });

  it("converts a leading 0 to +62 (Indonesian local format)", () => {
    expect(normalizePhone("081234567890")).toBe("+6281234567890");
  });

  it("adds a + to a bare 62-prefixed number", () => {
    expect(normalizePhone("6281234567890")).toBe("+6281234567890");
  });

  it("strips spaces and dashes", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("+6281234567890");
  });
});

describe("findProfileByPhone", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks up by whatsappPhone", async () => {
    (prisma.agentProfile.findUnique as any).mockResolvedValue({ id: "profile-1" });

    const result = await findProfileByPhone("+15551234567");

    expect(result).toEqual({ id: "profile-1" });
    expect(prisma.agentProfile.findUnique).toHaveBeenCalledWith({
      where: { whatsappPhone: "+15551234567" },
    });
  });
});

describe("getOwnProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks up by userId", async () => {
    (prisma.agentProfile.findUnique as any).mockResolvedValue({ id: "profile-1" });

    const result = await getOwnProfile("user-1");

    expect(result).toEqual({ id: "profile-1" });
    expect(prisma.agentProfile.findUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});

describe("startPhoneLink", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns phone_taken when another profile already owns the number", async () => {
    (prisma.agentProfile.findUnique as any).mockResolvedValue({ id: "other-profile" });

    const result = await startPhoneLink("profile-1", "+15551234567");

    expect(result).toEqual({ ok: false, reason: "phone_taken" });
    expect(prisma.agentProfile.update).not.toHaveBeenCalled();
  });

  it("generates a 6-digit code and updates the profile when the number is free", async () => {
    (prisma.agentProfile.findUnique as any).mockResolvedValue(null);

    const result = await startPhoneLink("profile-1", "+15551234567");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toMatch(/^\d{6}$/);
      expect(result.expires).toBeInstanceOf(Date);
    }
    expect(prisma.agentProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: expect.objectContaining({
        whatsappPhone: "+15551234567",
        phoneVerifiedAt: null,
      }),
    });
  });

  it("allows re-linking the same phone already owned by this profile", async () => {
    (prisma.agentProfile.findUnique as any).mockResolvedValue({ id: "profile-1" });

    const result = await startPhoneLink("profile-1", "+15551234567");

    expect(result.ok).toBe(true);
  });
});

describe("matchesLinkCode", () => {
  it("returns true for a matching, unexpired code", () => {
    const profile = { linkCode: "123456", linkCodeExpires: new Date(Date.now() + 60_000) };
    expect(matchesLinkCode(profile, "123456")).toBe(true);
  });

  it("trims surrounding whitespace from the incoming text", () => {
    const profile = { linkCode: "123456", linkCodeExpires: new Date(Date.now() + 60_000) };
    expect(matchesLinkCode(profile, "  123456  ")).toBe(true);
  });

  it("returns false for a mismatched code", () => {
    const profile = { linkCode: "123456", linkCodeExpires: new Date(Date.now() + 60_000) };
    expect(matchesLinkCode(profile, "000000")).toBe(false);
  });

  it("returns false for an expired code", () => {
    const profile = { linkCode: "123456", linkCodeExpires: new Date(Date.now() - 1) };
    expect(matchesLinkCode(profile, "123456")).toBe(false);
  });

  it("returns false when there is no active code", () => {
    expect(matchesLinkCode({ linkCode: null, linkCodeExpires: null }, "123456")).toBe(false);
  });
});

describe("markPhoneVerified", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets phoneVerifiedAt and clears the link code", async () => {
    await markPhoneVerified("profile-1");

    expect(prisma.agentProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: expect.objectContaining({ linkCode: null, linkCodeExpires: null }),
    });
    const call = (prisma.agentProfile.update as any).mock.calls[0][0];
    expect(call.data.phoneVerifiedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/agent/profile.test.ts`
Expected: FAIL — `src/lib/agent/profile.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/agent/profile.ts`**

```ts
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const LINK_CODE_TTL_MS = 15 * 60 * 1000;

export function normalizePhone(input: string): string {
  const digits = input.trim().replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    return digits;
  }
  if (digits.startsWith("62")) {
    return `+${digits}`;
  }
  if (digits.startsWith("0")) {
    return `+62${digits.slice(1)}`;
  }
  return `+${digits}`;
}

export async function findProfileByPhone(phone: string) {
  return prisma.agentProfile.findUnique({ where: { whatsappPhone: phone } });
}

export async function getOwnProfile(userId: string) {
  return prisma.agentProfile.findUnique({ where: { userId } });
}

export type StartPhoneLinkResult =
  | { ok: true; code: string; expires: Date }
  | { ok: false; reason: "phone_taken" };

function generateSixDigitCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function startPhoneLink(
  profileId: string,
  phone: string
): Promise<StartPhoneLinkResult> {
  const existing = await prisma.agentProfile.findUnique({ where: { whatsappPhone: phone } });
  if (existing && existing.id !== profileId) {
    return { ok: false, reason: "phone_taken" };
  }

  const code = generateSixDigitCode();
  const expires = new Date(Date.now() + LINK_CODE_TTL_MS);

  await prisma.agentProfile.update({
    where: { id: profileId },
    data: {
      whatsappPhone: phone,
      phoneVerifiedAt: null,
      linkCode: code,
      linkCodeExpires: expires,
    },
  });

  return { ok: true, code, expires };
}

export function matchesLinkCode(
  profile: { linkCode: string | null; linkCodeExpires: Date | null },
  text: string
): boolean {
  if (!profile.linkCode || !profile.linkCodeExpires) {
    return false;
  }
  if (profile.linkCodeExpires.getTime() < Date.now()) {
    return false;
  }
  return text.trim() === profile.linkCode;
}

export async function markPhoneVerified(profileId: string): Promise<void> {
  await prisma.agentProfile.update({
    where: { id: profileId },
    data: { phoneVerifiedAt: new Date(), linkCode: null, linkCodeExpires: null },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/agent/profile.test.ts`
Expected: PASS — 15 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/profile.ts tests/lib/agent/profile.test.ts
git commit -m "Add tenant profile lookup and phone-link-code logic"
```

---

### Task 4: Message logging and dedupe

**Files:**
- Create: `src/lib/agent/messages.ts`
- Test: `tests/lib/agent/messages.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts`.
- Produces: `interface HistoryEntry { direction: "in" | "out"; body: string }`, `isDuplicateMessage(waMessageId: string): Promise<boolean>`, `logInbound(params): Promise<void>`, `logOutbound(params): Promise<void>`, `getRecentHistory(profileId: string, limit?: number): Promise<HistoryEntry[]>`. `HistoryEntry` and `getRecentHistory` are consumed by Task 6 (`context.ts`) and Task 9 (`process-job.ts`).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/agent/messages.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentMessage: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import {
  getRecentHistory,
  isDuplicateMessage,
  logInbound,
  logOutbound,
} from "@/lib/agent/messages";
import { prisma } from "@/lib/prisma";

describe("isDuplicateMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when a message with that waMessageId already exists", async () => {
    (prisma.agentMessage.findUnique as any).mockResolvedValue({ id: "msg-1" });
    expect(await isDuplicateMessage("wamid.1")).toBe(true);
  });

  it("returns false when no message exists yet", async () => {
    (prisma.agentMessage.findUnique as any).mockResolvedValue(null);
    expect(await isDuplicateMessage("wamid.1")).toBe(false);
  });
});

describe("logInbound", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an inbound message row", async () => {
    await logInbound({
      profileId: "profile-1",
      waMessageId: "wamid.1",
      phone: "+15551234567",
      body: "hello",
    });

    expect(prisma.agentMessage.create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        waMessageId: "wamid.1",
        phone: "+15551234567",
        direction: "in",
        body: "hello",
      },
    });
  });

  it("allows a null profileId for unknown senders", async () => {
    await logInbound({
      profileId: null,
      waMessageId: "wamid.2",
      phone: "+15551234567",
      body: "hi",
    });

    expect(prisma.agentMessage.create).toHaveBeenCalledWith({
      data: {
        profileId: null,
        waMessageId: "wamid.2",
        phone: "+15551234567",
        direction: "in",
        body: "hi",
      },
    });
  });
});

describe("logOutbound", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an outbound message row with no waMessageId", async () => {
    await logOutbound({ profileId: "profile-1", phone: "+15551234567", body: "reply" });

    expect(prisma.agentMessage.create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        phone: "+15551234567",
        direction: "out",
        body: "reply",
      },
    });
  });
});

describe("getRecentHistory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns rows oldest-first, limited and scoped to the profile", async () => {
    (prisma.agentMessage.findMany as any).mockResolvedValue([
      { direction: "out", body: "third" },
      { direction: "in", body: "second" },
      { direction: "in", body: "first" },
    ]);

    const result = await getRecentHistory("profile-1", 3);

    expect(prisma.agentMessage.findMany).toHaveBeenCalledWith({
      where: { profileId: "profile-1" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { direction: true, body: true },
    });
    expect(result).toEqual([
      { direction: "in", body: "first" },
      { direction: "in", body: "second" },
      { direction: "out", body: "third" },
    ]);
  });

  it("defaults the limit to 20", async () => {
    (prisma.agentMessage.findMany as any).mockResolvedValue([]);

    await getRecentHistory("profile-1");

    expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/agent/messages.test.ts`
Expected: FAIL — `src/lib/agent/messages.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/agent/messages.ts`**

```ts
import { prisma } from "@/lib/prisma";

export interface HistoryEntry {
  direction: "in" | "out";
  body: string;
}

export async function isDuplicateMessage(waMessageId: string): Promise<boolean> {
  const existing = await prisma.agentMessage.findUnique({ where: { waMessageId } });
  return existing !== null;
}

export async function logInbound(params: {
  profileId: string | null;
  waMessageId: string;
  phone: string;
  body: string;
}): Promise<void> {
  await prisma.agentMessage.create({
    data: {
      profileId: params.profileId,
      waMessageId: params.waMessageId,
      phone: params.phone,
      direction: "in",
      body: params.body,
    },
  });
}

export async function logOutbound(params: {
  profileId: string | null;
  phone: string;
  body: string;
}): Promise<void> {
  await prisma.agentMessage.create({
    data: {
      profileId: params.profileId,
      phone: params.phone,
      direction: "out",
      body: params.body,
    },
  });
}

export async function getRecentHistory(
  profileId: string,
  limit = 20
): Promise<HistoryEntry[]> {
  const rows = await prisma.agentMessage.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { direction: true, body: true },
  });
  return rows
    .reverse()
    .map((row) => ({ direction: row.direction as "in" | "out", body: row.body }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/agent/messages.test.ts`
Expected: PASS — 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/messages.ts tests/lib/agent/messages.test.ts
git commit -m "Add agent message logging, dedupe, and history lookup"
```

---

### Task 5: Job plumbing

**Files:**
- Create: `src/lib/agent/jobs.ts`
- Test: `tests/lib/agent/jobs.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts`.
- Produces: `MAX_ATTEMPTS = 3`, `interface AgentJobRecord { id, profileId, waMessageId, payload, status, attempts, lastError }`, `createJob(params): Promise<AgentJobRecord>`, `beginProcessing(jobId: string): Promise<AgentJobRecord>`, `completeJob(jobId: string): Promise<void>`, `failJob(jobId: string, attempts: number, error: string): Promise<{ permanentlyFailed: boolean }>`, `findStuckJobs(cutoff: Date): Promise<AgentJobRecord[]>`. Consumed by Task 9 (`process-job.ts`), Task 10 (webhook), Task 11 (cron).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/agent/jobs.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentJob: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import {
  MAX_ATTEMPTS,
  beginProcessing,
  completeJob,
  createJob,
  failJob,
  findStuckJobs,
} from "@/lib/agent/jobs";
import { prisma } from "@/lib/prisma";

describe("createJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a pending job", async () => {
    (prisma.agentJob.create as any).mockResolvedValue({ id: "job-1" });

    const result = await createJob({
      profileId: "profile-1",
      waMessageId: "wamid.1",
      payload: "{}",
    });

    expect(result).toEqual({ id: "job-1" });
    expect(prisma.agentJob.create).toHaveBeenCalledWith({
      data: { profileId: "profile-1", waMessageId: "wamid.1", payload: "{}" },
    });
  });
});

describe("beginProcessing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets status to processing and increments attempts", async () => {
    (prisma.agentJob.update as any).mockResolvedValue({ id: "job-1", attempts: 1 });

    const result = await beginProcessing("job-1");

    expect(result).toEqual({ id: "job-1", attempts: 1 });
    expect(prisma.agentJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "processing", attempts: { increment: 1 } },
    });
  });
});

describe("completeJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets status to done", async () => {
    await completeJob("job-1");

    expect(prisma.agentJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "done" },
    });
  });
});

describe("failJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets status back to pending when attempts is below MAX_ATTEMPTS", async () => {
    const result = await failJob("job-1", MAX_ATTEMPTS - 1, "boom");

    expect(result).toEqual({ permanentlyFailed: false });
    expect(prisma.agentJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "pending", lastError: "boom" },
    });
  });

  it("sets status to failed when attempts has reached MAX_ATTEMPTS", async () => {
    const result = await failJob("job-1", MAX_ATTEMPTS, "boom");

    expect(result).toEqual({ permanentlyFailed: true });
    expect(prisma.agentJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "failed", lastError: "boom" },
    });
  });
});

describe("findStuckJobs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries pending/processing jobs older than the cutoff", async () => {
    const cutoff = new Date("2026-07-19T00:00:00Z");
    (prisma.agentJob.findMany as any).mockResolvedValue([{ id: "job-1" }]);

    const result = await findStuckJobs(cutoff);

    expect(result).toEqual([{ id: "job-1" }]);
    expect(prisma.agentJob.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["pending", "processing"] },
        updatedAt: { lt: cutoff },
      },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/agent/jobs.test.ts`
Expected: FAIL — `src/lib/agent/jobs.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/agent/jobs.ts`**

```ts
import { prisma } from "@/lib/prisma";

export const MAX_ATTEMPTS = 3;

export interface AgentJobRecord {
  id: string;
  profileId: string;
  waMessageId: string;
  payload: string;
  status: string;
  attempts: number;
  lastError: string | null;
}

export async function createJob(params: {
  profileId: string;
  waMessageId: string;
  payload: string;
}): Promise<AgentJobRecord> {
  return prisma.agentJob.create({
    data: {
      profileId: params.profileId,
      waMessageId: params.waMessageId,
      payload: params.payload,
    },
  });
}

export async function beginProcessing(jobId: string): Promise<AgentJobRecord> {
  return prisma.agentJob.update({
    where: { id: jobId },
    data: { status: "processing", attempts: { increment: 1 } },
  });
}

export async function completeJob(jobId: string): Promise<void> {
  await prisma.agentJob.update({ where: { id: jobId }, data: { status: "done" } });
}

export async function failJob(
  jobId: string,
  attempts: number,
  error: string
): Promise<{ permanentlyFailed: boolean }> {
  const permanentlyFailed = attempts >= MAX_ATTEMPTS;
  await prisma.agentJob.update({
    where: { id: jobId },
    data: { status: permanentlyFailed ? "failed" : "pending", lastError: error },
  });
  return { permanentlyFailed };
}

export async function findStuckJobs(cutoff: Date): Promise<AgentJobRecord[]> {
  return prisma.agentJob.findMany({
    where: {
      status: { in: ["pending", "processing"] },
      updatedAt: { lt: cutoff },
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/agent/jobs.test.ts`
Expected: PASS — 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/jobs.ts tests/lib/agent/jobs.test.ts
git commit -m "Add agent job lifecycle (create, process, complete, fail, sweep)"
```

---

### Task 6: Memory read-path and Claude context assembly

**Files:**
- Create: `src/lib/agent/memory.ts`
- Create: `src/lib/agent/context.ts`
- Test: `tests/lib/agent/memory.test.ts`
- Test: `tests/lib/agent/context.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts`; `HistoryEntry` from `src/lib/agent/messages.ts` (Task 4).
- Produces: `listRecentFacts(profileId: string, limit?: number): Promise<string[]>` from `memory.ts`; `toClaudeHistory(history: HistoryEntry[]): { role: "user" | "assistant"; content: string }[]` and `buildSystemPrompt(params): string` from `context.ts`. Both consumed by Task 9 (`process-job.ts`).

- [ ] **Step 1: Write the failing test for `listRecentFacts`**

Create `tests/lib/agent/memory.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentMemory: {
      findMany: vi.fn(),
    },
  },
}));

import { listRecentFacts } from "@/lib/agent/memory";
import { prisma } from "@/lib/prisma";

describe("listRecentFacts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the fact strings, newest first, scoped to the profile", async () => {
    (prisma.agentMemory.findMany as any).mockResolvedValue([
      { fact: "Supplier utama: Pak Budi" },
      { fact: "Toko tutup jam 9 malam" },
    ]);

    const result = await listRecentFacts("profile-1");

    expect(result).toEqual(["Supplier utama: Pak Budi", "Toko tutup jam 9 malam"]);
    expect(prisma.agentMemory.findMany).toHaveBeenCalledWith({
      where: { profileId: "profile-1" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { fact: true },
    });
  });

  it("respects a custom limit", async () => {
    (prisma.agentMemory.findMany as any).mockResolvedValue([]);

    await listRecentFacts("profile-1", 5);

    expect(prisma.agentMemory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/agent/memory.test.ts`
Expected: FAIL — `src/lib/agent/memory.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/agent/memory.ts`**

```ts
import { prisma } from "@/lib/prisma";

export async function listRecentFacts(profileId: string, limit = 200): Promise<string[]> {
  const rows = await prisma.agentMemory.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { fact: true },
  });
  return rows.map((row) => row.fact);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/agent/memory.test.ts`
Expected: PASS — 2 passed.

- [ ] **Step 5: Write the failing tests for `context.ts`**

Create `tests/lib/agent/context.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSystemPrompt, toClaudeHistory } from "@/lib/agent/context";

describe("toClaudeHistory", () => {
  it("maps inbound messages to the user role and outbound to assistant", () => {
    const result = toClaudeHistory([
      { direction: "in", body: "halo" },
      { direction: "out", body: "hai, ada yang bisa dibantu?" },
    ]);

    expect(result).toEqual([
      { role: "user", content: "halo" },
      { role: "assistant", content: "hai, ada yang bisa dibantu?" },
    ]);
  });
});

describe("buildSystemPrompt", () => {
  const fixedNow = new Date("2026-07-19T09:30:00Z");

  it("includes the business name and formatted date/time", () => {
    const prompt = buildSystemPrompt({
      businessName: "Toko Keripik Bu Sari",
      timezone: "Asia/Jakarta",
      facts: [],
      now: fixedNow,
    });

    expect(prompt).toContain("Toko Keripik Bu Sari");
    expect(prompt).toContain("2026");
  });

  it("falls back to a generic label when businessName is null", () => {
    const prompt = buildSystemPrompt({
      businessName: null,
      timezone: "Asia/Jakarta",
      facts: [],
      now: fixedNow,
    });

    expect(prompt).toContain("bisnis Anda");
  });

  it("lists each fact on its own bullet line", () => {
    const prompt = buildSystemPrompt({
      businessName: "Toko A",
      timezone: "Asia/Jakarta",
      facts: ["Supplier utama: Pak Budi", "Toko tutup jam 9 malam"],
      now: fixedNow,
    });

    expect(prompt).toContain("- Supplier utama: Pak Budi");
    expect(prompt).toContain("- Toko tutup jam 9 malam");
  });

  it("shows a placeholder when there are no facts yet", () => {
    const prompt = buildSystemPrompt({
      businessName: "Toko A",
      timezone: "Asia/Jakarta",
      facts: [],
      now: fixedNow,
    });

    expect(prompt).toContain("belum ada catatan yang diingat");
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run tests/lib/agent/context.test.ts`
Expected: FAIL — `src/lib/agent/context.ts` does not exist yet.

- [ ] **Step 7: Implement `src/lib/agent/context.ts`**

```ts
import type { HistoryEntry } from "./messages";

export function toClaudeHistory(
  history: HistoryEntry[]
): { role: "user" | "assistant"; content: string }[] {
  return history.map((entry) => ({
    role: entry.direction === "in" ? "user" : "assistant",
    content: entry.body,
  }));
}

export function buildSystemPrompt(params: {
  businessName: string | null;
  timezone: string;
  facts: string[];
  now?: Date;
}): string {
  const now = params.now ?? new Date();
  const todayLabel = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: params.timezone,
  }).format(now);

  const factsBlock =
    params.facts.length > 0
      ? params.facts.map((fact) => `- ${fact}`).join("\n")
      : "(belum ada catatan yang diingat)";

  const business = params.businessName ?? "bisnis Anda";

  return [
    `Anda adalah Nerona Agent, asisten AI WhatsApp untuk pemilik ${business}.`,
    `Sekarang: ${todayLabel} (zona waktu ${params.timezone}).`,
    "Balas dengan singkat, ramah, dan dalam bahasa yang sama dengan pesan pemilik (default Bahasa Indonesia).",
    "Anda belum memiliki alat (tools) untuk mencatat, menyimpan produk, atau membuat pesanan pada tahap ini — cukup mengobrol secara natural dan bantu jawab pertanyaan pemilik.",
    "Hal-hal yang Anda ingat tentang bisnis ini:",
    factsBlock,
  ].join("\n\n");
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run tests/lib/agent/context.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 9: Commit**

```bash
git add src/lib/agent/memory.ts src/lib/agent/context.ts tests/lib/agent/memory.test.ts tests/lib/agent/context.test.ts
git commit -m "Add memory read-path and Claude context/system-prompt assembly"
```

---

### Task 7: Claude client

**Files:**
- Create: `src/lib/agent/claude-client.ts`
- Test: `tests/lib/agent/claude-client.test.ts`

**Interfaces:**
- Consumes: `ANTHROPIC_API_KEY`, `AGENT_MODEL` from env.
- Produces: `generateReply(params: { systemPrompt: string; history: { role: "user" | "assistant"; content: string }[] }): Promise<string>`. Consumed by Task 9 (`process-job.ts`).

- [ ] **Step 1: Install the Anthropic SDK**

Run: `npm install @anthropic-ai/sdk@^0.112.0`

- [ ] **Step 2: Add the new env vars**

Append to `.env.example`:

```
ANTHROPIC_API_KEY=""
AGENT_MODEL="claude-sonnet-5"
```

Add your real `ANTHROPIC_API_KEY` to `.env.local`.

- [ ] **Step 3: Write the failing tests**

Create `tests/lib/agent/claude-client.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

import { generateReply } from "@/lib/agent/claude-client";

describe("generateReply", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the text block from Claude's response", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "Halo! Ada yang bisa saya bantu?" }],
    });

    const reply = await generateReply({
      systemPrompt: "You are a helpful assistant.",
      history: [{ role: "user", content: "halo" }],
    });

    expect(reply).toBe("Halo! Ada yang bisa saya bantu?");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "You are a helpful assistant.",
        messages: [{ role: "user", content: "halo" }],
      })
    );
  });

  it("returns an empty string when the response has no text block", async () => {
    createMock.mockResolvedValue({ content: [] });

    const reply = await generateReply({
      systemPrompt: "You are a helpful assistant.",
      history: [{ role: "user", content: "halo" }],
    });

    expect(reply).toBe("");
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run tests/lib/agent/claude-client.test.ts`
Expected: FAIL — `src/lib/agent/claude-client.ts` does not exist yet.

- [ ] **Step 5: Implement `src/lib/agent/claude-client.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.AGENT_MODEL || "claude-sonnet-5";

export async function generateReply(params: {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: params.systemPrompt,
    messages: params.history,
  });

  const textBlock = response.content.find(
    (block): block is { type: "text"; text: string } => block.type === "text"
  );
  return textBlock?.text ?? "";
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/lib/agent/claude-client.test.ts`
Expected: PASS — 2 passed.

- [ ] **Step 7: Commit**

```bash
git add src/lib/agent/claude-client.ts tests/lib/agent/claude-client.test.ts package.json package-lock.json .env.example
git commit -m "Add Claude client for agent replies"
```

---

### Task 8: Background execution wrapper

**Files:**
- Create: `src/lib/agent/wait-until.ts`
- Test: `tests/lib/agent/wait-until.test.ts`

**Interfaces:**
- Produces: `runInBackground(promise: Promise<unknown>): void`. Consumed by Task 10 (webhook route).

- [ ] **Step 1: Install `@vercel/functions`**

Run: `npm install @vercel/functions@^3.7.5`

- [ ] **Step 2: Write the failing tests**

Create `tests/lib/agent/wait-until.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { waitUntilMock } = vi.hoisted(() => ({
  waitUntilMock: vi.fn(),
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: waitUntilMock,
}));

import { runInBackground } from "@/lib/agent/wait-until";

describe("runInBackground", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes a guarded promise to @vercel/functions' waitUntil", () => {
    const task = Promise.resolve("done");

    runInBackground(task);

    expect(waitUntilMock).toHaveBeenCalledTimes(1);
    expect(waitUntilMock.mock.calls[0][0]).toBeInstanceOf(Promise);
  });

  it("still lets the task run when waitUntil throws (no Vercel request context)", async () => {
    waitUntilMock.mockImplementation(() => {
      throw new Error("no request context");
    });
    let ran = false;

    runInBackground(
      new Promise<void>((resolve) => {
        ran = true;
        resolve();
      })
    );

    expect(ran).toBe(true);
  });

  it("swallows a rejection instead of causing an unhandled rejection", async () => {
    const task = Promise.reject(new Error("boom"));

    expect(() => runInBackground(task)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/lib/agent/wait-until.test.ts`
Expected: FAIL — `src/lib/agent/wait-until.ts` does not exist yet.

- [ ] **Step 4: Implement `src/lib/agent/wait-until.ts`**

```ts
import { waitUntil } from "@vercel/functions";

export function runInBackground(promise: Promise<unknown>): void {
  const guarded = promise.catch((err) => {
    console.error("[agent] background task failed", err);
  });

  try {
    waitUntil(guarded);
  } catch {
    // waitUntil requires a Vercel request context; outside one (local dev,
    // tests) the guarded promise above still runs, just fire-and-forget.
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/lib/agent/wait-until.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent/wait-until.ts tests/lib/agent/wait-until.test.ts package.json package-lock.json
git commit -m "Add waitUntil wrapper for background job processing"
```

---

### Task 9: Job processor (orchestrator)

**Files:**
- Create: `src/lib/agent/process-job.ts`
- Test: `tests/lib/agent/process-job.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts`; `beginProcessing`, `completeJob`, `failJob` from `src/lib/agent/jobs.ts` (Task 5); `getRecentHistory`, `logOutbound` from `src/lib/agent/messages.ts` (Task 4); `listRecentFacts` from `src/lib/agent/memory.ts` (Task 6); `buildSystemPrompt`, `toClaudeHistory` from `src/lib/agent/context.ts` (Task 6); `generateReply` from `src/lib/agent/claude-client.ts` (Task 7); `sendWhatsAppText` from `src/lib/agent/whatsapp-client.ts` (Task 2).
- Produces: `processJob(jobId: string): Promise<void>`. Consumed by Task 10 (webhook) and Task 11 (cron).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/agent/process-job.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentProfile: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/agent/jobs", () => ({
  beginProcessing: vi.fn(),
  completeJob: vi.fn(),
  failJob: vi.fn(),
}));
vi.mock("@/lib/agent/messages", () => ({
  getRecentHistory: vi.fn(),
  logOutbound: vi.fn(),
}));
vi.mock("@/lib/agent/memory", () => ({
  listRecentFacts: vi.fn(),
}));
vi.mock("@/lib/agent/context", () => ({
  buildSystemPrompt: vi.fn(() => "system prompt"),
  toClaudeHistory: vi.fn((history) => history),
}));
vi.mock("@/lib/agent/claude-client", () => ({
  generateReply: vi.fn(),
}));
vi.mock("@/lib/agent/whatsapp-client", () => ({
  sendWhatsAppText: vi.fn(),
}));

import { processJob } from "@/lib/agent/process-job";
import { prisma } from "@/lib/prisma";
import { beginProcessing, completeJob, failJob } from "@/lib/agent/jobs";
import { getRecentHistory, logOutbound } from "@/lib/agent/messages";
import { listRecentFacts } from "@/lib/agent/memory";
import { generateReply } from "@/lib/agent/claude-client";
import { sendWhatsAppText } from "@/lib/agent/whatsapp-client";

const profile = {
  id: "profile-1",
  whatsappPhone: "+15551234567",
  businessName: "Toko A",
  timezone: "Asia/Jakarta",
};

describe("processJob — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (beginProcessing as any).mockResolvedValue({ id: "job-1", profileId: "profile-1", attempts: 1 });
    (prisma.agentProfile.findUnique as any).mockResolvedValue(profile);
    (listRecentFacts as any).mockResolvedValue(["fact 1"]);
    (getRecentHistory as any).mockResolvedValue([{ direction: "in", body: "halo" }]);
    (generateReply as any).mockResolvedValue("Halo juga!");
  });

  it("sends the reply, logs it, and completes the job", async () => {
    await processJob("job-1");

    expect(sendWhatsAppText).toHaveBeenCalledWith("+15551234567", "Halo juga!");
    expect(logOutbound).toHaveBeenCalledWith({
      profileId: "profile-1",
      phone: "+15551234567",
      body: "Halo juga!",
    });
    expect(completeJob).toHaveBeenCalledWith("job-1");
    expect(failJob).not.toHaveBeenCalled();
  });
});

describe("processJob — failure below MAX_ATTEMPTS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (beginProcessing as any).mockResolvedValue({ id: "job-1", profileId: "profile-1", attempts: 1 });
    (prisma.agentProfile.findUnique as any).mockResolvedValue(profile);
    (listRecentFacts as any).mockResolvedValue([]);
    (getRecentHistory as any).mockResolvedValue([]);
    (generateReply as any).mockRejectedValue(new Error("Claude API down"));
    (failJob as any).mockResolvedValue({ permanentlyFailed: false });
  });

  it("calls failJob with the job's attempts and does not send an apology", async () => {
    await processJob("job-1");

    expect(failJob).toHaveBeenCalledWith("job-1", 1, "Claude API down");
    expect(sendWhatsAppText).not.toHaveBeenCalled();
  });
});

describe("processJob — permanent failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (beginProcessing as any).mockResolvedValue({ id: "job-1", profileId: "profile-1", attempts: 3 });
    (prisma.agentProfile.findUnique as any).mockResolvedValue(profile);
    (listRecentFacts as any).mockResolvedValue([]);
    (getRecentHistory as any).mockResolvedValue([]);
    (generateReply as any).mockRejectedValue(new Error("Claude API down"));
    (failJob as any).mockResolvedValue({ permanentlyFailed: true });
  });

  it("sends and logs an apology message", async () => {
    await processJob("job-1");

    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("kendala teknis")
    );
    expect(logOutbound).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "profile-1", phone: "+15551234567" })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/agent/process-job.test.ts`
Expected: FAIL — `src/lib/agent/process-job.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/agent/process-job.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { beginProcessing, completeJob, failJob } from "./jobs";
import { getRecentHistory, logOutbound } from "./messages";
import { listRecentFacts } from "./memory";
import { buildSystemPrompt, toClaudeHistory } from "./context";
import { generateReply } from "./claude-client";
import { sendWhatsAppText } from "./whatsapp-client";

const FAILURE_APOLOGY =
  "Maaf, ada kendala teknis di sisi kami. Coba kirim pesan itu lagi sebentar ya.";

export async function processJob(jobId: string): Promise<void> {
  const job = await beginProcessing(jobId);

  try {
    const profile = await prisma.agentProfile.findUnique({ where: { id: job.profileId } });
    if (!profile || !profile.whatsappPhone) {
      throw new Error(`AgentProfile ${job.profileId} not found or has no phone`);
    }

    const [facts, history] = await Promise.all([
      listRecentFacts(profile.id),
      getRecentHistory(profile.id, 20),
    ]);

    const systemPrompt = buildSystemPrompt({
      businessName: profile.businessName,
      timezone: profile.timezone,
      facts,
    });

    const reply = await generateReply({
      systemPrompt,
      history: toClaudeHistory(history),
    });

    await sendWhatsAppText(profile.whatsappPhone, reply);
    await logOutbound({ profileId: profile.id, phone: profile.whatsappPhone, body: reply });
    await completeJob(jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { permanentlyFailed } = await failJob(jobId, job.attempts, message);

    if (permanentlyFailed) {
      const profile = await prisma.agentProfile.findUnique({ where: { id: job.profileId } });
      if (profile?.whatsappPhone) {
        await sendWhatsAppText(profile.whatsappPhone, FAILURE_APOLOGY).catch(() => {});
        await logOutbound({
          profileId: profile.id,
          phone: profile.whatsappPhone,
          body: FAILURE_APOLOGY,
        }).catch(() => {});
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/agent/process-job.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/process-job.ts tests/lib/agent/process-job.test.ts
git commit -m "Add job processor orchestrating context, Claude, and WhatsApp send"
```

---

### Task 10: Webhook handler and route

**Files:**
- Create: `src/lib/agent/webhook-handler.ts`
- Create: `src/app/api/whatsapp/webhook/route.ts`
- Test: `tests/lib/agent/webhook-handler.test.ts`

**Interfaces:**
- Consumes: `verifyWebhookSignature`, `sendWhatsAppText` from `whatsapp-client.ts` (Task 2); `isDuplicateMessage`, `logInbound`, `logOutbound` from `messages.ts` (Task 4); `findProfileByPhone`, `matchesLinkCode`, `markPhoneVerified` from `profile.ts` (Task 3); `createJob` from `jobs.ts` (Task 5); `processJob` from `process-job.ts` (Task 9); `runInBackground` from `wait-until.ts` (Task 8); `baseUrl` from `src/lib/base-url.ts` (existing).
- Produces: `handleWebhookVerification(params): Promise<{ status: number; body: string }>`, `handleIncomingWebhook(rawBody: string, signatureHeader: string | null): Promise<{ status: number }>`, both exported from `src/lib/agent/webhook-handler.ts`. Consumed directly by the route in this task; no later task depends on them.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/agent/webhook-handler.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent/whatsapp-client", () => ({
  verifyWebhookSignature: vi.fn(),
  sendWhatsAppText: vi.fn(),
}));
vi.mock("@/lib/agent/messages", () => ({
  isDuplicateMessage: vi.fn(),
  logInbound: vi.fn(),
  logOutbound: vi.fn(),
}));
vi.mock("@/lib/agent/profile", () => ({
  findProfileByPhone: vi.fn(),
  matchesLinkCode: vi.fn(),
  markPhoneVerified: vi.fn(),
}));
vi.mock("@/lib/agent/jobs", () => ({
  createJob: vi.fn(),
}));
vi.mock("@/lib/agent/process-job", () => ({
  processJob: vi.fn(),
}));
vi.mock("@/lib/agent/wait-until", () => ({
  runInBackground: vi.fn(),
}));
vi.mock("@/lib/base-url", () => ({
  baseUrl: () => "http://localhost:3000",
}));

import {
  handleIncomingWebhook,
  handleWebhookVerification,
} from "@/lib/agent/webhook-handler";
import { sendWhatsAppText, verifyWebhookSignature } from "@/lib/agent/whatsapp-client";
import { isDuplicateMessage, logInbound, logOutbound } from "@/lib/agent/messages";
import { findProfileByPhone, matchesLinkCode, markPhoneVerified } from "@/lib/agent/profile";
import { createJob } from "@/lib/agent/jobs";
import { processJob } from "@/lib/agent/process-job";
import { runInBackground } from "@/lib/agent/wait-until";

function textPayload(from: string, body: string, id = "wamid.1") {
  return JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [{ from, id, type: "text", text: { body } }],
            },
          },
        ],
      },
    ],
  });
}

describe("handleWebhookVerification", () => {
  const originalToken = process.env.WHATSAPP_VERIFY_TOKEN;

  beforeEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = "verify-me";
  });

  afterEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = originalToken;
  });

  it("echoes the challenge when mode and token match", async () => {
    const result = await handleWebhookVerification({
      mode: "subscribe",
      token: "verify-me",
      challenge: "abc123",
    });
    expect(result).toEqual({ status: 200, body: "abc123" });
  });

  it("rejects a mismatched token", async () => {
    const result = await handleWebhookVerification({
      mode: "subscribe",
      token: "wrong",
      challenge: "abc123",
    });
    expect(result.status).toBe(403);
  });
});

describe("handleIncomingWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (verifyWebhookSignature as any).mockReturnValue(true);
    (isDuplicateMessage as any).mockResolvedValue(false);
  });

  it("returns 401 and does nothing else when the signature is invalid", async () => {
    (verifyWebhookSignature as any).mockReturnValue(false);

    const result = await handleIncomingWebhook(textPayload("15551234567", "hi"), "sha256=bad");

    expect(result.status).toBe(401);
    expect(isDuplicateMessage).not.toHaveBeenCalled();
  });

  it("acks status-callback payloads with no messages array", async () => {
    const result = await handleIncomingWebhook(
      JSON.stringify({ entry: [{ changes: [{ value: { statuses: [] } }] }] }),
      "sha256=ok"
    );

    expect(result.status).toBe(200);
    expect(findProfileByPhone).not.toHaveBeenCalled();
  });

  it("skips a duplicate message", async () => {
    (isDuplicateMessage as any).mockResolvedValue(true);

    const result = await handleIncomingWebhook(textPayload("15551234567", "hi"), "sha256=ok");

    expect(result.status).toBe(200);
    expect(logInbound).not.toHaveBeenCalled();
  });

  it("replies with a text-only message for non-text payloads and creates no job", async () => {
    const payload = JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: "15551234567", id: "wamid.1", type: "image" }],
              },
            },
          ],
        },
      ],
    });

    const result = await handleIncomingWebhook(payload, "sha256=ok");

    expect(result.status).toBe(200);
    expect(logInbound).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: null, body: "[image]" })
    );
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("teks")
    );
    expect(createJob).not.toHaveBeenCalled();
  });

  it("replies with a signup link for an unknown sender", async () => {
    (findProfileByPhone as any).mockResolvedValue(null);

    const result = await handleIncomingWebhook(textPayload("15551234567", "hi"), "sha256=ok");

    expect(result.status).toBe(200);
    expect(logInbound).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: null, body: "hi" })
    );
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("http://localhost:3000/agent")
    );
    expect(createJob).not.toHaveBeenCalled();
  });

  it("replies with an inactive-account message when the profile isn't active", async () => {
    (findProfileByPhone as any).mockResolvedValue({
      id: "profile-1",
      status: "pending",
      phoneVerifiedAt: null,
    });

    const result = await handleIncomingWebhook(textPayload("15551234567", "hi"), "sha256=ok");

    expect(result.status).toBe(200);
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("belum aktif")
    );
    expect(createJob).not.toHaveBeenCalled();
  });

  it("verifies the phone when the link code matches", async () => {
    (findProfileByPhone as any).mockResolvedValue({
      id: "profile-1",
      status: "active",
      phoneVerifiedAt: null,
      linkCode: "123456",
      linkCodeExpires: new Date(Date.now() + 60_000),
    });
    (matchesLinkCode as any).mockReturnValue(true);

    const result = await handleIncomingWebhook(textPayload("15551234567", "123456"), "sha256=ok");

    expect(result.status).toBe(200);
    expect(markPhoneVerified).toHaveBeenCalledWith("profile-1");
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("terhubung")
    );
    expect(createJob).not.toHaveBeenCalled();
  });

  it("asks the sender to link via the dashboard when the code doesn't match", async () => {
    (findProfileByPhone as any).mockResolvedValue({
      id: "profile-1",
      status: "active",
      phoneVerifiedAt: null,
      linkCode: "123456",
      linkCodeExpires: new Date(Date.now() + 60_000),
    });
    (matchesLinkCode as any).mockReturnValue(false);

    const result = await handleIncomingWebhook(textPayload("15551234567", "wrong"), "sha256=ok");

    expect(result.status).toBe(200);
    expect(markPhoneVerified).not.toHaveBeenCalled();
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("dashboard")
    );
    expect(createJob).not.toHaveBeenCalled();
  });

  it("creates a job and runs it in the background for a verified, active profile", async () => {
    (findProfileByPhone as any).mockResolvedValue({
      id: "profile-1",
      status: "active",
      phoneVerifiedAt: new Date(),
    });
    (createJob as any).mockResolvedValue({ id: "job-1" });

    const result = await handleIncomingWebhook(
      textPayload("15551234567", "ada produk apa saja?"),
      "sha256=ok"
    );

    expect(result.status).toBe(200);
    expect(createJob).toHaveBeenCalledWith({
      profileId: "profile-1",
      waMessageId: "wamid.1",
      payload: expect.any(String),
    });
    expect(runInBackground).toHaveBeenCalledTimes(1);
    expect(processJob).toHaveBeenCalledWith("job-1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/agent/webhook-handler.test.ts`
Expected: FAIL — `src/lib/agent/webhook-handler.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/agent/webhook-handler.ts`**

```ts
import { baseUrl } from "@/lib/base-url";
import { verifyWebhookSignature, sendWhatsAppText } from "./whatsapp-client";
import { isDuplicateMessage, logInbound, logOutbound } from "./messages";
import { findProfileByPhone, matchesLinkCode, markPhoneVerified } from "./profile";
import { createJob } from "./jobs";
import { processJob } from "./process-job";
import { runInBackground } from "./wait-until";

export async function handleWebhookVerification(params: {
  mode: string | null;
  token: string | null;
  challenge: string | null;
}): Promise<{ status: number; body: string }> {
  if (params.mode === "subscribe" && params.token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return { status: 200, body: params.challenge ?? "" };
  }
  return { status: 403, body: "Forbidden" };
}

async function replyStatic(phone: string, profileId: string | null, body: string): Promise<void> {
  await sendWhatsAppText(phone, body);
  await logOutbound({ profileId, phone, body });
}

export async function handleIncomingWebhook(
  rawBody: string,
  signatureHeader: string | null
): Promise<{ status: number }> {
  if (!verifyWebhookSignature(rawBody, signatureHeader)) {
    return { status: 401 };
  }

  const payload = JSON.parse(rawBody);
  const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) {
    return { status: 200 };
  }

  const waMessageId = message.id as string;
  const phone = `+${message.from}`;

  if (await isDuplicateMessage(waMessageId)) {
    return { status: 200 };
  }

  if (message.type !== "text") {
    await logInbound({ profileId: null, waMessageId, phone, body: `[${message.type}]` });
    await replyStatic(phone, null, "Maaf, saat ini saya hanya bisa membaca pesan teks ya.");
    return { status: 200 };
  }

  const text = String(message.text?.body ?? "");
  const profile = await findProfileByPhone(phone);

  if (!profile) {
    await logInbound({ profileId: null, waMessageId, phone, body: text });
    await replyStatic(
      phone,
      null,
      `Nomor ini belum terdaftar di Nerona Agent. Daftar dulu di ${baseUrl()}/agent`
    );
    return { status: 200 };
  }

  await logInbound({ profileId: profile.id, waMessageId, phone, body: text });

  if (profile.status !== "active") {
    await replyStatic(
      phone,
      profile.id,
      "Akun agent Anda belum aktif. Hubungi admin Nerona untuk mengaktifkan akun."
    );
    return { status: 200 };
  }

  if (!profile.phoneVerifiedAt) {
    if (matchesLinkCode(profile, text)) {
      await markPhoneVerified(profile.id);
      await replyStatic(
        phone,
        profile.id,
        "Nomor WhatsApp Anda berhasil terhubung! Sekarang Anda bisa mulai chat dengan saya."
      );
    } else {
      await replyStatic(
        phone,
        profile.id,
        "Nomor ini belum terverifikasi. Buka dashboard Nerona Agent untuk mendapatkan kode verifikasi."
      );
    }
    return { status: 200 };
  }

  const job = await createJob({ profileId: profile.id, waMessageId, payload: rawBody });
  runInBackground(processJob(job.id));

  return { status: 200 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/agent/webhook-handler.test.ts`
Expected: PASS — 12 passed.

- [ ] **Step 5: Create the thin route `src/app/api/whatsapp/webhook/route.ts`**

```ts
import { NextResponse } from "next/server";
import { handleIncomingWebhook, handleWebhookVerification } from "@/lib/agent/webhook-handler";

export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await handleWebhookVerification({
    mode: url.searchParams.get("hub.mode"),
    token: url.searchParams.get("hub.verify_token"),
    challenge: url.searchParams.get("hub.challenge"),
  });
  return new NextResponse(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const result = await handleIncomingWebhook(raw, signature);
  return NextResponse.json({ ok: result.status === 200 }, { status: result.status });
}
```

- [ ] **Step 6: Verify the project type-checks and builds**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build completes successfully.

- [ ] **Step 7: Commit**

```bash
git add src/lib/agent/webhook-handler.ts src/app/api/whatsapp/webhook/route.ts tests/lib/agent/webhook-handler.test.ts
git commit -m "Add WhatsApp webhook: verification, routing, phone linking, job dispatch"
```

---

### Task 11: Cron retry sweep

**Files:**
- Create: `src/lib/agent/cron.ts`
- Create: `src/app/api/agent/cron/route.ts`
- Create: `vercel.json`
- Test: `tests/lib/agent/cron.test.ts`

**Interfaces:**
- Consumes: `findStuckJobs` from `jobs.ts` (Task 5); `processJob` from `process-job.ts` (Task 9).
- Produces: `runStuckJobSweep(now?: Date): Promise<{ swept: number }>` from `src/lib/agent/cron.ts`. Consumed directly by the route in this task.

- [ ] **Step 1: Add the `CRON_SECRET` env var**

Append to `.env.example`:

```
CRON_SECRET="generate-with-openssl-rand-base64-32"
```

Add a real generated value to `.env.local`. When you deploy to Vercel, set the same value as a Vercel project environment variable named exactly `CRON_SECRET` — Vercel automatically sends it as `Authorization: Bearer <value>` on every Cron Job request.

- [ ] **Step 2: Write the failing tests**

Create `tests/lib/agent/cron.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent/jobs", () => ({
  findStuckJobs: vi.fn(),
}));
vi.mock("@/lib/agent/process-job", () => ({
  processJob: vi.fn(),
}));

import { runStuckJobSweep } from "@/lib/agent/cron";
import { findStuckJobs } from "@/lib/agent/jobs";
import { processJob } from "@/lib/agent/process-job";

describe("runStuckJobSweep", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries with a cutoff 2 minutes before now and processes each stuck job", async () => {
    const now = new Date("2026-07-19T12:00:00Z");
    (findStuckJobs as any).mockResolvedValue([{ id: "job-1" }, { id: "job-2" }]);

    const result = await runStuckJobSweep(now);

    expect(findStuckJobs).toHaveBeenCalledWith(new Date("2026-07-19T11:58:00Z"));
    expect(processJob).toHaveBeenNthCalledWith(1, "job-1");
    expect(processJob).toHaveBeenNthCalledWith(2, "job-2");
    expect(result).toEqual({ swept: 2 });
  });

  it("returns swept: 0 when there is nothing stuck", async () => {
    (findStuckJobs as any).mockResolvedValue([]);

    const result = await runStuckJobSweep(new Date("2026-07-19T12:00:00Z"));

    expect(result).toEqual({ swept: 0 });
    expect(processJob).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/lib/agent/cron.test.ts`
Expected: FAIL — `src/lib/agent/cron.ts` does not exist yet.

- [ ] **Step 4: Implement `src/lib/agent/cron.ts`**

```ts
import { findStuckJobs } from "./jobs";
import { processJob } from "./process-job";

const STUCK_THRESHOLD_MS = 2 * 60 * 1000;

export async function runStuckJobSweep(now: Date = new Date()): Promise<{ swept: number }> {
  const cutoff = new Date(now.getTime() - STUCK_THRESHOLD_MS);
  const stuckJobs = await findStuckJobs(cutoff);

  for (const job of stuckJobs) {
    await processJob(job.id);
  }

  return { swept: stuckJobs.length };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/lib/agent/cron.test.ts`
Expected: PASS — 2 passed.

- [ ] **Step 6: Create the route `src/app/api/agent/cron/route.ts`**

```ts
import { NextResponse } from "next/server";
import { runStuckJobSweep } from "@/lib/agent/cron";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await runStuckJobSweep();
  return NextResponse.json({ ok: true, ...result });
}
```

- [ ] **Step 7: Create `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/agent/cron", "schedule": "*/5 * * * *" }
  ]
}
```

- [ ] **Step 8: Verify the project builds**

Run: `npm run build`
Expected: build completes successfully.

- [ ] **Step 9: Commit**

```bash
git add src/lib/agent/cron.ts src/app/api/agent/cron/route.ts vercel.json tests/lib/agent/cron.test.ts .env.example
git commit -m "Add cron sweep for stuck agent jobs"
```

---

### Task 12: Admin activation

**Files:**
- Create: `src/lib/agent/admin.ts`
- Create: `src/app/api/admin/agent/route.ts`
- Modify: `src/app/api/admin/users/search/route.ts`
- Modify: `src/components/admin/AdminUserPanel.tsx`
- Test: `tests/lib/agent/admin.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts`.
- Produces: `type AgentAdminResult`, `activateAgentProfile(userEmail: string): Promise<AgentAdminResult>`, `disableAgentProfile(userEmail: string): Promise<AgentAdminResult>` from `src/lib/agent/admin.ts`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/agent/admin.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    agentProfile: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { activateAgentProfile, disableAgentProfile } from "@/lib/agent/admin";
import { prisma } from "@/lib/prisma";

describe("activateAgentProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user_not_found when no User matches the email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await activateAgentProfile("missing@example.com");

    expect(result).toEqual({ ok: false, reason: "user_not_found" });
    expect(prisma.agentProfile.upsert).not.toHaveBeenCalled();
  });

  it("upserts the AgentProfile to active", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });

    const result = await activateAgentProfile("user@example.com");

    expect(result).toEqual({ ok: true });
    expect(prisma.agentProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      update: { status: "active" },
      create: { userId: "user-1", status: "active" },
    });
  });
});

describe("disableAgentProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user_not_found when no User matches the email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await disableAgentProfile("missing@example.com");

    expect(result).toEqual({ ok: false, reason: "user_not_found" });
  });

  it("returns profile_not_found when the user has no AgentProfile", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.agentProfile.findUnique as any).mockResolvedValue(null);

    const result = await disableAgentProfile("user@example.com");

    expect(result).toEqual({ ok: false, reason: "profile_not_found" });
  });

  it("sets status to disabled when a profile exists", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.agentProfile.findUnique as any).mockResolvedValue({ id: "profile-1" });

    const result = await disableAgentProfile("user@example.com");

    expect(result).toEqual({ ok: true });
    expect(prisma.agentProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: { status: "disabled" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/agent/admin.test.ts`
Expected: FAIL — `src/lib/agent/admin.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/agent/admin.ts`**

```ts
import { prisma } from "@/lib/prisma";

export type AgentAdminResult =
  | { ok: true }
  | { ok: false; reason: "user_not_found" | "profile_not_found" };

export async function activateAgentProfile(userEmail: string): Promise<AgentAdminResult> {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }

  await prisma.agentProfile.upsert({
    where: { userId: user.id },
    update: { status: "active" },
    create: { userId: user.id, status: "active" },
  });

  return { ok: true };
}

export async function disableAgentProfile(userEmail: string): Promise<AgentAdminResult> {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }

  const profile = await prisma.agentProfile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    return { ok: false, reason: "profile_not_found" };
  }

  await prisma.agentProfile.update({ where: { id: profile.id }, data: { status: "disabled" } });
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/agent/admin.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 5: Create the admin API route `src/app/api/admin/agent/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { activateAgentProfile, disableAgentProfile } from "@/lib/agent/admin";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const userEmail: string | undefined = body?.userEmail;
  const action: string | undefined = body?.action;
  if (!userEmail || (action !== "activate" && action !== "disable")) {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const result =
    action === "activate"
      ? await activateAgentProfile(userEmail)
      : await disableAgentProfile(userEmail);

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Add `agentProfile` to the admin user-search response**

In `src/app/api/admin/users/search/route.ts`, the `prisma.user.findUnique` call's `select` currently reads:

```ts
    select: {
      id: true,
      email: true,
      name: true,
      licenses: { select: { id: true, status: true, source: true, planId: true } },
      enrollments: {
        select: { courseId: true, source: true, course: { select: { slug: true, title: true } } },
      },
    },
```

Replace with:

```ts
    select: {
      id: true,
      email: true,
      name: true,
      licenses: { select: { id: true, status: true, source: true, planId: true } },
      enrollments: {
        select: { courseId: true, source: true, course: { select: { slug: true, title: true } } },
      },
      agentProfile: { select: { status: true, whatsappPhone: true, phoneVerifiedAt: true } },
    },
```

- [ ] **Step 7: Add an Agent section to `AdminUserPanel.tsx`**

Replace `src/components/admin/AdminUserPanel.tsx` in full with:

```tsx
"use client";

import { useState } from "react";

interface CourseSummary {
  id: string;
  slug: string;
  title: string;
}

interface PlanSummary {
  id: string;
  name: string;
  priceLabel: string | null;
}

interface UserResult {
  id: string;
  email: string;
  name: string | null;
  licenses: { id: string; status: string; source: string; planId: string | null }[];
  enrollments: { courseId: string; source: string; course: { slug: string; title: string } }[];
  agentProfile: { status: string; whatsappPhone: string | null; phoneVerifiedAt: string | null } | null;
}

export function AdminUserPanel() {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<UserResult | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [planId, setPlanId] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function handleSearch() {
    setError("");
    setSearching(true);
    setUser(null);

    const res = await fetch(`/api/admin/users/search?email=${encodeURIComponent(email)}`);
    const data = await res.json().catch(() => null);
    setSearching(false);

    if (!res.ok || !data?.ok) {
      setError(data?.message || "Pengguna tidak ditemukan.");
      return;
    }
    setUser(data.user);
    setCourses(data.courses);
    setPlans(data.plans);
    setPlanId((current) => current || data.user.licenses[0]?.planId || data.plans[0]?.id || "");
  }

  function currentAmount(): number | undefined {
    if (!amount) return undefined;
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
  }

  async function handleLicenseAction(action: "grant" | "revoke") {
    if (!user) return;
    setActionLoading(true);
    await fetch("/api/admin/licenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail: user.email,
        action,
        planId: action === "grant" ? planId : undefined,
        note: note || undefined,
        amount: currentAmount(),
      }),
    });
    await handleSearch();
    setActionLoading(false);
  }

  async function handleEnrollmentAction(courseId: string, action: "grant" | "revoke") {
    if (!user) return;
    setActionLoading(true);
    await fetch("/api/admin/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail: user.email,
        courseId,
        action,
        note: note || undefined,
        amount: currentAmount(),
      }),
    });
    await handleSearch();
    setActionLoading(false);
  }

  async function handleAgentAction(action: "activate" | "disable") {
    if (!user) return;
    setActionLoading(true);
    await fetch("/api/admin/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail: user.email, action }),
    });
    await handleSearch();
    setActionLoading(false);
  }

  const license = user?.licenses[0];
  const enrolledCourseIds = new Set(user?.enrollments.map((e) => e.courseId));

  return (
    <div className="mt-8 max-w-xl">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pengguna</h2>

      <div className="mt-2 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="pengguna@contoh.com"
          className="flex-1 rounded-xl bg-gray-100 px-3 py-2 text-sm ring-0 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-white/10 dark:focus:bg-gray-900 text-gray-950 dark:text-white"
        />
        <button
          onClick={handleSearch}
          disabled={searching || !email}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {searching ? "Mencari..." : "Cari"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {user && (
        <div className="mt-6 space-y-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {user.name ?? user.email} ({user.email})
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan (opsional)"
              className="flex-1 rounded-xl bg-gray-100 px-3 py-2 text-sm ring-0 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-white/10 dark:focus:bg-gray-900 text-gray-950 dark:text-white"
            />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Jumlah Rp (opsional)"
              className="w-36 rounded-xl bg-gray-100 px-3 py-2 text-sm ring-0 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-white/10 dark:focus:bg-gray-900 text-gray-950 dark:text-white"
            />
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
            <p className="font-medium text-gray-900 dark:text-white">Lisensi</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Status: {license?.status ?? "belum ada"}
            </p>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="mt-2 rounded-xl bg-gray-100 px-3 py-2 text-sm ring-0 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-white/10 dark:focus:bg-gray-900 text-gray-950 dark:text-white"
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {plan.priceLabel ?? "harga belum diatur"}
                </option>
              ))}
            </select>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleLicenseAction("grant")}
                disabled={actionLoading || !planId}
                className="rounded-full bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                Berikan
              </button>
              <button
                onClick={() => handleLicenseAction("revoke")}
                disabled={actionLoading || !license || license.status === "revoked"}
                className="rounded-full bg-gray-100 px-3.5 py-1.5 text-sm font-medium text-gray-950 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                Cabut
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
            <p className="font-medium text-gray-900 dark:text-white">Agent</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Status: {user.agentProfile?.status ?? "belum ada"}
              {user.agentProfile?.whatsappPhone
                ? ` — ${user.agentProfile.whatsappPhone} (${
                    user.agentProfile.phoneVerifiedAt ? "terverifikasi" : "belum terverifikasi"
                  })`
                : ""}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleAgentAction("activate")}
                disabled={actionLoading || user.agentProfile?.status === "active"}
                className="rounded-full bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                Aktifkan
              </button>
              <button
                onClick={() => handleAgentAction("disable")}
                disabled={actionLoading || !user.agentProfile || user.agentProfile.status === "disabled"}
                className="rounded-full bg-gray-100 px-3.5 py-1.5 text-sm font-medium text-gray-950 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                Nonaktifkan
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="font-medium text-gray-900 dark:text-white">Kelas</p>
            {courses.map((course) => {
              const enrolled = enrolledCourseIds.has(course.id);
              return (
                <div
                  key={course.id}
                  className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10"
                >
                  <span className="text-sm text-gray-900 dark:text-white">
                    {course.title}
                    {enrolled ? " — terdaftar" : ""}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEnrollmentAction(course.id, "grant")}
                      disabled={actionLoading || enrolled}
                      className="rounded-full bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                    >
                      Berikan
                    </button>
                    <button
                      onClick={() => handleEnrollmentAction(course.id, "revoke")}
                      disabled={actionLoading || !enrolled}
                      className="rounded-full bg-gray-100 px-3.5 py-1.5 text-sm font-medium text-gray-950 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                    >
                      Cabut
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Verify the project type-checks and builds**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build completes successfully.

- [ ] **Step 9: Commit**

```bash
git add src/lib/agent/admin.ts src/app/api/admin/agent/route.ts src/app/api/admin/users/search/route.ts src/components/admin/AdminUserPanel.tsx tests/lib/agent/admin.test.ts
git commit -m "Add admin activation for agent profiles"
```

---

### Task 13: Owner dashboard — phone linking

**Files:**
- Create: `src/app/api/agent/link/route.ts`
- Create: `src/app/api/agent/status/route.ts`
- Create: `src/app/agent/page.tsx`
- Create: `src/components/agent/AgentLinkPanel.tsx`

**Interfaces:**
- Consumes: `requireUser` from `src/lib/session-guards.ts` (existing); `getOwnProfile`, `normalizePhone`, `startPhoneLink` from `src/lib/agent/profile.ts` (Task 3); `WHATSAPP_DISPLAY_NUMBER` from env.

- [ ] **Step 1: Add the `WHATSAPP_DISPLAY_NUMBER` env var**

Append to `.env.example`:

```
WHATSAPP_DISPLAY_NUMBER="+1 555 123 4567"
```

Set it in `.env.local` to the human-readable form of your Meta test number.

- [ ] **Step 2: Create `src/app/api/agent/link/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOwnProfile, normalizePhone, startPhoneLink } from "@/lib/agent/profile";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const phone: string | undefined = body?.phone;
  if (!phone) {
    return NextResponse.json(
      { ok: false, message: "Nomor WhatsApp belum diisi." },
      { status: 400 }
    );
  }

  const profile = await getOwnProfile(session.user.id);
  if (!profile || profile.status !== "active") {
    return NextResponse.json(
      { ok: false, message: "Akun agent Anda belum aktif." },
      { status: 403 }
    );
  }

  const result = await startPhoneLink(profile.id, normalizePhone(phone));
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: "Nomor ini sudah terhubung ke akun lain." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, code: result.code, expires: result.expires });
}
```

- [ ] **Step 3: Create `src/app/api/agent/status/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOwnProfile } from "@/lib/agent/profile";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const profile = await getOwnProfile(session.user.id);
  return NextResponse.json({
    ok: true,
    profile: profile
      ? {
          whatsappPhone: profile.whatsappPhone,
          phoneVerifiedAt: profile.phoneVerifiedAt,
          status: profile.status,
        }
      : null,
  });
}
```

- [ ] **Step 4: Create `src/components/agent/AgentLinkPanel.tsx`**

```tsx
"use client";

import { useState } from "react";

interface AgentLinkPanelProps {
  displayNumber: string;
  whatsappPhone: string | null;
  phoneVerifiedAt: string | null;
}

export function AgentLinkPanel({
  displayNumber,
  whatsappPhone,
  phoneVerifiedAt,
}: AgentLinkPanelProps) {
  const [phone, setPhone] = useState(whatsappPhone ?? "");
  const [code, setCode] = useState<string | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState(phoneVerifiedAt);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/agent/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok || !data?.ok) {
      setError(data?.message || "Gagal membuat kode tautan.");
      return;
    }
    setCode(data.code);
    setExpires(data.expires);
    setVerifiedAt(null);
  }

  async function handleRefreshStatus() {
    const res = await fetch("/api/agent/status");
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok && data.profile) {
      setVerifiedAt(data.profile.phoneVerifiedAt);
    }
  }

  if (verifiedAt) {
    return (
      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
        <p className="font-medium text-gray-900 dark:text-white">WhatsApp terhubung ✓</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Nomor: {whatsappPhone}. Anda sekarang bisa chat langsung dengan Nerona Agent di{" "}
          {displayNumber}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 max-w-md">
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="08123456789"
          className="flex-1 rounded-xl bg-gray-100 px-3 py-2 text-sm ring-0 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-white/10 dark:focus:bg-gray-900 text-gray-950 dark:text-white"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !phone}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Hubungkan"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {code && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Kirim kode berikut ke WhatsApp {displayNumber} untuk menyelesaikan tautan:
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-widest text-gray-950 dark:text-white">
            {code}
          </p>
          {expires && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Berlaku sampai {new Date(expires).toLocaleTimeString("id-ID")}
            </p>
          )}
          <button
            onClick={handleRefreshStatus}
            className="mt-4 rounded-full bg-gray-100 px-3.5 py-1.5 text-sm font-medium text-gray-950 transition hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          >
            Cek status
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `src/app/agent/page.tsx`**

```tsx
import { requireUser } from "@/lib/session-guards";
import { getOwnProfile } from "@/lib/agent/profile";
import { AgentLinkPanel } from "@/components/agent/AgentLinkPanel";

export default async function AgentPage() {
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

- [ ] **Step 6: Verify the project type-checks and builds**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build completes successfully.

- [ ] **Step 7: Manually verify the dashboard flow**

Run: `npm run dev`. Sign in as a user whose `AgentProfile.status` is `"active"` (activate one via `/admin` from Task 12 first). Visit `http://localhost:3000/agent`, enter a phone number, click "Hubungkan", and confirm a 6-digit code appears with an expiry time. Stop the dev server once confirmed (full verification against a real WhatsApp number happens in Task 15).

- [ ] **Step 8: Commit**

```bash
git add src/app/api/agent/link/route.ts src/app/api/agent/status/route.ts src/app/agent/page.tsx src/components/agent/AgentLinkPanel.tsx .env.example
git commit -m "Add owner dashboard for WhatsApp phone linking"
```

---

### Task 14: Update README

**Files:**
- Modify: `README.md`

**Interfaces:**
- None — documentation only.

- [ ] **Step 1: Add a "Nerona Agent setup" section to `README.md`**

After the existing "## Auth methods" section, insert:

```markdown
## Nerona Agent (WhatsApp AI assistant)

Additional setup beyond the base site:

1. Add to `.env.local`:
   - `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_APP_SECRET` /
     `WHATSAPP_VERIFY_TOKEN` — from a Meta app with the WhatsApp product added (see
     `docs/superpowers/plans/2026-07-19-nerona-agent-foundation.md` for the full walkthrough).
   - `WHATSAPP_DISPLAY_NUMBER` — the human-readable form of that number, shown to owners on
     `/agent`.
   - `ANTHROPIC_API_KEY` — from https://console.anthropic.com.
   - `AGENT_MODEL` — defaults to `claude-sonnet-5`.
   - `CRON_SECRET` — generate with `openssl rand -base64 32`; also set as a Vercel project env
     var with the same name so Vercel Cron authenticates automatically.
2. For local development, expose `http://localhost:3000` with a tunnel (e.g. `ngrok http 3000`)
   and configure the tunnel's HTTPS URL + `/api/whatsapp/webhook` as the Meta app's webhook
   callback URL, subscribed to the `messages` field.
3. Activate a user's agent access from `/admin` ("Agent" section — Aktifkan), then have that
   user link their WhatsApp number from `/agent`.

Agent-specific unit tests live in `tests/lib/agent/`. The webhook and Claude tool loop are
verified manually against Meta's test number and test recipients — see the Phase 1 plan's
"complete when" checklist.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Document nerona-agent setup in README"
```

---

### Task 15: Full verification and manual end-to-end check

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: all tests pass (Foundation phase's existing ~14 files plus this phase's 11 new `tests/lib/agent/*.test.ts` files).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build completes successfully with no type errors.

- [ ] **Step 3: Manual end-to-end check against Meta's test number**

With the dev server tunneled (Task 14, Step 2) and the webhook subscribed:

1. From `/admin`, activate the agent for your own test account.
2. From `/agent`, enter your WhatsApp number and get the 6-digit code.
3. From WhatsApp (using a number added as a test recipient in the Meta app), send the code
   to the test number. Confirm you receive the "berhasil terhubung" welcome reply, and that
   `/agent` (or the "Cek status" button) now shows "WhatsApp terhubung ✓".
4. Send a normal message, e.g. "halo, kamu siapa?". Confirm you receive a Claude-generated
   reply in Bahasa Indonesia within a few seconds.
5. Send the exact same WhatsApp message twice in quick succession by re-delivering via Meta's
   webhook test tool (or check logs) — confirm no duplicate reply (dedupe working).
6. Temporarily set `ANTHROPIC_API_KEY` to an invalid value, restart the dev server, send a
   message, and confirm you eventually receive the "kendala teknis" apology after the cron
   sweep exhausts retries (or trigger `GET /api/agent/cron` manually with the correct
   `Authorization: Bearer <CRON_SECRET>` header to speed this up). Restore the valid key
   afterward.

---

## Phase 1 complete when

- `npm test` passes with all `tests/lib/agent/*.test.ts` files green alongside the existing suite.
- `npm run build` succeeds.
- An admin can activate a user's agent access from `/admin`, and that user can link their
  WhatsApp number from `/agent` by texting a 6-digit code to the Nerona test number.
- A linked, active owner can chat with the agent on WhatsApp and get Claude-generated replies
  that reference the conversation's own history.
- Unknown senders, non-text messages, inactive accounts, and duplicate webhook deliveries are
  all handled without ever calling Claude.
- A forced Claude failure results in retries via the cron sweep and, after 3 attempts, an
  apology message to the owner.

**Next phase:** Notes + memory tools (`add_note`, `list_notes`, `delete_note`,
`remember_fact`, `forget_fact`) and their `/agent/notes` / `/agent/memory` dashboard pages —
written as its own plan once this phase is verified working end-to-end.
