# Extension ↔ nerona-web Account Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `nerona_medata` extension connects to a nerona-web account via a pasted token and reads plan + license validity + points from nerona-web, replacing the Google Sheet as the license source/enforcer.

**Architecture:** New `ExtensionToken` bearer credential (created in Profile). A token-guarded `GET /api/extension/me` returns the account state (from the license + points wallet). The extension stores the token, calls that endpoint, and gates on `account.active`. AI generation is untouched (sub-project 3).

**Tech Stack:** nerona-web = Next.js 14 + Prisma 5 + next-auth + Vitest. Extension = plain MV3 JS (no test harness → manual verification).

## Global Constraints

- Token format `nrx_<48 hex>` (`crypto.randomBytes(24).toString("hex")`), stored plaintext, revocable (consistent with existing token models).
- `GET /api/extension/me` auth = `Authorization: Bearer <token>`; 401 on missing/invalid. `POST/GET /api/extension/tokens` and `DELETE …/[id]` are SESSION-guarded (`getServerSession` → `!session?.user?.id` → 401), NOT token-guarded.
- `account.active` = license exists AND `status ∈ {active, comp}` AND (`validUntil == null` OR `validUntil > now`). This is the extension's gate (honors [[nerona-monthly-package-expiry]]'s `validUntil`).
- Account state also carries `marketplaces` (string "*"|CSV) and `rejectAnalyzer` (bool) from the license so the extension keeps per-marketplace / reject-analyzer parity.
- Extension: manifest already has `host_permissions: "https://*/*"` — NO manifest change. `neronaWebBaseUrl` is user-configurable (default `http://localhost:3000`). Token stored in `chrome.storage` under `neronaToken`.
- All user-facing copy Indonesian. Import alias `@/` → `src/`. nerona-web tests mock `@/lib/prisma`.
- Commit on master with EXPLICIT file paths; NEVER `git add -A`. `core.autocrlf=true` prints harmless CRLF warnings.
- The extension is a SEPARATE git repo (`nerona_medata`, branch `main`); its commits are made there, staged by explicit path (it has unrelated uncommitted changes — never `git add -A`).

---

### Task 1: `ExtensionToken` model + `extension-auth.ts`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/extension-auth.ts`
- Test: `tests/lib/extension-auth.test.ts`

**Interfaces:**
- Produces: `createExtensionToken(userId, label?)`, `resolveExtensionToken(token) → { userId } | null`, `listExtensionTokens(userId)`, `revokeExtensionToken(userId, id) → boolean`.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`** (after `PointTransaction`)

```prisma
model ExtensionToken {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token      String    @unique
  label      String?
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime?

  @@index([userId])
  @@map("extension_tokens")
}
```
Add to `User`: `extensionTokens ExtensionToken[]`.

- [ ] **Step 2: Migrate**

Run: `npm run prisma:migrate -- --name add_extension_tokens`
Expected: new migration; client regenerated with `prisma.extensionToken`.

- [ ] **Step 3: Write the failing test** — `tests/lib/extension-auth.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    extensionToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { createExtensionToken, resolveExtensionToken, revokeExtensionToken } from "@/lib/extension-auth";
import { prisma } from "@/lib/prisma";

beforeEach(() => vi.clearAllMocks());

describe("createExtensionToken", () => {
  it("stores and returns an nrx_ token", async () => {
    (prisma.extensionToken.create as any).mockResolvedValue({});
    const token = await createExtensionToken("u1", "Chrome");
    expect(token).toMatch(/^nrx_[0-9a-f]{48}$/);
    expect(prisma.extensionToken.create).toHaveBeenCalledWith({
      data: { userId: "u1", token, label: "Chrome" },
    });
  });
});

