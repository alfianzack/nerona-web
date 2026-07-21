# Nerona Agent × Tenant Shop — Tools + Daily Recap (Design)

**Date:** 2026-07-22
**Status:** Approved

## 1. Goal

Give the Nerona Agent (WhatsApp AI assistant) the ability to operate the owner's
tenant shop by chat: record sales, check products/stock, report revenue, and update
order status. Add a proactive daily sales recap pushed via WhatsApp. This turns the
shop from a web-only record-keeper into "bookkeeping by chat" — the headline feature
for tenant shop owners.

Agent-recorded data lands in the same `ShopProduct`/`ShopOrder` tables the web
Produk/Transaksi/Dashboard pages use, so everything the owner records by WhatsApp
appears on the website immediately, and vice versa.

## 2. Scope

**In scope**

- Tool-calling loop in the agent's reply pipeline (OpenAI-format function calling
  via the existing Sumopod gateway).
- Five tools: `list_products`, `get_sales_summary`, `list_recent_orders`,
  `record_sale`, `update_order_status`.
- `shop.ts` extension: optional `status` on `OrderInput`.
- Daily recap cron (hourly runner, 20:00 local send time per profile timezone).
- Cleanup: drop the dead `AgentProduct`/`AgentOrder`/`AgentOrderItem` models.

**Out of scope (later phases)**

- Creating/editing/deleting products via chat (web-only for now).
- Stock auto-decrement on sale (parity with web flow, which does not decrement).
- Recap opt-in/out toggle and configurable send time.
- Confirmation-before-save flow — sales are recorded immediately by decision.

## 3. Architecture

```
WhatsApp → webhook → AgentJob → processJob
                                   └─ runToolLoop (NEW, replaces single generateReply call)
                                        ├─ Sumopod chat completion (tools=[...])
                                        ├─ tool_calls? → executeTool(userId, name, args)
                                        │                  └─ src/lib/shop.ts / shop-dashboard.ts
                                        └─ repeat (max 5 rounds) → final text → sendWhatsAppText
```

- **`src/lib/agent/tools.ts` (new):** OpenAI-format tool definitions
  (`AGENT_TOOLS`) + dispatcher `executeTool(userId: string, name: string, argsJson:
  string): Promise<string>` returning a JSON string result. Pure orchestration over
  existing shop lib functions; unit-tested.
- **`src/lib/agent/claude-client.ts`:** add `runToolLoop({ systemPrompt, history,
  userId })`. Sends `tools: AGENT_TOOLS`; while the response contains `tool_calls`,
  executes each via `executeTool`, appends `role: "tool"` results, and re-calls.
  After 5 rounds without final text, makes one final call **without** tools so the
  owner always gets a reply.
- **`src/lib/agent/process-job.ts`:** resolve `userId` from the profile and call
  `runToolLoop` instead of `generateReply`. Failure path (retries + apology message)
  unchanged.
- **`src/lib/agent/context.ts`:** replace the "Anda belum memiliki alat" line with
  tool guidance: record sales immediately without asking for confirmation; after
  saving, echo back items + total in Rupiah; use tools for any question about
  products, stock, sales, or orders rather than guessing.

All tool executions are scoped to `profile.userId` — the same scoping the web shop
uses. The agent can never touch another tenant's data because `userId` is injected
by the dispatcher, never taken from model output.

## 4. Tools

| Tool | Backs onto | Input | Output |
|---|---|---|---|
| `list_products` | `listProductsPaged` | `q?` (search), `limit?` (default 20) | active products: name, price, stock |
| `get_sales_summary` | `getDashboardSummary` + small range helper | `period`: `today` \| `week` \| `month` | revenue (paid+done), order count, best sellers |
| `list_recent_orders` | `listOrdersPaged` | `limit?` (default 5), `status?` | orders with items, customer, status, total, time |
| `record_sale` | `createOrder` | `items: [{ product_name, qty, unit_price? }]`, `customer_name?`, `note?`, `status?` (default `paid`) | saved order: id, items, total |
| `update_order_status` | `updateOrderStatus` | `order_id`, `status` | updated order or not-found error |

