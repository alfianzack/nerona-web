# Nerona Website Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js project with a Postgres/Prisma data model and working Google OAuth sign-in, with server-side helpers that gate `/account` (any signed-in user) and `/admin` (users with an `AdminRole` row) — the foundation every later phase (storefront, admin panel, extension integration) builds on.

**Architecture:** Single Next.js (App Router, TypeScript) app in `nerona-web/`, Postgres (Neon) via Prisma, Auth.js (`next-auth` v4) with the Google provider and Prisma adapter, Tailwind for styling. Role gating happens in Server Components via `getServerSession` + a Prisma lookup — not in Edge middleware, because Prisma Client cannot run in the Edge runtime without extra infrastructure (Data Proxy) that this project doesn't need yet.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 3, Prisma 5 + `@prisma/client` 5, `next-auth` 4 + `@next-auth/prisma-adapter` 1, Vitest for unit tests, Postgres (Neon).

## Global Constraints

- Single unified Next.js app serves marketing, storefront, customer portal, and admin panel (per spec's "Approach").
- Admin access is granted via an `AdminRole` row, not a separate login mechanism — customers and admins are both `User` rows (per spec's Data Model).
- There must always be at least one `owner_admin` (per spec's Error Handling) — not enforced yet in this phase (no admin UI to remove roles yet), but the seed script in Task 8 is what guarantees one exists from the start.
- No data migration from the Google Sheet is needed — this is the first real launch (per spec's Purpose).
- Deploy target is Vercel; local dev must work against a real Postgres instance (Neon), not a local Docker Postgres, so connection strings behave the same in both places.

---

## Before you start: accounts only you can create

Two external accounts are required before Task 2 and Task 4. Do these now (or whenever you reach that task):

1. **Postgres database (Neon):** go to https://neon.tech, create a free project, and copy the connection string (it looks like `postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`). You'll paste this into `.env.local` as `DATABASE_URL` in Task 2.
2. **Google OAuth credentials:** go to https://console.cloud.google.com/apis/credentials, create an OAuth 2.0 Client ID (type "Web application"), add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI, and copy the Client ID and Client Secret. You'll paste these into `.env.local` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Task 4.

---

### Task 1: Project scaffold (Next.js, TypeScript, Tailwind)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `next-env.d.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

**Interfaces:**
- Produces: a runnable Next.js dev server on `http://localhost:3000`, path alias `@/*` → `./src/*`, Tailwind directives available in `globals.css`.

- [ ] **Step 1: Create `.gitignore` before anything else generates files that shouldn't be committed**

```gitignore
node_modules
.next
.env
.env.local
*.tsbuildinfo
npm-debug.log*
```

- [ ] **Step 2: Initialize `package.json` and install dependencies**

Run:
```bash
npm init -y
npm install next@^14 react@^18 react-dom@^18
npm install -D typescript@^5 @types/node @types/react @types/react-dom tailwindcss@^3 postcss autoprefixer
```
Expected: `package.json` now lists `next`, `react`, `react-dom` in `dependencies` and the rest in `devDependencies`.

- [ ] **Step 3: Edit `package.json` scripts**

Open `package.json` and set the `scripts` field to:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Create `next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 6: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

- [ ] **Step 7: Create `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 8: Create `postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 9: Create `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 10: Create `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nerona Metadata",
  description: "License management and orders for the Nerona Metadata extension.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 11: Create `src/app/page.tsx` (temporary placeholder — replaced in Task 7)**

```tsx
export default function HomePage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Nerona Metadata</h1>
    </main>
  );
}
```

- [ ] **Step 12: Create `.env.example`**

```
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
OWNER_ADMIN_EMAIL="you@example.com"
```

- [ ] **Step 13: Verify the dev server boots**

Run: `npm run dev`
Expected: console prints `Ready` and `http://localhost:3000` renders "Nerona Metadata". Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json tsconfig.json next-env.d.ts next.config.mjs tailwind.config.ts postcss.config.js .gitignore .env.example src/app/globals.css src/app/layout.tsx src/app/page.tsx
git commit -m "Scaffold Next.js + TypeScript + Tailwind project"
```

---

### Task 2: Prisma schema and Postgres connection

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env.local` (not committed — see `.gitignore` from Task 1)

**Interfaces:**
- Consumes: `DATABASE_URL` from `.env.local` (you obtained this from Neon in the "Before you start" section).
- Produces: Postgres tables `users`, `accounts`, `sessions`, `verification_tokens`, `admin_roles`, `plans`, `subscriptions`, `licenses`, `orders`, `settings`. Later tasks query these via Prisma Client generated from this schema.

- [ ] **Step 1: Install Prisma**

Run:
```bash
npm install -D prisma@^5
npm install @prisma/client@^5
```

- [ ] **Step 2: Create `.env.local` with your real Neon connection string**

```
DATABASE_URL="postgresql://<your-neon-connection-string>?sslmode=require"
```

- [ ] **Step 3: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// --- Auth.js (next-auth) required models ---

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// --- Application models ---

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())

  accounts        Account[]
  sessions        Session[]
  adminRole       AdminRole?
  subscriptions   Subscription[]
  licenses        License[]        @relation("UserLicenses")
  grantedLicenses License[]        @relation("GrantedByAdmin")
  orders          Order[]

  @@map("users")
}

