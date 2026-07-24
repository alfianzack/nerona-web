# Renewal Reminder + PDF Invoice (H-7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At H-7 before a paid package expires, create the renewal request AND email the tenant a reminder with a PDF invoice attached; let the tenant re-download the invoice anytime.

**Architecture:** Move the renewal cron's lead time to 7 days; on creating a renewal request, generate an invoice PDF (`pdf-lib`) and email it (Resend), best-effort. A download route regenerates the same PDF deterministically. Renewals only.

**Tech Stack:** Next.js 14 (App Router) + TypeScript + Prisma 5 + Vitest + Resend (email) + `pdf-lib` (PDF, new).

## Global Constraints

- Email only (Resend, existing `src/lib/mail.ts`). PDF via `pdf-lib` (pure JS; standard Helvetica fonts embedded — no external font files, serverless-safe).
- Invoice/email are BEST-EFFORT: wrap in try/catch so a failure never prevents the renewal `OrderRequest.create`. Cron idempotency (skip users with a pending request) already guarantees exactly one email per renewal.
- `generateDueRenewals` default `leadDays` = **7**.
- Invoice number is deterministic: `INV-<YYYYMM of order.createdAt>-<last 6 of order id, uppercased>`.
- `productLabel` = `product === "agent" ? "Agent WhatsApp" : "Metadata"`. `priceLabel` from pricing tiers, fallback `"Hubungi admin"`.
- All user-facing copy Indonesian. Import alias `@/` → `src/`. Tests mock `@/lib/prisma` and other deps.
- Commit on master with EXPLICIT file paths; NEVER `git add -A`. `core.autocrlf=true` prints harmless CRLF warnings.

---

### Task 1: `pdf-lib` + invoice builder

**Files:**
- Modify: `package.json` (add `pdf-lib`)
- Create: `src/lib/billing/invoice.ts`
- Test: `tests/lib/invoice.test.ts`

**Interfaces:**
- Produces:
  - `InvoiceData` (see below)
  - `buildInvoicePdf(data: InvoiceData): Promise<Buffer>`
  - `invoiceNumberFor(orderId: string, createdAt: Date): string`
  - `priceLabelFor(product: string, planName: string): Promise<string>`

- [ ] **Step 1: Install `pdf-lib`**

Run: `npm install pdf-lib`
Expected: `pdf-lib` added to `dependencies`; install completes (postinstall runs `prisma generate`).

- [ ] **Step 2: Write the failing test** — `tests/lib/invoice.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { buildInvoicePdf, invoiceNumberFor, type InvoiceData } from "@/lib/billing/invoice";

const base: InvoiceData = {
  invoiceNumber: "INV-202607-ABC123",
  issuedAt: new Date("2026-07-24T00:00:00Z"),
  tenantName: "Toko Maju",
  businessName: "Toko Maju Jaya",
  email: "toko@example.com",
  productLabel: "Agent WhatsApp",
  planName: "Pro",
  periodLabel: "Perpanjangan 1 bulan",
  priceLabel: "Rp 99.000",
  bank: { bankName: "BCA", accountNumber: "1234567890", accountHolder: "PT Nerona", instructions: "Transfer tepat nominal" },
};

describe("invoiceNumberFor", () => {
  it("is deterministic from order id + createdAt month", () => {
    expect(invoiceNumberFor("clabc000def123456", new Date("2026-07-01T00:00:00Z"))).toBe("INV-202607-123456");
  });
});

describe("buildInvoicePdf", () => {
  it("returns a PDF buffer (starts with %PDF-)", async () => {
    const buf = await buildInvoicePdf(base);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("does not throw with empty bank fields and no businessName", async () => {
    const buf = await buildInvoicePdf({
      ...base,
      businessName: null,
      bank: { bankName: "", accountNumber: "", accountHolder: "", instructions: "" },
    });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/lib/invoice.test.ts`
Expected: FAIL — cannot find module `@/lib/billing/invoice`.

- [ ] **Step 4: Create `src/lib/billing/invoice.ts`**

```ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";

export interface InvoiceData {
  invoiceNumber: string;
  issuedAt: Date;
  tenantName: string;
  businessName?: string | null;
  email: string;
  productLabel: string;
  planName: string;
  periodLabel: string;
  priceLabel: string;
  bank: { bankName: string; accountNumber: string; accountHolder: string; instructions: string };
}

export function invoiceNumberFor(orderId: string, createdAt: Date): string {
  const ym = `${createdAt.getUTCFullYear()}${String(createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
  return `INV-${ym}-${orderId.slice(-6).toUpperCase()}`;
}

export async function priceLabelFor(product: string, planName: string): Promise<string> {
  const tiers = product === "metadata" ? await metadataTiers() : agentTiers();
  return tiers.find((t) => t.name === planName)?.priceLabel ?? "Hubungi admin";
}

export async function buildInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 portrait
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.15);
  const muted = rgb(0.45, 0.45, 0.5);
  const { height } = page.getSize();
  let y = height - 56;

  const text = (
    s: string,
    o: { x?: number; size?: number; f?: typeof font; color?: typeof ink } = {}
  ) => page.drawText(s, { x: o.x ?? 50, y, size: o.size ?? 11, font: o.f ?? font, color: o.color ?? ink });

  text("Nerona", { size: 20, f: bold });
  text("INVOICE", { x: 470, size: 16, f: bold });
  y -= 20;
  text(`No: ${data.invoiceNumber}`, { x: 400, size: 10, color: muted });
  y -= 14;
  text(
    `Tanggal: ${data.issuedAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`,
    { x: 400, size: 10, color: muted }
  );

  y -= 34;
  text("Ditagihkan kepada:", { f: bold });
  y -= 16;
  text(data.businessName || data.tenantName);
  y -= 14;
  text(data.email, { size: 10, color: muted });

  y -= 34;
  text("Item", { f: bold });
  text("Jumlah", { x: 430, f: bold });
  y -= 8;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.85) });
  y -= 18;
  text(`${data.productLabel} — ${data.planName}`);
  text(data.priceLabel, { x: 430 });
  y -= 14;
  text(data.periodLabel, { size: 9, color: muted });

  y -= 40;
  text("Pembayaran (transfer bank):", { f: bold });
  y -= 16;
  text(`Bank: ${data.bank.bankName || "-"}`, { size: 10 });
  y -= 14;
  text(`No. Rekening: ${data.bank.accountNumber || "-"}`, { size: 10 });
  y -= 14;
  text(`Atas Nama: ${data.bank.accountHolder || "-"}`, { size: 10 });
  if (data.bank.instructions) {
    y -= 14;
    text(data.bank.instructions, { size: 9, color: muted });
  }

  y -= 30;
  text("Setelah transfer, unggah bukti di dashboard Nerona untuk aktivasi paket.", {
    size: 9,
    color: muted,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/lib/invoice.test.ts`
Expected: PASS (3).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/billing/invoice.ts tests/lib/invoice.test.ts
git commit -m "feat: PDF invoice builder (pdf-lib)"
```

---

### Task 2: `sendRenewalInvoiceEmail`

**Files:**
- Modify: `src/lib/mail.ts`
- Test: `tests/lib/renewal-invoice-email.test.ts`

**Interfaces:**
- Produces: `sendRenewalInvoiceEmail(email: string, params: { tenantName: string; productLabel: string; planName: string; priceLabel: string; invoiceNumber: string; pdf: Buffer }): Promise<void>`

- [ ] **Step 1: Write the failing test** — `tests/lib/renewal-invoice-email.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({ Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })) }));
vi.mock("@/lib/base-url", () => ({ baseUrl: () => "https://app.test" }));

import { sendRenewalInvoiceEmail } from "@/lib/mail";

beforeEach(() => sendMock.mockReset());

describe("sendRenewalInvoiceEmail", () => {
  it("sends an email with the invoice PDF attached", async () => {
    const pdf = Buffer.from("%PDF-fake");
    await sendRenewalInvoiceEmail("toko@example.com", {
      tenantName: "Toko Maju",
      productLabel: "Agent WhatsApp",
      planName: "Pro",
      priceLabel: "Rp 99.000",
      invoiceNumber: "INV-202607-ABC123",
      pdf,
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe("toko@example.com");
    expect(typeof arg.subject).toBe("string");
    expect(arg.attachments).toHaveLength(1);
    expect(arg.attachments[0].filename).toContain("INV-202607-ABC123");
    expect(arg.attachments[0].content).toBe(pdf);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/renewal-invoice-email.test.ts`
Expected: FAIL — `sendRenewalInvoiceEmail` not exported.

- [ ] **Step 3: Add to `src/lib/mail.ts`** (append a new exported function; reuse the existing `resend`, `FROM_EMAIL`, `baseUrl`)

```ts
export async function sendRenewalInvoiceEmail(
  email: string,
  params: {
    tenantName: string;
    productLabel: string;
    planName: string;
    priceLabel: string;
    invoiceNumber: string;
    pdf: Buffer;
  }
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Perpanjangan paket Anda jatuh tempo — invoice terlampir",
    html: `
      <p>Halo ${params.tenantName},</p>
      <p>Paket <b>${params.productLabel} — ${params.planName}</b> (${params.priceLabel}) Anda akan segera berakhir.
      Invoice <b>${params.invoiceNumber}</b> terlampir pada email ini.</p>
      <p>Silakan lakukan transfer sesuai invoice, lalu unggah bukti transfer di
      <a href="${baseUrl()}/finance">dashboard Nerona</a> agar paket diperpanjang.</p>
      <p>Terima kasih.</p>
    `,
    attachments: [{ filename: `invoice-${params.invoiceNumber}.pdf`, content: params.pdf }],
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/renewal-invoice-email.test.ts`
Expected: PASS (1).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mail.ts tests/lib/renewal-invoice-email.test.ts
git commit -m "feat: renewal invoice reminder email (Resend attachment)"
```

---

### Task 3: Cron sends invoice + email on renewal creation (lead 7)

**Files:**
- Modify: `src/lib/billing/renewals.ts`
- Test: update `tests/lib/renewals.test.ts`

**Interfaces:**
- Consumes: `buildInvoicePdf`, `invoiceNumberFor`, `priceLabelFor` from `@/lib/billing/invoice`; `sendRenewalInvoiceEmail` from `@/lib/mail`; `getPaymentSettings` from `@/lib/payment-settings`.

- [ ] **Step 1: Update the tests** — `tests/lib/renewals.test.ts`

Add mocks (top of file, next to the existing `@/lib/prisma` mock):

```ts
vi.mock("@/lib/billing/invoice", () => ({
  buildInvoicePdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-x")),
  invoiceNumberFor: vi.fn(() => "INV-TEST"),
  priceLabelFor: vi.fn().mockResolvedValue("Rp 99.000"),
}));
vi.mock("@/lib/mail", () => ({ sendRenewalInvoiceEmail: vi.fn() }));
vi.mock("@/lib/payment-settings", () => ({
  getPaymentSettings: vi.fn().mockResolvedValue({ bankName: "BCA", accountNumber: "1", accountHolder: "N", instructions: "" }),
}));
```

Import the mailer and invoice builder for assertions:

```ts
import { sendRenewalInvoiceEmail } from "@/lib/mail";
import { buildInvoicePdf } from "@/lib/billing/invoice";
```

Make `orderRequest.create` resolve to a record (the code now reads `req.id`/`req.createdAt`), and give profiles/licenses a `user`. In the existing `beforeEach`, add:

```ts
(prisma.orderRequest.create as any).mockResolvedValue({ id: "req-1", createdAt: new Date("2026-07-24T00:00:00Z") });
```

Update the agent-creation fixture to include the user relation and assert the email path:

```ts
it("creates an agent renewal and emails an invoice for a due paid profile", async () => {
  (prisma.agentProfile.findMany as any).mockResolvedValue([
    { userId: "u1", plan: "pro", user: { email: "u1@example.com", name: "U1", businessName: null } },
  ]);
  const res = await generateDueRenewals(now, 7);
  expect(prisma.orderRequest.create).toHaveBeenCalledWith({
    data: { userId: "u1", product: "agent", planName: "Pro", isRenewal: true },
  });
  expect(buildInvoicePdf).toHaveBeenCalledTimes(1);
  expect(sendRenewalInvoiceEmail).toHaveBeenCalledWith(
    "u1@example.com",
    expect.objectContaining({ productLabel: "Agent WhatsApp", planName: "Pro", pdf: expect.any(Buffer) })
  );
  expect(res.created).toBe(1);
});

it("still creates the renewal when the invoice email fails (best-effort)", async () => {
  (prisma.agentProfile.findMany as any).mockResolvedValue([
    { userId: "u1", plan: "pro", user: { email: "u1@example.com", name: "U1", businessName: null } },
  ]);
  (sendRenewalInvoiceEmail as any).mockRejectedValueOnce(new Error("smtp down"));
  const res = await generateDueRenewals(now, 7);
  expect(prisma.orderRequest.create).toHaveBeenCalled();
  expect(res.created).toBe(1);
});
```

Update the existing "skips when pending" and metadata tests to include the `user` relation in their fixtures (e.g. `user: { email: "u2@example.com", name: null, businessName: null }` on the license fixture) and keep their existing assertions. Update the "queries with a cutoff" test to call `generateDueRenewals(now, 7)` and still assert the `where` filters.

- [ ] **Step 2: Run to verify RED**

Run: `npm test -- tests/lib/renewals.test.ts`
Expected: FAIL — invoice/email not sent yet; `req.id` undefined path etc.

- [ ] **Step 3: Update `src/lib/billing/renewals.ts`**

Add imports below the existing `prisma` import:

```ts
import { getPaymentSettings } from "@/lib/payment-settings";
import { buildInvoicePdf, invoiceNumberFor, priceLabelFor } from "@/lib/billing/invoice";
import { sendRenewalInvoiceEmail } from "@/lib/mail";
```

Change the signature default: `leadDays = 7`.

Widen both selects to include the user's contact fields:
- agent `findMany` select → `{ userId: true, plan: true, user: { select: { email: true, name: true, businessName: true } } }`
- license `findMany` select → `{ userId: true, plan: { select: { name: true } }, user: { select: { email: true, name: true, businessName: true } } }`

Add a best-effort helper (module-scope, below `hasPending`):

```ts
type RenewalUser = { email: string; name: string | null; businessName: string | null };

async function emailInvoice(
  req: { id: string; createdAt: Date },
  user: RenewalUser,
  product: "agent" | "metadata",
  planName: string
): Promise<void> {
  try {
    const [bank, priceLabel] = await Promise.all([getPaymentSettings(), priceLabelFor(product, planName)]);
    const productLabel = product === "agent" ? "Agent WhatsApp" : "Metadata";
    const invoiceNumber = invoiceNumberFor(req.id, req.createdAt);
    const tenantName = user.name || user.email;
    const pdf = await buildInvoicePdf({
      invoiceNumber,
      issuedAt: req.createdAt,
      tenantName,
      businessName: user.businessName,
      email: user.email,
      productLabel,
      planName,
      periodLabel: "Perpanjangan 1 bulan",
      priceLabel,
      bank,
    });
    await sendRenewalInvoiceEmail(user.email, { tenantName, productLabel, planName, priceLabel, invoiceNumber, pdf });
  } catch (err) {
    console.error("[renewals] invoice/email failed", err);
  }
}
```

In the agent loop, capture the created record and email after counting:

```ts
    const req = await prisma.orderRequest.create({
      data: { userId: p.userId, product: "agent", planName: title(p.plan), isRenewal: true },
    });
    created++;
    await emailInvoice(req, p.user, "agent", title(p.plan));
```

In the metadata loop, likewise:

```ts
    const req = await prisma.orderRequest.create({
      data: { userId: l.userId, product: "metadata", planName: l.plan.name, isRenewal: true },
    });
    created++;
    await emailInvoice(req, l.user, "metadata", l.plan.name);
```

- [ ] **Step 4: Run to verify GREEN**

Run: `npm test -- tests/lib/renewals.test.ts`
Expected: PASS. Then `npm test` once — the only failures should be the 2 pre-existing unrelated `orders.test.ts` ones; confirm no new failures.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/renewals.ts tests/lib/renewals.test.ts
git commit -m "feat: email invoice on renewal creation; lead time 7 days"
```

---

### Task 4: Invoice download route

**Files:**
- Create: `src/app/api/orders/[id]/invoice/route.ts`
- Test: `tests/lib/invoice-route.test.ts`

**Interfaces:**
- Consumes: `getUserOrder` from `@/lib/orders`; `buildInvoicePdf`/`invoiceNumberFor`/`priceLabelFor` from `@/lib/billing/invoice`; `getPaymentSettings`; `prisma`; `authOptions`.

- [ ] **Step 1: Write the failing test** — `tests/lib/invoice-route.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/orders", () => ({ getUserOrder: vi.fn() }));
vi.mock("@/lib/payment-settings", () => ({ getPaymentSettings: vi.fn().mockResolvedValue({ bankName: "BCA", accountNumber: "1", accountHolder: "N", instructions: "" }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/billing/invoice", () => ({
  buildInvoicePdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-x")),
  invoiceNumberFor: vi.fn(() => "INV-TEST"),
  priceLabelFor: vi.fn().mockResolvedValue("Rp 99.000"),
}));

import { GET } from "@/app/api/orders/[id]/invoice/route";
import { getServerSession } from "next-auth";
import { getUserOrder } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

function req() { return new Request("http://test/api/orders/o1/invoice"); }
const ctx = { params: { id: "o1" } };

beforeEach(() => vi.clearAllMocks());

describe("GET /api/orders/[id]/invoice", () => {
  it("401 when unauthenticated", async () => {
    (getServerSession as any).mockResolvedValue(null);
    expect((await GET(req(), ctx)).status).toBe(401);
  });
  it("404 when the order is not owned/found", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1" } });
    (getUserOrder as any).mockResolvedValue(null);
    expect((await GET(req(), ctx)).status).toBe(404);
  });
  it("returns the PDF for an owned order", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1" } });
    (getUserOrder as any).mockResolvedValue({ id: "o1", product: "agent", planName: "Pro", createdAt: new Date("2026-07-24T00:00:00Z") });
    (prisma.user.findUnique as any).mockResolvedValue({ email: "u1@example.com", name: "U1", businessName: null });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npm test -- tests/lib/invoice-route.test.ts`
Expected: FAIL — route module missing.

- [ ] **Step 3: Create `src/app/api/orders/[id]/invoice/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserOrder } from "@/lib/orders";
import { getPaymentSettings } from "@/lib/payment-settings";
import { buildInvoicePdf, invoiceNumberFor, priceLabelFor } from "@/lib/billing/invoice";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const order = await getUserOrder(session.user.id, params.id);
  if (!order) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const [user, bank, priceLabel] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true, businessName: true },
    }),
    getPaymentSettings(),
    priceLabelFor(order.product, order.planName),
  ]);

  const invoiceNumber = invoiceNumberFor(order.id, order.createdAt);
  const productLabel = order.product === "agent" ? "Agent WhatsApp" : "Metadata";
  const pdf = await buildInvoicePdf({
    invoiceNumber,
    issuedAt: order.createdAt,
    tenantName: user?.name || user?.email || "",
    businessName: user?.businessName ?? null,
    email: user?.email || "",
    productLabel,
    planName: order.planName,
    periodLabel: "Perpanjangan 1 bulan",
    priceLabel,
    bank,
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoiceNumber}.pdf"`,
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/invoice-route.test.ts`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/orders/[id]/invoice/route.ts tests/lib/invoice-route.test.ts
git commit -m "feat: tenant invoice download route"
```

---

### Task 5: "Unduh invoice" link on the order page

**Files:**
- Modify: `src/app/order/[id]/page.tsx`

- [ ] **Step 1: Add the link — `src/app/order/[id]/page.tsx`**

READ the file first. Inside the order-detail render (near the status banner / payment section), add a link to the invoice route (opens in a new tab). Use existing styling conventions; place it where it reads naturally (e.g. just under the status banner):

```tsx
        <a
          href={`/api/orders/${order.id}/invoice`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-brand-blue hover:underline"
        >
          Unduh invoice (PDF) ↗
        </a>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds, no type errors; `/order/<id>` shows an "Unduh invoice (PDF)" link that opens the PDF.

- [ ] **Step 3: Commit**

```bash
git add src/app/order/[id]/page.tsx
git commit -m "feat: invoice download link on order page"
```

---

## Self-Review Notes

- **Spec coverage:** pdf-lib + `buildInvoicePdf`/`invoiceNumberFor`/`priceLabelFor` (Task 1); reminder email w/ attachment (Task 2); cron lead-7 + best-effort invoice email on create (Task 3); download route with ownership + 404 (Task 4); order-page link (Task 5). Testing section maps to Tasks 1–4.
- **Deferred (per spec):** gateway, WhatsApp reminder, first-purchase invoices, numeric pricing/tax, storing the PDF.
- **Type consistency:** `InvoiceData`/`buildInvoicePdf`/`invoiceNumberFor`/`priceLabelFor` (Task 1) consumed by Tasks 3 & 4; `sendRenewalInvoiceEmail` (Task 2) consumed by Task 3; `getUserOrder` returns `{ id, product, planName, createdAt, ... }` (existing `ORDER_LIST_SELECT`) consumed by Task 4.
- **Best-effort:** the invoice+email in Task 3 is wrapped so a failure never blocks `orderRequest.create`; idempotency (one email per renewal) is inherited from the existing pending-dedup.
- **Determinism:** invoice number keys off `order.createdAt` (not "now"), so the cron email and later downloads produce the same number.
