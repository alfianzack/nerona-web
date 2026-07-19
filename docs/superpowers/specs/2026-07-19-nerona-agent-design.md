# Nerona Agent — WhatsApp AI Business Assistant

Date: 2026-07-19

## Purpose

A new multi-tenant SaaS product built into nerona-web: business owners subscribe on the
website, register their WhatsApp number, and chat with an AI assistant on WhatsApp to run
their business — save notes, teach it facts it remembers, manage a product catalog, log and
track orders, and sync their schedule to Google Calendar. The assistant is powered by the
Claude API with tool use; WhatsApp connectivity is the official WhatsApp Cloud API through
**one central Nerona-owned number** that every subscribed owner texts.

Decisions locked during brainstorming:

- **Multi-tenant product** — sold to other businesses, like the existing extension licenses.
- **Official WhatsApp Cloud API**, one central number owned by Nerona. Tenants are identified
  by their (verified) sender phone number. No per-tenant Meta setup.
- **Owner-only chat** — only the business owner talks to the agent. Their customers never do.
- **Schedule = Google Calendar sync** — the agent creates/reads events in the owner's own
  Google Calendar; Google handles notifications. No WhatsApp-side reminder scheduler.
- **Extends nerona-web** — same Next.js app, same Supabase Postgres, reusing auth, the admin
  panel, and the manual-grant business model (payment happens off-platform).
- **Claude API** for the agent brain, with a tool loop.
- **Memory = auto-learned facts** (agent calls a `remember_fact` tool when the owner states
  something durable) plus recent conversation history for context.
- **Hosting: Vercel** — webhook ACKs immediately, processes via `waitUntil`, with a Vercel
  cron as retry safety net.

## Explicitly out of scope (this design)

- Customer-facing chat (customers texting the number) and any per-tenant WhatsApp numbers.
- Proactive/outbound messages initiated by the agent (reminders, broadcasts) — the 24-hour
  window makes these require approved templates; Google Calendar covers reminders.
- Media understanding (images, voice notes, documents). Non-text messages get a polite
  "text only for now" reply.
- Payments inside chat. Subscription is granted manually by the admin, like licenses.
- Vector/embedding search for memory. Fact lists are small; all facts go into the prompt,
  capped (see Memory).
- Automated billing/plans for the agent product — one manually-granted "agent active" state.

## Before you start: accounts only you can create

**Meta / WhatsApp Cloud API:** at https://developers.facebook.com create an app (type
"Business"), add the WhatsApp product, and create/verify a WhatsApp Business Account with one
phone number (a number not currently registered to a personal WhatsApp). From the app
dashboard copy:

- Permanent access token (via a System User in Meta Business Settings) → `WHATSAPP_ACCESS_TOKEN`
- Phone number ID → `WHATSAPP_PHONE_NUMBER_ID`
- App secret (App Settings → Basic) → `WHATSAPP_APP_SECRET` (webhook signature verification)
- A random string you invent → `WHATSAPP_VERIFY_TOKEN` (webhook GET verification handshake)

Configure the webhook URL (`https://<domain>/api/whatsapp/webhook`) and subscribe to the
`messages` field. Meta provides a test number + test recipients that work before business
verification completes — enough for all development.

**Anthropic:** an API key from https://console.anthropic.com → `ANTHROPIC_API_KEY`. Model is
configurable via `AGENT_MODEL` (default `claude-sonnet-5`).

**Google Cloud:** the existing OAuth client gains one authorized redirect URI:
`https://<domain>/api/agent/google/callback` (and the localhost variant), and the Google
Calendar API is enabled for the project. No new client needed.

**Other new env vars:** `CRON_SECRET` (protects the cron route), `AGENT_TOKEN_ENCRYPTION_KEY`
(32-byte base64, AES-256-GCM for Google refresh tokens at rest).

## Architecture & Message Flow

All code lives in nerona-web: agent logic under `src/lib/agent/`, routes under
`src/app/api/`, dashboard pages under `src/app/agent/`.

1. Owner texts the central number → Meta POSTs to **`POST /api/whatsapp/webhook`**.
2. The route verifies the `X-Hub-Signature-256` HMAC against `WHATSAPP_APP_SECRET`, ignores
   status callbacks (delivery receipts), dedupes by WhatsApp message ID, and resolves the
   sender phone to an `AgentProfile`. Only messages from a **verified, active** profile create
   an `AgentJob`; all other cases (unknown sender, link code, non-text, disabled profile,
   rate-limited) are handled with static replies and never create jobs or call Claude. The
   route returns 200 immediately in every case.
3. In the same invocation, `waitUntil()` runs the job processor: assemble context → Claude
   tool loop → send reply via the Graph API `messages` endpoint. The route sets
   `maxDuration = 60` (raise later if tool loops need it).
