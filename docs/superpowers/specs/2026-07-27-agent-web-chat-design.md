# Agent Web Chat — Design

**Status:** implemented 2026-07-27 (commit `9d8a3a3`). Written alongside the
implementation at the user's direction, rather than before it as usual.

## Goal

Give tenants a second door into the assistant they already have on WhatsApp: a
chat panel at `/agent/chat` inside nerona-web, backed by the same profile, the
same memory, and one continuous conversation.

## Decisions

| Question | Decision |
| --- | --- |
| Audience | The **tenant themselves**, same as WhatsApp — not their customers. A customer-facing widget is a different product (anonymous sessions, guardrails, abuse exposure) and is out of scope |
| Conversation | **One shared thread.** Ask on WhatsApp, open the dashboard, the agent remembers |
| Requires a linked phone? | **No.** Any tenant with an active `AgentProfile` can chat immediately, so a newly provisioned tenant can try the assistant before dealing with Meta setup |
| Access | Signed-in tenants only. The profile is resolved from the session, never from client input |
| Delivery | Synchronous — the reply returns in the same HTTP response. No job queue, no polling |

Out of scope: streaming responses (`generateReply` is non-streaming and streaming
complicates metering) and the shop tools from
`2026-07-22-agent-shop-tools-design.md`, which remain unimplemented. If those
land later, both channels inherit them because they live inside the shared turn.

## Architecture

Before this change the gates were split, and only one of the three lived in the
job processor:

```
webhook-handler.ts   phone verified → plan expired → monthly quota → createJob
process-job.ts       points > 0 → generate → send → meter
```

That split was a trap: plan-expiry and quota lived in the *WhatsApp* handler, so
a new channel would silently bypass two of the three gates. Both moved into a
shared helper.

```
lib/agent/gates.ts
  checkAgentGates(profile) → { blocked, message } | null
    plan_expired → quota → no_points   (first failure wins, cheapest first)
    reply strings live here so the two channels cannot drift

lib/agent/turn.ts
  runAgentTurn({ profile, channel }) →
    gates → facts + history → buildSystemPrompt → generateReply
    → logOutbound(channel) → spendPoints (best-effort)
    → { ok, reply, pointsBalance } | { ok: false, blocked, reply }
```

Each channel keeps only what is genuinely its own:

- **`processJob`** — resolve profile by phone, `runAgentTurn`, `sendWhatsAppText`
- **`POST /api/agent/chat`** — session → profile, log inbound, `runAgentTurn`, JSON

**Inbound logging stays per-channel.** WhatsApp logs it in the webhook because it
owns the `waMessageId` used for de-duplication, and because the quota check counts
inbound rows — moving it into the turn would have shifted both that count and job
creation. The gates therefore run in `webhook-handler` *before* `createJob`, so a
blocked WhatsApp message still creates no job.

## Data model

`getRecentHistory` already filtered on `profileId` alone, so the shared thread
needed no query change. Two adjustments to `AgentMessage`:

- `phone` → nullable (web messages have no phone number)
- `channel String @default("whatsapp")` — origin, for UI badges

Migration `20260727000000_agent_message_channel`. Both statements are additive or
relaxing: catalog-only `DROP NOT NULL`, metadata-only `ADD COLUMN NOT NULL
DEFAULT` on PG 11+. Existing rows backfill to `whatsapp`. Safe to apply before
the code deploys, since old code ignores the new column.

`listChatHistory` was added for display (channel + timestamp); `getRecentHistory`
still selects only what the model needs.

## API

`POST /api/agent/chat`, `maxDuration = 60`

| Case | Response |
| --- | --- |
| No session | 401 |
| No profile, or `status !== "active"` | 403 |
| Empty text, or > 4000 chars | 400 |
| Over 20 requests/minute per user | 429 + `Retry-After` |
| Success | 200 `{ ok: true, reply, pointsBalance }` |
| Blocked by a gate | **200** `{ ok: false, blocked, reply }` |
| `runAgentTurn` throws | 502 with the standard apology text |

A blocked turn is deliberately **not** an error status: on WhatsApp those messages
are logged as outbound and appear in the thread, so returning 200 lets the web UI
render them as a normal agent bubble using the identical strings.

## UI

- `/agent/chat` — server component mirroring `agent/dashboard/page.tsx`: same
  "belum aktif" panel when inactive, otherwise loads 50 messages plus the balance
- `AgentChatPanel` — client component: thread with `via WhatsApp` badges on
  cross-channel turns, optimistic user bubble, typing indicator, points chip that
  updates from each response, Enter to send

## Testing

Vitest, dependencies mocked, matching the existing agent suite.

- `tests/lib/agent/gates.test.ts` (6) — gate order, short-circuits, negative balance
- `tests/lib/agent/turn.test.ts` (9) — prompt assembly, per-channel logging,
  metering, metering failure not losing the reply, blocked path, AI failure
- `tests/lib/agent-chat-route.test.ts` (10) — 401/403/400/429/502, trimming,
  blocked-as-200
- `messages.test.ts` — extended for the channel column and `listChatHistory`

The 15 pre-existing agent test files acted as the refactor's safety net.
`process-job.test.ts` and `webhook-handler.test.ts` needed updating where gates
moved; a new webhook case asserts an empty wallet creates no job.

Full suite after the change: 333 pass, 2 fail — both pre-existing in
`orders.test.ts`, unrelated to this work.

## Known gaps

- **No browser run.** Logic and types are verified; the chat panel has never
  actually rendered, and no live turn has been generated
- The `spendPoints` failure is swallowed and logged, matching existing behavior —
  a rare free AI call