model AdminRole {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      String   // "owner_admin" | "support"
  createdAt DateTime @default(now())

  @@map("admin_roles")
}

model Plan {
  id                   String   @id @default(cuid())
  name                 String
  stripePriceIdMonthly String?
  stripePriceIdYearly  String?
  marketplaces         String   @default("*")
  rejectAnalyzer       Boolean  @default(false)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  subscriptions Subscription[]
  licenses      License[]

  @@map("plans")
}

model Subscription {
  id                   String   @id @default(cuid())
  userId               String
  user                 User     @relation(fields: [userId], references: [id])
  planId               String
  plan                 Plan     @relation(fields: [planId], references: [id])
  stripeSubscriptionId String   @unique
  status               String   // "active" | "trialing" | "past_due" | "canceled"
  currentPeriodEnd     DateTime
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@map("subscriptions")
}

model License {
  id             String    @id @default(cuid())
  userId         String
  user           User      @relation("UserLicenses", fields: [userId], references: [id])
  licenseKey     String    @unique
  status         String    // "active" | "revoked" | "comp"
  source         String    // "stripe" | "manual_grant"
  grantedById    String?
  grantedBy      User?     @relation("GrantedByAdmin", fields: [grantedById], references: [id])
  notes          String?
  planId         String?
  plan           Plan?     @relation(fields: [planId], references: [id])
  validUntil     DateTime?
  marketplaces   String    @default("*")
  rejectAnalyzer Boolean   @default(false)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@map("licenses")
}

model Order {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  stripeInvoiceId String   @unique
  amount          Int
  currency        String   @default("usd")
  status          String
  refunded        Boolean  @default(false)
  createdAt       DateTime @default(now())

  @@map("orders")
}

model Setting {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt

  @@map("settings")
}
```

- [ ] **Step 4: Run the initial migration**

Run: `npx prisma migrate dev --name init`
Expected: output ends with `Your database is now in sync with your schema.` and a new folder `prisma/migrations/<timestamp>_init/` is created. If this fails with a connection error, double-check `DATABASE_URL` in `.env.local` against the string Neon gave you.

- [ ] **Step 5: Commit (schema and migration only — `.env.local` must NOT be committed)**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add Prisma schema and initial migration"
```

---

### Task 3: Prisma client singleton

**Files:**
- Create: `src/lib/prisma.ts`

**Interfaces:**
- Consumes: `@prisma/client` generated from Task 2's schema.
- Produces: `prisma: PrismaClient` — imported by every later task that queries the database.

- [ ] **Step 1: Create `src/lib/prisma.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: Verify it type-checks and Prisma Client is generated**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` message, no errors.