**Period definitions for `get_sales_summary`** (in the profile's timezone):
`today` = since local midnight; `week` = the last 7 local days including today;
`month` = since the 1st of the current calendar month (matches the dashboard's
"bulan ini").

**Product matching in `record_sale`:** case-insensitive contains match against the
owner's active products.

- Exactly one match → link `productId`; `unit_price` defaults to the product's price.
- Multiple matches → return `{ ok: false, error, candidates: [...] }` so the model
  asks the owner which product was meant.
- No match → allowed as a free-text item (`productId: null`) **only if**
  `unit_price` was provided; otherwise return an error asking for the price.

**Validation:** at least one item; `qty >= 1`; `unit_price >= 0`; `status` must be
a valid `OrderStatus`.

**`shop.ts` change:** `OrderInput` gains `status?: OrderStatus` (validated, default
remains `"new"`), applied in `createOrder`. Web callers are unaffected.

## 5. Daily recap

- **Route:** `GET /api/agent/cron/recap`, authorized with the existing
  `CRON_SECRET` bearer pattern; scheduled hourly in `vercel.json`.
- **Selection:** active profiles with a verified WhatsApp phone whose local hour in
  `profile.timezone` is 20 (i.e. 20:00–20:59), and `lastRecapDate` ≠ today (local).
- **Skip rule:** profiles with zero `ShopOrder` rows created today (local day) are
  skipped — no "Rp 0" spam. Skipped profiles do **not** get `lastRecapDate` stamped,
  which is harmless because the zero-orders check keeps later same-day runs from
  sending anyway.
- **Content:** built by pure function `buildRecapMessage(summary)`: today's revenue
  (paid + done), transaction count, best-selling item, and a low-stock warning
  listing products with `stock <= LOW_STOCK_THRESHOLD` (reused from `@/lib/shop`).
- **Send:** `sendWhatsAppText` + `logOutbound`, then stamp
  `AgentProfile.lastRecapDate` (new `DateTime?` column) to make the hourly cron
  idempotent under retries.
- **Quota:** recaps are outbound messages; the monthly limit counts inbound only,
  so recaps never consume owner quota.

## 6. Error handling

- `executeTool` never throws: every failure returns `{ ok: false, error }` as the
  tool result string so the model can recover conversationally.
- Invalid JSON in tool args → error result back to the model.
- Unknown tool name → error result.
- Loop budget exhausted (5 rounds) → one final completion with tools disabled.
- Terminal job failure keeps today's behavior: retry via `failJob`, then the
  existing apology message.
- Recap cron: a failure sending to one profile is caught and logged; the run
  continues with remaining profiles and reports counts `{ sent, skipped, failed }`.

## 7. Schema changes

1. `AgentProfile.lastRecapDate DateTime?` — recap idempotency.
2. Drop `AgentProduct`, `AgentOrder`, `AgentOrderItem` (confirmed unused anywhere
   in `src/`; they duplicate the Shop* tables and would invite future confusion).

One migration covers both.

## 8. Testing

TDD (Vitest) for all lib logic; components/routes verified via `tsc` + `npm run
build` + manual checks, matching repo convention.

- `tests/lib/agent/tools.test.ts` — each tool: happy path, validation errors,
  product matching (one/many/none), userId scoping, malformed args JSON.
- `tests/lib/agent/tool-loop.test.ts` — mocked Sumopod `fetch`: tool-call round →
  final text; round-budget fallback.
- `tests/lib/agent/recap.test.ts` — `buildRecapMessage` content cases (with/without
  low stock); due-profile selection across timezones and `lastRecapDate` guard.
- `tests/lib/shop-*.test.ts` — `createOrder` honors valid `status`, rejects
  invalid, defaults to `"new"`.
- Manual: end-to-end against Meta's test number — record a sale by chat, see it on
  `/transaksi` and `/dashboard`; trigger recap route with `CRON_SECRET` locally.

## 9. Open questions

None — decisions on confirmation flow (record immediately), recap timing (20:00
local, skip when no orders), and tool scope (no product mutations) were made during
brainstorming.