describe("resolveExtensionToken", () => {
  it("returns userId and bumps lastUsedAt for a known token", async () => {
    (prisma.extensionToken.findUnique as any).mockResolvedValue({ id: "t1", userId: "u1" });
    (prisma.extensionToken.update as any).mockResolvedValue({});
    expect(await resolveExtensionToken("nrx_abc")).toEqual({ userId: "u1" });
    expect(prisma.extensionToken.update).toHaveBeenCalled();
  });
  it("returns null for unknown / empty token", async () => {
    (prisma.extensionToken.findUnique as any).mockResolvedValue(null);
    expect(await resolveExtensionToken("nope")).toBeNull();
    expect(await resolveExtensionToken("")).toBeNull();
  });
});

describe("revokeExtensionToken", () => {
  it("deletes only a token owned by the user", async () => {
    (prisma.extensionToken.deleteMany as any).mockResolvedValue({ count: 1 });
    expect(await revokeExtensionToken("u1", "t1")).toBe(true);
    expect(prisma.extensionToken.deleteMany).toHaveBeenCalledWith({ where: { id: "t1", userId: "u1" } });
    (prisma.extensionToken.deleteMany as any).mockResolvedValue({ count: 0 });
    expect(await revokeExtensionToken("u1", "other")).toBe(false);
  });
});
```

- [ ] **Step 4: Run to verify RED** — `npm test -- tests/lib/extension-auth.test.ts` → FAIL (module missing).

- [ ] **Step 5: Create `src/lib/extension-auth.ts`**

```ts
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export async function createExtensionToken(userId: string, label?: string): Promise<string> {
  const token = `nrx_${randomBytes(24).toString("hex")}`;
  await prisma.extensionToken.create({ data: { userId, token, label: label ?? null } });
  return token;
}

export async function resolveExtensionToken(token: string): Promise<{ userId: string } | null> {
  if (!token) return null;
  const row = await prisma.extensionToken.findUnique({
    where: { token },
    select: { id: true, userId: true },
  });
  if (!row) return null;
  await prisma.extensionToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { userId: row.userId };
}

export async function listExtensionTokens(userId: string) {
  return prisma.extensionToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true },
  });
}

export async function revokeExtensionToken(userId: string, id: string): Promise<boolean> {
  const res = await prisma.extensionToken.deleteMany({ where: { id, userId } });
  return res.count > 0;
}
```

- [ ] **Step 6: Run to verify GREEN** — `npm test -- tests/lib/extension-auth.test.ts` → PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/extension-auth.ts tests/lib/extension-auth.test.ts
git commit -m "feat: ExtensionToken model + extension-auth service"
```

---

### Task 2: `getExtensionAccountState`

**Files:**
- Create: `src/lib/extension-sync.ts`
- Test: `tests/lib/extension-sync.test.ts`

**Interfaces:**
- Consumes: `prisma`, `getBalance` from `@/lib/points`.
- Produces: `ExtensionAccountState` + `getExtensionAccountState(userId, now?)`.

- [ ] **Step 1: Write the failing test** — `tests/lib/extension-sync.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() }, license: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/points", () => ({ getBalance: vi.fn() }));

import { getExtensionAccountState } from "@/lib/extension-sync";
import { prisma } from "@/lib/prisma";
import { getBalance } from "@/lib/points";

const now = new Date("2026-07-24T00:00:00Z");
beforeEach(() => {
  vi.clearAllMocks();
  (prisma.user.findUnique as any).mockResolvedValue({ email: "u@x.com" });
  (getBalance as any).mockResolvedValue(1250);
});

describe("getExtensionAccountState", () => {
  it("active for an active license with future validUntil", async () => {
    (prisma.license.findFirst as any).mockResolvedValue({
      status: "active", validUntil: new Date("2026-08-01T00:00:00Z"),
      marketplaces: "*", rejectAnalyzer: false, plan: { name: "Pro" },
    });
    const s = await getExtensionAccountState("u1", now);
    expect(s).toMatchObject({ email: "u@x.com", plan: "Pro", active: true, pointsBalance: 1250 });
  });
  it("inactive when validUntil is in the past", async () => {
    (prisma.license.findFirst as any).mockResolvedValue({
      status: "active", validUntil: new Date("2026-07-01T00:00:00Z"),
      marketplaces: "*", rejectAnalyzer: false, plan: { name: "Pro" },
    });
    expect((await getExtensionAccountState("u1", now)).active).toBe(false);
  });
  it("inactive when there is no license", async () => {
    (prisma.license.findFirst as any).mockResolvedValue(null);
    const s = await getExtensionAccountState("u1", now);
    expect(s.active).toBe(false);
    expect(s.plan).toBeNull();
  });
  it("active with null validUntil (legacy)", async () => {
    (prisma.license.findFirst as any).mockResolvedValue({
      status: "comp", validUntil: null, marketplaces: "*", rejectAnalyzer: false, plan: { name: "Comp" },
    });
    expect((await getExtensionAccountState("u1", now)).active).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify RED** — `npm test -- tests/lib/extension-sync.test.ts` → FAIL.

- [ ] **Step 3: Create `src/lib/extension-sync.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { getBalance } from "@/lib/points";

