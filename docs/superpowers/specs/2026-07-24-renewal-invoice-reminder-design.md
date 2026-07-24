# Renewal Reminder + PDF Invoice (H-7) — Design

**Date:** 2026-07-24
**Status:** Approved (go straight to implementation per user)

## Summary

At H-7 before a paid package expires, the system emails the tenant a renewal reminder
with a **PDF invoice attached**, and the renewal request is created at the same time.
Builds directly on [[nerona-auto-renew]]: the daily renewal cron's lead time moves from
3 → **7 days**, and creating a renewal request now also generates the invoice PDF and
sends the reminder email. A download endpoint lets the tenant re-fetch the invoice
anytime.

Email only (Resend, already configured). PDF via `pdf-lib` (pure JS, serverless-safe, no
headless browser, no fonts to bundle). Scope: **renewals only** (not first purchases).

## Key decisions

- Lead time: `generateDueRenewals` default `leadDays` **3 → 7**.
- Invoice = a real **PDF file attached to the reminder email** (not an HTML page).
- Channel: **email** (Resend). WhatsApp reminder is out of scope.
- Send is **best-effort**: a PDF/email failure must NOT prevent the renewal request from
  being created. Because the cron is idempotent (skips users with a pending request),
  the email is sent exactly once — on the run that creates the request.

## New dependency

- `pdf-lib` (add to `package.json`). Pure TypeScript, works on Vercel Node runtime;
  standard Helvetica fonts are embedded (no external font files).

## Backend

### `src/lib/billing/invoice.ts` (new)
```ts
export interface InvoiceData {
  invoiceNumber: string;
  issuedAt: Date;
  tenantName: string;      // name or email
  businessName?: string | null;
  email: string;
  productLabel: string;    // "Agent WhatsApp" | "Metadata"
  planName: string;        // "Pro" | "Business"
  periodLabel: string;     // e.g. "Perpanjangan 1 bulan"
  priceLabel: string;      // e.g. "Rp 99.000" (from pricing tiers)
  bank: { bankName: string; accountNumber: string; accountHolder: string; instructions: string };
}
export async function buildInvoicePdf(data: InvoiceData): Promise<Buffer>
```
Renders a one-page A4 invoice with `pdf-lib`: header ("Nerona" + "INVOICE" + number + date),
bill-to block (tenant/business/email), a line item (product + plan + period + priceLabel),
and a "Pembayaran" block with the bank name / account number / holder / instructions.
Returns a `Buffer` (from `pdfDoc.save()` → `Uint8Array` → `Buffer.from`).

Invoice number is derived deterministically from the order id so re-downloads match:
`INV-<yyyymm of issuedAt>-<last 6 of order id, uppercased>`.

### `src/lib/mail.ts` (extend)
```ts
export async function sendRenewalInvoiceEmail(
  email: string,
  params: { tenantName: string; productLabel: string; planName: string; priceLabel: string;
            invoiceNumber: string; pdf: Buffer }
): Promise<void>
```
Uses `resend.emails.send({ from: FROM_EMAIL, to: email, subject, html, attachments:
[{ filename: \`invoice-${invoiceNumber}.pdf\`, content: pdf }] })`. Indonesian subject/body
("Perpanjangan paket Anda jatuh tempo — invoice terlampir"), with a short instruction to
transfer and upload the receipt, and the app URL.

### `src/lib/billing/renewals.ts` (extend)
- Change `leadDays` default to `7`.
- Widen the `findMany` selects to include the user's contact fields:
  agent → `user: { select: { email: true, name: true, businessName: true } }`;
  license → same via its `user` relation.
- After each successful `orderRequest.create`, build + send the invoice, best-effort:
  ```ts
  try {
    const bank = await getPaymentSettings();
    const priceLabel = await priceLabelFor(product, planName); // agentTiers()/metadataTiers()
    const pdf = await buildInvoicePdf({ ...invoiceData });
    await sendRenewalInvoiceEmail(user.email, { ...emailParams, pdf });
  } catch (err) { console.error("[renewals] invoice/email failed", err); }
  ```
  The `create` happens first; the try/catch wraps only the invoice+email so a failure
  never rolls back or skips the renewal.
- `periodLabel` = "Perpanjangan 1 bulan" (kept simple; the exact new expiry is computed at
  fulfillment via `renewedExpiryFrom`, not needed on the pre-payment invoice).

### `GET /api/orders/[id]/invoice` (new route)
- `requireUser()`; load the order via `getUserOrder(session.user.id, params.id)` (returns
  null if not owned) → 404 when null.
- Rebuild the invoice PDF for that order (same data assembly as the cron path, factored
  into a shared helper `invoiceDataForOrder(order, user, bank, priceLabel)` if convenient).
- Respond with the PDF: `new NextResponse(pdf, { headers: { "Content-Type":
  "application/pdf", "Content-Disposition": \`inline; filename="invoice-<no>.pdf"\` } })`.

## UI

`src/app/order/[id]/page.tsx`: add an "Unduh invoice" link to `/api/orders/${order.id}/invoice`
(open in a new tab) in the order detail — visible for renewal orders (or any paid order).
Small, reuses the existing page. No other UI change.

## Data flow

1. Daily cron → `generateDueRenewals(now, 7)` finds a sub expiring within 7 days with no
   pending request → creates the renewal `OrderRequest`.
2. Immediately after create: assemble invoice data (tenant + plan price + bank) → build PDF
   → email it to the tenant (best-effort).
3. Tenant gets the email + PDF, transfers, uploads the receipt (`/finance` banner → `/order/<id>`).
4. Owner confirms in `/admin/orders` → +1 month (unchanged from auto-renew).
5. Tenant may re-download the invoice anytime via the order page link.

## Error handling / edge cases

- Missing `RESEND_API_KEY` / send error → caught, logged; renewal still created.
- Missing bank settings → invoice still renders with blank/`-` bank fields (uses
  `getPaymentSettings()` which returns empty strings when unset).
- `priceLabel` unknown → falls back to "Hubungi admin".
- Idempotency preserved: one email per renewal (create-branch only).
- Invoice download for a non-owned/nonexistent order → 404 (never leak other tenants').

## Testing

- `buildInvoicePdf`: returns a non-empty `Buffer` whose first 5 bytes are `%PDF-`; does not
  throw on minimal data (including empty bank fields, missing businessName).
- `sendRenewalInvoiceEmail`: calls `resend.emails.send` with `to`, an Indonesian subject,
  and an `attachments` entry whose `filename` includes the invoice number and `content` is
  the passed Buffer (mock `resend`).
- `generateDueRenewals`: on create, `buildInvoicePdf` + `sendRenewalInvoiceEmail` are
  invoked; when `sendRenewalInvoiceEmail` throws, the `orderRequest.create` still happened
  and `created` still counts it (mock the invoice + mail modules); default cutoff uses
  `leadDays = 7`.
- Route: 401 unauthenticated; 404 for an order the user doesn't own; 200 with
  `Content-Type: application/pdf` for an owned order.

## Not doing (YAGNI / later)

- Payment gateway; WhatsApp reminder; invoice for first-time purchases (renewals only);
  numeric pricing / tax lines (uses the existing price label string); storing the PDF (it's
  regenerated deterministically on demand); multi-currency.