4. Every inbound and outbound message is logged in `AgentMessage` — this is both the
   conversation history the agent sees and the audit trail.
5. **`GET /api/agent/cron`** (Vercel cron, every 5 minutes, guarded by `CRON_SECRET` in the
   `Authorization` header) re-runs jobs stuck in `pending`/`processing` older than 2 minutes.
   Max 3 attempts; on final failure the owner receives a short apology message and the job is
   marked `failed`.

**Replies and the 24-hour window:** every agent message is a reply to an owner-initiated
message, so it always falls inside Meta's 24-hour customer-service window — free-form text,
no templates needed. This is why proactive messages are out of scope.

**Unknown senders** (no matching verified `AgentProfile`, and not a pending link code — see
below) get one reply pointing to the signup page. To avoid spam/budget burn, the reply is
sent at most once per 24 h per phone (checked against `AgentMessage` outbound log), and
unknown-sender handling never calls Claude.

**Tenant linking:** on the dashboard the owner enters their WhatsApp number; the app stores a
6-digit code + 15-minute expiry on their profile and instructs them to send that code to the
Nerona number. When the webhook receives a message whose text matches a live code from that
phone number, the profile's phone is marked verified and the agent replies with a welcome
message. WhatsApp itself is the verification channel — no SMS provider.

**Rate limiting:** max 30 processed messages per profile per hour (counted from
`AgentMessage`). Beyond that, a static "please slow down" reply without calling Claude.

## Data Model (new Prisma models)

Follows existing conventions: cuid ids, `String` status fields, snake_case `@@map`. Prefixed
`Agent*` because `Order` already exists as the site's manual-payment ledger. Prices are whole
rupiah `Int`, matching `Order.amount`.

- **`AgentProfile`** — the tenant. `userId` (unique FK → `User`), `whatsappPhone String?`
  (E.164, unique), `phoneVerifiedAt DateTime?`, `linkCode String?`, `linkCodeExpires
  DateTime?`, `businessName String?`, `timezone String @default("Asia/Jakarta")`, `status
  String @default("pending")` (`"pending"` | `"active"` | `"disabled"` — only `"active"`
  profiles get agent replies; admin flips this), `googleRefreshToken String? @db.Text`
  (AES-256-GCM encrypted), `googleCalendarEmail String?` (display only), timestamps.
- **`AgentNote`** — `profileId`, `content @db.Text`, `createdAt`.
- **`AgentMemory`** — `profileId`, `fact @db.Text`, `source String` (`"auto"` |
  `"explicit"`), `createdAt`.
- **`AgentProduct`** — `profileId`, `name`, `description String?`, `price Int`,
  `stock Int?` (null = untracked), `isActive Boolean @default(true)`, timestamps.
- **`AgentOrder`** — `profileId`, `customerName String?`, `status String @default("new")`
  (`"new"` | `"paid"` | `"done"` | `"cancelled"`), `total Int` (computed from items at write
  time), `note String?`, timestamps. Has many **`AgentOrderItem`**: `productId String?`
  (nullable FK — product may be deleted later), `productName` (snapshot), `qty Int`,
  `unitPrice Int`.
- **`AgentMessage`** — `profileId String?` (null for unknown senders), `waMessageId String?
  @unique` (inbound dedupe; null for outbound), `phone String` (E.164),
  `direction String` (`"in"` | `"out"`), `body @db.Text`, `createdAt`.
- **`AgentJob`** — `waMessageId String @unique`, `profileId`, `payload @db.Text` (raw
  message JSON), `status String @default("pending")` (`"pending"` | `"processing"` | `"done"`
  | `"failed"`), `attempts Int @default(0)`, `lastError String?`, timestamps.

Every tool query is scoped by `profileId` — tenant isolation is enforced in the tool
executors, never left to the model.

## Agent Runtime (`src/lib/agent/`)

- **Context assembly:** system prompt containing the agent's role and tone, today's date and
  the profile's timezone, the business name, the full memory fact list (capped at the 200
  most recent; older facts are dropped from the prompt but kept in the DB), tool-usage policy
  (including when to call `remember_fact`), and an instruction to reply in the owner's
  language (Bahasa Indonesia expected, English works automatically). Conversation history:
  the last 20 `AgentMessage` rows as alternating turns.
- **Tool loop:** call Claude (`AGENT_MODEL`) with the tool definitions; execute requested
  tools via Prisma; feed results back; repeat until a text-only response or a hard cap of 8
  iterations (cap reached → apologetic fallback reply). Tool executor errors are caught and
  returned to Claude as error tool-results so it can respond gracefully.
- **Reply:** send final text via Graph API, log as outbound `AgentMessage`, mark job `done`.

### Tools