export interface ExtensionAccountState {
  email: string;
  plan: string | null;
  licenseStatus: string | null;
  validUntil: Date | null;
  marketplaces: string;
  rejectAnalyzer: boolean;
  pointsBalance: number;
  active: boolean;
}

export async function getExtensionAccountState(
  userId: string,
  now: Date = new Date()
): Promise<ExtensionAccountState> {
  const [user, license, pointsBalance] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    prisma.license.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include: { plan: true } }),
    getBalance(userId),
  ]);
  const validUntil = license?.validUntil ?? null;
  const active =
    !!license &&
    ["active", "comp"].includes(license.status) &&
    (validUntil == null || validUntil.getTime() > now.getTime());
  return {
    email: user?.email ?? "",
    plan: license?.plan?.name ?? null,
    licenseStatus: license?.status ?? null,
    validUntil,
    marketplaces: license?.marketplaces ?? "*",
    rejectAnalyzer: license?.rejectAnalyzer ?? false,
    pointsBalance,
    active,
  };
}
```

- [ ] **Step 4: Run to verify GREEN** — `npm test -- tests/lib/extension-sync.test.ts` → PASS (4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/extension-sync.ts tests/lib/extension-sync.test.ts
git commit -m "feat: getExtensionAccountState (license + points -> active)"
```

---

### Task 3: `GET /api/extension/me`

**Files:**
- Create: `src/app/api/extension/me/route.ts`
- Test: `tests/lib/extension-me-route.test.ts`

**Interfaces:**
- Consumes: `resolveExtensionToken`, `getExtensionAccountState`.

- [ ] **Step 1: Write the failing test** — `tests/lib/extension-me-route.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extension-auth", () => ({ resolveExtensionToken: vi.fn() }));
vi.mock("@/lib/extension-sync", () => ({ getExtensionAccountState: vi.fn() }));

import { GET } from "@/app/api/extension/me/route";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";

function req(auth?: string) {
  return new Request("http://test/api/extension/me", { headers: auth ? { authorization: auth } : {} });
}
beforeEach(() => vi.clearAllMocks());

describe("GET /api/extension/me", () => {
  it("401 without a bearer token", async () => {
    expect((await GET(req())).status).toBe(401);
  });
  it("401 for an invalid token", async () => {
    (resolveExtensionToken as any).mockResolvedValue(null);
    expect((await GET(req("Bearer bad"))).status).toBe(401);
  });
  it("200 with account state for a valid token", async () => {
    (resolveExtensionToken as any).mockResolvedValue({ userId: "u1" });
    (getExtensionAccountState as any).mockResolvedValue({
      email: "u@x.com", plan: "Pro", licenseStatus: "active",
      validUntil: new Date("2026-08-01T00:00:00Z"), marketplaces: "*",
      rejectAnalyzer: false, pointsBalance: 1250, active: true,
    });
    const res = await GET(req("Bearer nrx_ok"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.account).toMatchObject({ plan: "Pro", active: true, pointsBalance: 1250 });
    expect(body.account.validUntil).toBe("2026-08-01T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run to verify RED** — `npm test -- tests/lib/extension-me-route.test.ts` → FAIL.

- [ ] **Step 3: Create `src/app/api/extension/me/route.ts`**

```ts
import { NextResponse } from "next/server";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function GET(request: Request) {
  const token = bearerToken(request);
  const resolved = token ? await resolveExtensionToken(token) : null;
  if (!resolved) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const state = await getExtensionAccountState(resolved.userId);
  return NextResponse.json({
    ok: true,
    account: { ...state, validUntil: state.validUntil ? state.validUntil.toISOString() : null },
  });
}
```

- [ ] **Step 4: Run to verify GREEN** — `npm test -- tests/lib/extension-me-route.test.ts` → PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/extension/me/route.ts tests/lib/extension-me-route.test.ts
git commit -m "feat: GET /api/extension/me (token-authed account state)"
```