Run: `npx tsc --noEmit`
Expected: no errors reported.

- [ ] **Step 3: Commit**

```bash
git add src/lib/prisma.ts
git commit -m "Add Prisma client singleton"
```

---

### Task 4: Google OAuth sign-in (Auth.js)

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts` (Task 3); `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `NEXTAUTH_SECRET` / `NEXTAUTH_URL` from `.env.local`.
- Produces: `authOptions: NextAuthOptions` exported from `src/lib/auth.ts` — consumed by Task 5 (session callback) and every later Server Component that calls `getServerSession(authOptions)`. A working `/api/auth/signin`, `/api/auth/signout`, and `/api/auth/callback/google` route.

- [ ] **Step 1: Install next-auth and the Prisma adapter**

Run: `npm install next-auth@^4 @next-auth/prisma-adapter@^1`

- [ ] **Step 2: Add remaining env vars to `.env.local`**

```
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<paste output of: openssl rand -base64 32>"
GOOGLE_CLIENT_ID="<from Google Cloud Console>"
GOOGLE_CLIENT_SECRET="<from Google Cloud Console>"
```

Run `openssl rand -base64 32` in Git Bash to generate `NEXTAUTH_SECRET` if you haven't already.

- [ ] **Step 3: Create `src/lib/auth.ts`**

```ts
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  ],
  session: { strategy: "database" },
};
```

- [ ] **Step 4: Create `src/app/api/auth/[...nextauth]/route.ts`**

```ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

- [ ] **Step 5: Manually verify sign-in works**

Run: `npm run dev`, open `http://localhost:3000/api/auth/signin`, click "Sign in with Google", complete the Google prompt.
Expected: you're redirected back to the app without an error; check Prisma Studio (`npx prisma studio`) and confirm a row now exists in the `users` table with your email, and a matching row in `accounts`. Stop the dev server once confirmed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts "src/app/api/auth/[...nextauth]/route.ts"
git commit -m "Wire up Google OAuth via Auth.js"
```

---

### Task 5: Admin role lookup

**Files:**
- Modify: `src/lib/auth.ts`
- Create: `src/types/next-auth.d.ts`
- Test: `tests/lib/auth.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts`.
- Produces: `type AdminRoleValue = "owner_admin" | "support"` and `getAdminRole(userId: string): Promise<AdminRoleValue | null>`, both exported from `src/lib/auth.ts`. `session.user.role: AdminRoleValue | null` now available on every session. Consumed by Task 6 (`session-guards.ts`).

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest@^1`

Add to `package.json` `scripts`:
```json
"test": "vitest run"
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Write the failing test for `getAdminRole`**

Create `tests/lib/auth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminRole: {
      findUnique: vi.fn(),
    },
  },
}));

import { getAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

describe("getAdminRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the role when an AdminRole row exists", async () => {
    (prisma.adminRole.findUnique as any).mockResolvedValue({ role: "owner_admin" });

    const role = await getAdminRole("user-1");

    expect(role).toBe("owner_admin");
    expect(prisma.adminRole.findUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("returns null when no AdminRole row exists", async () => {
    (prisma.adminRole.findUnique as any).mockResolvedValue(null);

    const role = await getAdminRole("user-2");

    expect(role).toBeNull();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/lib/auth.test.ts`
Expected: FAIL — `getAdminRole` is not exported from `@/lib/auth`.

- [ ] **Step 5: Implement `getAdminRole` and wire it into the session callback**

Modify `src/lib/auth.ts` to:

```ts
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";

export type AdminRoleValue = "owner_admin" | "support";

export async function getAdminRole(userId: string): Promise<AdminRoleValue | null> {
  const record = await prisma.adminRole.findUnique({ where: { userId } });
  return (record?.role as AdminRoleValue | undefined) ?? null;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = await getAdminRole(user.id);
      }
      return session;
    },
  },
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/lib/auth.test.ts`
Expected: PASS — 2 passed.

- [ ] **Step 7: Create `src/types/next-auth.d.ts` so `session.user.id` / `session.user.role` type-check**

```ts
import type { DefaultSession } from "next-auth";
import type { AdminRoleValue } from "@/lib/auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AdminRoleValue | null;
    } & DefaultSession["user"];
  }
}
```

- [ ] **Step 8: Verify the whole project still type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth.ts src/types/next-auth.d.ts tests/lib/auth.test.ts vitest.config.ts package.json package-lock.json
git commit -m "Add admin role lookup and expose it on the session"
```

---

### Task 6: Session guards (`requireUser`, `requireAdmin`)

**Files:**
- Create: `src/lib/session-guards.ts`
- Test: `tests/lib/session-guards.test.ts`

**Interfaces:**
- Consumes: `authOptions` from `src/lib/auth.ts` (Task 4/5); `getServerSession` from `next-auth`; `redirect` from `next/navigation`.
- Produces: `requireUser(): Promise<Session>` (redirects to `/api/auth/signin` if not signed in) and `requireAdmin(): Promise<Session>` (redirects to `/account` if signed in but not an admin). Consumed by Task 7's pages.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/session-guards.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { requireAdmin, requireUser } from "@/lib/session-guards";

describe("requireUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to sign-in when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow("REDIRECT:/api/auth/signin");
  });

  it("returns the session when signed in", async () => {
    const session = { user: { id: "u1", role: null } };
    getServerSessionMock.mockResolvedValue(session);

    await expect(requireUser()).resolves.toBe(session);
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /account when the user has no admin role", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/account");
  });

  it("returns the session when the user has an admin role", async () => {
    const session = { user: { id: "u1", role: "support" } };
    getServerSessionMock.mockResolvedValue(session);

    await expect(requireAdmin()).resolves.toBe(session);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/session-guards.test.ts`
Expected: FAIL — `src/lib/session-guards.ts` does not exist yet.

- [ ] **Step 3: Implement `src/lib/session-guards.ts`**

```ts
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (!session.user.role) {
    redirect("/account");
  }
  return session;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/session-guards.test.ts`
Expected: PASS — 4 passed.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — 6 passed (2 from Task 5, 4 from this task).

- [ ] **Step 6: Commit**

```bash
git add src/lib/session-guards.ts tests/lib/session-guards.test.ts
git commit -m "Add requireUser/requireAdmin session guards"
```

---

### Task 7: Protected pages

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/account/page.tsx`
- Create: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `requireUser`, `requireAdmin` from `src/lib/session-guards.ts` (Task 6); `authOptions` from `src/lib/auth.ts` (Task 4/5).

- [ ] **Step 1: Replace `src/app/page.tsx` with a session-aware home page**

```tsx
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Nerona Metadata</h1>
      {session?.user ? (
        <div className="mt-4 space-y-2">
          <p>Signed in as {session.user.email}</p>
          <p>
            <Link href="/account" className="text-blue-600 underline">
              Go to your account
            </Link>
          </p>
          <p>
            <a href="/api/auth/signout" className="text-blue-600 underline">
              Sign out
            </a>
          </p>
        </div>
      ) : (
        <p className="mt-4">
          <a href="/api/auth/signin" className="text-blue-600 underline">
            Sign in with Google
          </a>
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Create `src/app/account/page.tsx`**

```tsx
import { requireUser } from "@/lib/session-guards";

export default async function AccountPage() {
  const session = await requireUser();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Your account</h1>
      <p className="mt-4">Email: {session.user.email}</p>
      <p>Role: {session.user.role ?? "customer"}</p>
    </main>
  );
}
```

- [ ] **Step 3: Create `src/app/admin/page.tsx`**

```tsx
import { requireAdmin } from "@/lib/session-guards";

export default async function AdminPage() {
  const session = await requireAdmin();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="mt-4">
        Signed in as {session.user.email} ({session.user.role})
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Manually verify the gating behavior**

Run: `npm run dev`.
- Open `http://localhost:3000/account` in a private/incognito window (no session): expect a redirect to the Google sign-in screen.
- Sign in with an account that has no `AdminRole` row yet, then visit `http://localhost:3000/admin`: expect a redirect to `/account`.
- Visit `http://localhost:3000/account`: expect it to render with your email and "Role: customer".

Stop the dev server once confirmed. (Admin access itself is verified in Task 8, after the seed script grants your account the `owner_admin` role.)

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/account/page.tsx src/app/admin/page.tsx
git commit -m "Add session-gated /account and /admin pages"
```

---

### Task 8: Owner-admin seed script and setup docs

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`
- Create: `README.md`

**Interfaces:**
- Consumes: `OWNER_ADMIN_EMAIL` from `.env.local`; Prisma models `User`, `AdminRole` from Task 2.
- Produces: a runnable `npx prisma db seed` command that guarantees an `owner_admin` row exists (satisfies the spec's "there must always be at least one owner_admin" constraint, from the very first setup).

- [ ] **Step 1: Install `tsx` to run the TypeScript seed script**

Run: `npm install -D tsx`

- [ ] **Step 2: Create `prisma/seed.ts`**

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

- [ ] **Step 3: Add the seed config to `package.json`**

Add a top-level `"prisma"` key (sibling of `"scripts"`):

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 4: Add your own email to `.env.local`**

```
OWNER_ADMIN_EMAIL="<the Google account email you signed in with in Task 4>"
```

- [ ] **Step 5: Run the seed script**

Run: `npx prisma db seed`
Expected: prints `Granted owner_admin to <your email>`.

- [ ] **Step 6: Manually verify admin access now works**

Run: `npm run dev`, sign in with the account matching `OWNER_ADMIN_EMAIL`, visit `http://localhost:3000/admin`.
Expected: page renders "Admin" with your email and `(owner_admin)` — no redirect.

- [ ] **Step 7: Create `README.md`**

```markdown
# Nerona Website

Order and license maintenance platform for the Nerona Metadata Chrome extension.

## Setup

1. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — Postgres connection string (e.g. from https://neon.tech).
   - `NEXTAUTH_URL` — `http://localhost:3000` for local dev.
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from an OAuth 2.0 Client ID at
     https://console.cloud.google.com/apis/credentials (type "Web application"), with
     `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
   - `OWNER_ADMIN_EMAIL` — the Google account email that should get full admin access.
2. Install dependencies: `npm install`
3. Apply the database schema: `npx prisma migrate dev`
4. Grant yourself admin access: `npx prisma db seed`
5. Start the dev server: `npm run dev`

## Testing

Run `npm test` for the unit test suite (license/session logic). Payment and OAuth flows are
verified manually against Stripe/Google test modes — see later phase plans.

## Project structure

- `src/app` — Next.js App Router pages and API routes.
- `src/lib` — server-side helpers (Prisma client, auth config, session guards).
- `prisma/schema.prisma` — database schema.
- `docs/superpowers/specs/` — design specs.
- `docs/superpowers/plans/` — implementation plans, one per phase.
```

- [ ] **Step 8: Run the full test suite and build one more time**

Run: `npm test`
Expected: PASS — 6 passed, 0 failed.

Run: `npm run build`
Expected: build completes successfully (`✓ Compiled successfully`).

- [ ] **Step 9: Commit**

```bash
git add prisma/seed.ts package.json package-lock.json README.md
git commit -m "Add owner-admin seed script and setup docs"
```

---

## Phase 1 complete when

- `npm test` passes (6 tests: `getAdminRole` × 2, `requireUser` × 2, `requireAdmin` × 2).
- `npm run build` succeeds.
- A fresh clone + `npm install` + the README's 5 setup steps results in: signing in with Google at `/`, `/account` showing your email, and `/admin` showing your email with `(owner_admin)` (after running the seed script).
- Non-admin Google accounts can reach `/account` but are redirected away from `/admin`.

**Next phase:** Storefront & Billing (Stripe Checkout, webhooks creating `Subscription`/`License` rows, license key email) — written as its own plan once this phase is verified working.