| Tool | Parameters | Behavior |
| --- | --- | --- |
| `add_note` | `content` | Insert note. |
| `list_notes` | `search?`, `limit?` (default 10) | Newest first, `contains` filter. |
| `delete_note` | `noteId` | Scoped delete. |
| `remember_fact` | `fact`, `source` | Insert memory fact (`"auto"` when volunteered, `"explicit"` when owner says "remember..."). |
| `forget_fact` | `factId` | Delete a fact (ids are shown when the agent lists what it knows). |
| `add_product` | `name`, `price`, `stock?`, `description?` | Insert product. |
| `update_product` | `productId`, any of `name`/`price`/`stock`/`description`/`isActive` | Partial update. |
| `list_products` | `search?` | Active products, name `contains`. |
| `add_order` | `customerName?`, `items[{productName, qty, unitPrice?}]`, `note?` | Each item resolves `productName` against the catalog (case-insensitive `contains`; ambiguous or no match → tool returns the candidates/miss and the agent asks the owner). `unitPrice` defaults to catalog price. Total computed server-side. Decrements `stock` when tracked. |
| `update_order_status` | `orderId`, `status` | Status transition; cancelling restores tracked stock. |
| `list_orders` | `status?`, `limit?` (default 10) | Newest first, items included. |
| `create_event` | `title`, `start` (ISO, profile timezone), `end?` (default +1 h), `description?` | Creates event in the owner's primary Google Calendar. |
| `list_events` | `from`, `to` (ISO) | Lists events in range. |

Calendar tools return a "calendar not connected" result when no refresh token is stored; the
agent then tells the owner to connect it on the dashboard.

## Google Calendar Connection

Independent of next-auth sign-in (owners may use email/password accounts):

- **`GET /api/agent/google/connect`** (authenticated) → redirects to Google's consent screen
  with scope `https://www.googleapis.com/auth/calendar.events`, `access_type=offline`,
  `prompt=consent`, and a signed `state` value.
- **`GET /api/agent/google/callback`** → validates `state`, exchanges the code, encrypts and
  stores the refresh token on `AgentProfile`, stores the Google account email for display.
- Runtime calendar calls exchange the refresh token for an access token per use (the
  `googleapis` package handles this). A revoked/invalid grant clears the stored token and
  surfaces as "calendar not connected".
- Dashboard shows connect/disconnect; disconnect deletes the stored token.

## Dashboard & Admin

Chat is the primary interface; the web pages are for browsing, fixing, and setup. All under
existing auth at `/agent`:

- **`/agent`** — status + settings: WhatsApp number linking (enter number → show code →
  verified state), Google Calendar connect/disconnect, business name and timezone.
- **`/agent/notes`**, **`/agent/memory`** — list + delete.
- **`/agent/products`** — list, add, edit, deactivate (plain forms).
- **`/agent/orders`** — list with items, change status.

Signed-in users without an active profile see the `/agent` page in a "waiting for
activation" state with payment instructions (mirroring the existing off-platform flow).

**Admin:** the existing `/admin` user search gains an "Agent" section — activate/disable a
user's `AgentProfile` (creates the profile row on first activation).

## Error Handling Summary

- Invalid webhook signature → 401, no processing.
- Duplicate `waMessageId` (Meta retry) → acknowledged, skipped.
- Non-text inbound → static "text only" reply, no Claude call.
- Unknown sender → one signup-link reply per 24 h, no Claude call.
- Disabled/pending profile → static "account not active" reply with dashboard link.
- Claude/API/tool-loop failure → job retried by cron (max 3 attempts), then apology + `failed`.
- Calendar token revoked → token cleared, agent asks owner to reconnect.

## Testing

Unit tests (Vitest, matching the existing suite style — pure logic with Prisma calls behind
thin injectable functions):

- Webhook signature verification (valid/invalid/missing).
- Link-code flow: match, expiry, wrong sender.
- Order item resolution: exact, `contains`, ambiguous, missing, price default, total math,
  stock decrement/restore.
- Memory prompt assembly: 200-fact cap, history windowing.
- Rate-limit and unknown-sender cooldown checks.

End-to-end: manual, against Meta's test number in a deployed Vercel preview (webhooks need a
public URL). The Claude tool loop gets a dev-only harness script that runs the loop against a
fake "incoming message" without WhatsApp, for local iteration.

## Build Order (each phase = one plan)

1. **Foundation** — schema migration, webhook (verify/dedupe/log), job + cron plumbing,
   phone linking, echo-level agent (Claude chat with memory/history but no tools yet),
   admin activation.
2. **Notes + memory tools** and their dashboard pages.
3. **Products + orders tools** and their dashboard pages.
4. **Google Calendar** connect flow + calendar tools.
5. **Hardening** — rate limits, unknown-sender cooldown, failure-apology path, polish.