---

### Task 4: token management routes

**Files:**
- Create: `src/app/api/extension/tokens/route.ts` (GET list, POST create)
- Create: `src/app/api/extension/tokens/[id]/route.ts` (DELETE revoke)
- Test: `tests/lib/extension-tokens-route.test.ts`

**Interfaces:**
- Consumes: `createExtensionToken`, `listExtensionTokens`, `revokeExtensionToken`; `authOptions`.

- [ ] **Step 1: Write the failing test** — `tests/lib/extension-tokens-route.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/extension-auth", () => ({
  createExtensionToken: vi.fn(),
  listExtensionTokens: vi.fn(),
  revokeExtensionToken: vi.fn(),
}));

import { GET, POST } from "@/app/api/extension/tokens/route";
import { DELETE } from "@/app/api/extension/tokens/[id]/route";
import { getServerSession } from "next-auth";
import { createExtensionToken, revokeExtensionToken } from "@/lib/extension-auth";

const authed = { user: { id: "u1" } };
function postReq(body: unknown) {
  return new Request("http://test/api/extension/tokens", { method: "POST", body: JSON.stringify(body) });
}
beforeEach(() => vi.clearAllMocks());

describe("extension token routes", () => {
  it("POST 401 unauthenticated", async () => {
    (getServerSession as any).mockResolvedValue(null);
    expect((await POST(postReq({}))).status).toBe(401);
  });
  it("POST returns a freshly created token", async () => {
    (getServerSession as any).mockResolvedValue(authed);
    (createExtensionToken as any).mockResolvedValue("nrx_created");
    const res = await POST(postReq({ label: "Chrome" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, token: "nrx_created" });
    expect(createExtensionToken).toHaveBeenCalledWith("u1", "Chrome");
  });
  it("DELETE revokes scoped to the user, 404 when not found", async () => {
    (getServerSession as any).mockResolvedValue(authed);
    (revokeExtensionToken as any).mockResolvedValue(true);
    expect((await DELETE(new Request("http://test"), { params: { id: "t1" } })).status).toBe(200);
    expect(revokeExtensionToken).toHaveBeenCalledWith("u1", "t1");
    (revokeExtensionToken as any).mockResolvedValue(false);
    expect((await DELETE(new Request("http://test"), { params: { id: "x" } })).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify RED** — `npm test -- tests/lib/extension-tokens-route.test.ts` → FAIL.

- [ ] **Step 3: Create `src/app/api/extension/tokens/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createExtensionToken, listExtensionTokens } from "@/lib/extension-auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, tokens: await listExtensionTokens(session.user.id) });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim() : undefined;
  const token = await createExtensionToken(session.user.id, label);
  return NextResponse.json({ ok: true, token });
}
```

- [ ] **Step 4: Create `src/app/api/extension/tokens/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revokeExtensionToken } from "@/lib/extension-auth";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const ok = await revokeExtensionToken(session.user.id, params.id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
```

- [ ] **Step 5: Run to verify GREEN** — `npm test -- tests/lib/extension-tokens-route.test.ts` → PASS (3).

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/extension/tokens/route.ts" "src/app/api/extension/tokens/[id]/route.ts" tests/lib/extension-tokens-route.test.ts
git commit -m "feat: extension token create/list/revoke routes"
```

---

### Task 5: Profile "Hubungkan Extension" panel

**Files:**
- Create: `src/components/account/ExtensionConnectPanel.tsx`
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: Create `src/components/account/ExtensionConnectPanel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

interface TokenRow {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export function ExtensionConnectPanel() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [created, setCreated] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/extension/tokens");
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) setTokens(data.tokens);
  }
  useEffect(() => {
    load();
  }, []);

  async function createToken() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/extension/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Extension" }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !data?.ok) {
      setError("Gagal membuat token.");
      return;
    }
    setCreated(data.token);
    load();
  }

  async function revoke(id: string) {
    await fetch(`/api/extension/tokens/${id}`, { method: "DELETE" });
    setTokens((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <h2 className="text-lg font-semibold text-ink">Hubungkan Extension</h2>
      <p className="mt-1 text-sm text-muted">
        Buat token lalu tempel di extension Nerona Metadata untuk menghubungkan akun ini.
      </p>

      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}

      {created && (
        <div className="mt-4 rounded-2xl bg-gold-400/15 p-4 ring-1 ring-gold-400/40">
          <p className="text-xs font-semibold text-ink">Token baru (salin sekarang — tidak ditampilkan lagi):</p>
          <code className="mt-1 block break-all text-sm text-ink">{created}</code>
        </div>
      )}

      <button
        onClick={createToken}
        disabled={loading}
        className="mt-4 rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? "Membuat..." : "Buat token"}
      </button>

      <ul className="mt-4 divide-y divide-navy-900/10">
        {tokens.length === 0 && <li className="py-2 text-sm text-muted">Belum ada token.</li>}
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="text-ink">{t.label || "Token"}</p>
              <p className="text-xs text-muted">
                Dibuat {new Date(t.createdAt).toLocaleDateString("id-ID")}
                {t.lastUsedAt ? ` · dipakai ${new Date(t.lastUsedAt).toLocaleDateString("id-ID")}` : " · belum dipakai"}
              </p>
            </div>
            <button
              onClick={() => revoke(t.id)}
              className="rounded-full bg-navy-900/5 px-3 py-1 text-xs font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
            >
              Cabut
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `src/app/profile/page.tsx`**

Add the import `import { ExtensionConnectPanel } from "@/components/account/ExtensionConnectPanel";` and render `<ExtensionConnectPanel />` after the license section (inside the same page container, near the end).

- [ ] **Step 3: Verify build** — `npm run build` → succeeds; `/profile` shows "Hubungkan Extension" with create/list/revoke.

- [ ] **Step 4: Commit**

```bash
git add src/components/account/ExtensionConnectPanel.tsx src/app/profile/page.tsx
git commit -m "feat: profile extension-connect panel (token create/revoke)"
```

---

### Task 6: Extension — nerona-web client + gating (repo `nerona_medata`)

**Files (in `nerona_medata`):**
- Modify: `access/access-config.js` (add `neronaWebBaseUrl`)
- Create: `access/nerona-web-client.js`
- Modify: `access/access.js` (`fetchAccessFromServer` → nerona-web), `popup.html` (load the new script)

**Interfaces:**
- Consumes: nerona-web `GET /api/extension/me`.

- [ ] **Step 1: Add base URL to `access/access-config.js`**

In the `globalThis.NERONA_ACCESS_CONFIG` object, add:
```js
  /** URL nerona-web (tempat akun & poin). Contoh: https://app.nerona.com — dev: http://localhost:3000 */
  neronaWebBaseUrl: "http://localhost:3000",
```

- [ ] **Step 2: Create `access/nerona-web-client.js`**

```js
(function () {
  const TOKEN_KEY = "neronaToken";

  function baseUrl() {
    const u = String(globalThis.NERONA_ACCESS_CONFIG?.neronaWebBaseUrl || "").trim();
    return u.replace(/\/+$/, "");
  }

  async function getToken() {
    const storage = globalThis.chrome?.storage?.local;
    if (!storage) return "";
    const data = await storage.get([TOKEN_KEY]);
    return String(data[TOKEN_KEY] || "").trim();
  }

  async function setToken(token) {
    const storage = globalThis.chrome?.storage?.local;
    if (!storage) return;
    await storage.set({ [TOKEN_KEY]: String(token || "").trim() });
  }

  // Returns the same shape the extension's access layer expects:
  // { ok, plan, validUntil, marketplaces: string[], rejectAnalyzer, pointsBalance, email }
  async function fetchAccountState(token) {
    const t = String(token || "").trim() || (await getToken());
    if (!t) return { ok: false, error: "missing_license" };
    const base = baseUrl();
    if (!base) return { ok: false, error: "server_not_configured" };
    let res;
    try {
      res = await fetch(`${base}/api/extension/me`, {
        headers: { Authorization: `Bearer ${t}`, Accept: "application/json" },
      });
    } catch (_e) {
      return { ok: false, error: "network" };
    }
    if (res.status === 401) return { ok: false, error: "invalid_key" };
    if (!res.ok) return { ok: false, error: "network" };
    const data = await res.json().catch(() => null);
    const acc = data?.account;
    if (!acc) return { ok: false, error: "invalid_key" };
    const marketplaces = acc.marketplaces === "*" || !acc.marketplaces
      ? (globalThis.NeronaAccess?.ALL_MARKETPLACES || [])
      : String(acc.marketplaces).split(",").map((s) => s.trim()).filter(Boolean);
    return {
      ok: Boolean(acc.active),
      error: acc.active ? undefined : "expired",
      plan: acc.plan || "",
      validUntil: acc.validUntil ? new Date(acc.validUntil).toLocaleDateString("id-ID") : "",
      marketplaces,
      rejectAnalyzer: Boolean(acc.rejectAnalyzer),
      pointsBalance: Number(acc.pointsBalance || 0),
      email: acc.email || "",
    };
  }

  globalThis.NeronaWebClient = { getToken, setToken, fetchAccountState };
})();
```

- [ ] **Step 3: Re-point `access/access.js` at nerona-web**

READ `access/access.js`. Change `fetchAccessFromServer` so that instead of hitting the Google Sheet it delegates to the web client:
```js
  async function fetchAccessFromServer(params) {
    if (globalThis.NeronaWebClient) {
      return globalThis.NeronaWebClient.fetchAccountState(params?.licenseKey);
    }
    // (old sheet path left below as dead fallback)
    ...
  }
```
Also make `getStoredLicense`/`saveLicense` treat the "licenseKey" as the nerona token (store via `NeronaWebClient.setToken` and read via `getToken`), OR keep `saveLicense(email, licenseKey)` writing the key and additionally mirror it to `neronaToken`. Simplest: in `saveLicense`, also call `NeronaWebClient.setToken(licenseKey)`; in `getStoredLicense`, if no stored license key, fall back to `NeronaWebClient.getToken()`. Keep `assertAccess`/`activateLicense` otherwise intact — they already consume the `{ ok, plan, validUntil, marketplaces, rejectAnalyzer }` shape the client now returns.

- [ ] **Step 4: Load the client in `popup.html`**

Add `<script src="access/nerona-web-client.js"></script>` BEFORE `access/access.js` (and before `popup.js`) so `NeronaWebClient` exists when access.js runs. (Also add it wherever `background.js`/service worker loads access scripts if applicable — check `manifest.json`/`background.js` imports; if background uses `importScripts`, add it there too.)

- [ ] **Step 5: Manual verification**

Load unpacked in Chrome (`chrome://extensions` → reload). With nerona-web running (`npm run dev`) and a token created in Profile: paste the token as the "license key" (until Task 7 renames the field), click activate → the popup status should show the plan + "berlaku s/d" from nerona-web; with an expired/absent license the extension must refuse (fail closed). Confirm no Google-Sheet request is made for gating (Network tab shows `/api/extension/me`).

- [ ] **Step 6: Commit (in `nerona_medata`)**

```bash
cd ../nerona_medata
git add access/access-config.js access/nerona-web-client.js access/access.js popup.html
git commit -m "feat: gate extension access via nerona-web account (replace sheet)"
```

---

### Task 7: Extension popup — "Token akun Nerona" UI (repo `nerona_medata`)

**Files (in `nerona_medata`):**
- Modify: `popup.html` (replace the license email/key block), `popup.js` (wire token field)

- [ ] **Step 1: Replace the license block in `popup.html`**

READ `popup.html`. Replace the "Akses lisensi (Google Sheet)" `<details>` block (the `licenseEmail` + `licenseKey` inputs, lines ~20-36) with an "Akun Nerona" block:
```html
      <details class="settings access-panel" open>
        <summary>Akun Nerona</summary>
        <label for="neronaToken">Token akun</label>
        <input id="neronaToken" type="text" placeholder="nrx_..." autocomplete="off" />
        <button id="connectAccountBtn" type="button">Simpan &amp; cek</button>
        <p id="accountStatus" class="hint"></p>
      </details>
```
(Keep the AI Settings `<details>` block that follows it untouched.)

- [ ] **Step 2: Wire it in `popup.js`**

READ `popup.js`. Remove/replace the license email/key element refs and their activate handler with:
- On load: read the stored token (`NeronaWebClient.getToken()`) into `#neronaToken`, then fetch + render status.
- On "Simpan & cek": `await NeronaWebClient.setToken(value)`, then `const state = await NeronaWebClient.fetchAccountState(value)`, then render `#accountStatus`:
  - ok → `Akun aktif · Plan: <plan> · berlaku s/d <validUntil> · Poin: <pointsBalance>`.
  - not ok → an Indonesian message from the error code ("Token tidak valid", "Paket berakhir", "Tidak bisa terhubung ke nerona-web", etc.).
- Keep using `NeronaAccess.assertAccess(...)` for gating during generation (it now flows through the web client).

- [ ] **Step 3: Manual verification**

Reload the extension. The popup shows an "Akun Nerona" section with a token field. Paste a valid token → status shows plan + points + validUntil; generation is allowed. Revoke the token in nerona-web Profile → re-check → status shows invalid and generation is blocked.

- [ ] **Step 4: Commit (in `nerona_medata`)**

```bash
cd ../nerona_medata
git add popup.html popup.js
git commit -m "feat: popup account token UI (plan + points from nerona-web)"
```

---

## Self-Review Notes

- **Spec coverage:** ExtensionToken + auth lib (Task 1); account state w/ active/validUntil/points/marketplaces/rejectAnalyzer (Task 2); `GET /api/extension/me` (Task 3); token create/list/revoke routes (Task 4); profile connect panel (Task 5); extension client + gating replacing the sheet (Task 6); popup token UI (Task 7). Testing section maps to Tasks 1–4 (vitest); Tasks 5–7 verified via build / manual (extension has no test harness — noted).
- **Deferred (per spec):** removing sheet code entirely, server-side generation/points deduction (sub-project 3), launchWebAuthFlow, token hashing, dual-source bridge.
- **Type/shape consistency:** `resolveExtensionToken`→`{userId}` used by Task 3; `getExtensionAccountState` shape (Task 2) serialized by Task 3 and mapped to the extension's existing access payload shape (`{ ok, plan, validUntil, marketplaces[], rejectAnalyzer }`) in Task 6's client so `assertAccess`/`formatAccessStatus` keep working.
- **Enforcement:** `active` honors `validUntil`, so metadata enforcement now lives in the DB (nerona-web only), per the approved decision. Migration prerequisite (all active users present in nerona-web) is a release gate, restated from the spec.
- **Two repos:** Tasks 1–5 commit in `nerona-web`; Tasks 6–7 commit in `nerona_medata` (branch main), explicit paths only.
