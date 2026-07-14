# Email/Password Auth & Apple-Style Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password registration, email verification, and password reset alongside the existing Google OAuth sign-in, and give all auth pages (`/login`, `/register`, `/reset-password`, `/verify-email`) a polished, Apple-inspired visual redesign.

**Architecture:** next-auth v4's `CredentialsProvider` is added alongside the existing `GoogleProvider`; this forces a switch from `session: { strategy: "database" }` to `session: { strategy: "jwt" }` (a next-auth requirement, not a preference — Credentials provider is incompatible with database sessions). Role lookup moves from the `session` callback to a `jwt` callback (runs once at sign-in) plus a thin `session` callback that copies fields from the token. Registration/verification/reset logic lives in small, independently-testable `src/lib/*.ts` modules that thin API routes and pages call into — the same pattern already used for `getAdminRole`.

**Tech Stack:** `bcryptjs` (password hashing — pure JS, no native build step), `resend` (transactional email), Node's built-in `crypto` (token generation), Tailwind (styling), Vitest (unit tests, mocked Prisma — same pattern as the Foundation phase).

## Global Constraints

- Session strategy is `"jwt"`, not `"database"` — required because `CredentialsProvider` doesn't support database sessions in next-auth v4.
- `session.user.id` / `session.user.role` must keep working exactly as before for `getAdminRole`, `requireUser`, `requireAdmin`, and the `/account`/`/admin` pages — only where the data comes from changes (token, not DB `user` object).
- Unverified users can still sign in and use `/account` (no sign-in blocking) — a banner there prompts verification, per the spec.
- Login, registration, and password-reset-request all return **generic, anti-enumeration responses** — never reveal whether a specific email is registered.
- Password minimum length: 8 characters, validated both client- and server-side.
- Token lifetimes: email verification tokens expire after 24 hours, password reset tokens after 1 hour. Both are single-use (deleted on successful consumption).
- Visual style: system font stack, near-monochrome palette (black/white with dark-mode support via Tailwind `dark:` variants), centered card layout (`max-w-sm`, rounded-2xl, shadow), full-width pill-shaped buttons, inline field-level error text (not banners).
- `EmailVerificationToken` and `PasswordResetToken` are separate tables from Auth.js's own `VerificationToken` table — never reuse or modify that table, it belongs to a different Auth.js feature this project doesn't use.
- Rate limiting, 2FA, and an explicit "link accounts" UI are out of scope for this plan.

## Before you start: one account only you can create

**Resend (transactional email):** go to https://resend.dev, sign up, and copy your API key
(Dashboard → API Keys). You'll need this before Task 4.

**Important limitation to know about now:** without verifying a custom sending domain in Resend,
your account can only deliver emails to the address you signed up with (Resend's test-mode
restriction). For manual verification of the registration/reset emails later in this plan, use
that same email address when registering a test account — otherwise the email will silently
fail to arrive.

---

### Task 1: Prisma schema — password field and token tables

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `User.password String?` (nullable — Google-only users never set one),
  `EmailVerificationToken` (`id`, `userId`, `token` unique, `expires`, `createdAt`),
  `PasswordResetToken` (`id`, `userId`, `token` unique, `expires`, `createdAt`). Consumed by
  Tasks 3, 5, 6, 10, 11, 12.

- [ ] **Step 1: Add `password` to the `User` model**

In `prisma/schema.prisma`, find the `User` model and add `password` right after `image`:

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  password      String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  ...
```

(Leave every other field and relation on `User` exactly as it is.)

- [ ] **Step 2: Add the two new token models**

Add these two models at the end of `prisma/schema.prisma`, after the `Setting` model:

```prisma
model EmailVerificationToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expires   DateTime
  createdAt DateTime @default(now())

  @@map("email_verification_tokens")
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expires   DateTime
  createdAt DateTime @default(now())

  @@map("password_reset_tokens")
}
```

- [ ] **Step 3: Run the migration**

Run: `npm run prisma:migrate -- --name add_email_password_auth`
Expected: output ends with `Your database is now in sync with your schema.`, and a new folder
appears under `prisma/migrations/`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add password field and email/reset token tables"
```

---

### Task 2: Password hashing helper

**Files:**
- Create: `src/lib/password.ts`
- Test: `tests/lib/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>`,
  `verifyPassword(password: string, hash: string): Promise<boolean>`. Consumed by Task 5
  (`authorizeCredentials`), Task 6 (`registerUser`), Task 12 (`confirmPasswordReset`).

- [ ] **Step 1: Install bcryptjs**

Run: `npm install bcryptjs` then `npm install -D @types/bcryptjs`

- [ ] **Step 2: Write the failing tests**

Create `tests/lib/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("hashPassword / verifyPassword", () => {
  it("verifies a password against its own hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");

    await expect(verifyPassword("correct-horse-battery-staple", hash)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");

    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time for the same password", async () => {
    const hashA = await hashPassword("same-password");
    const hashB = await hashPassword("same-password");

    expect(hashA).not.toBe(hashB);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/lib/password.test.ts`
Expected: FAIL — `@/lib/password` does not exist yet.

- [ ] **Step 4: Implement `src/lib/password.ts`**

```ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/lib/password.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/password.ts tests/lib/password.test.ts package.json package-lock.json
git commit -m "Add password hashing helper"
```

---

### Task 3: Token helpers (email verification + password reset)

**Files:**
- Create: `src/lib/tokens.ts`
- Test: `tests/lib/tokens.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts`; `EmailVerificationToken`/`PasswordResetToken`
  models from Task 1.
- Produces: `createEmailVerificationToken(userId: string): Promise<string>`,
  `consumeEmailVerificationToken(token: string): Promise<{ userId: string } | null>`,
  `createPasswordResetToken(userId: string): Promise<string>`,
  `consumePasswordResetToken(token: string): Promise<{ userId: string } | null>`. Consumed by
  Task 6 (`registerUser`), Task 10 (`verifyEmailToken`, resend-verification route), Task 11
  (`requestPasswordReset`), Task 12 (`confirmPasswordReset`).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/tokens.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailVerificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import {
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  createPasswordResetToken,
} from "@/lib/tokens";
import { prisma } from "@/lib/prisma";

describe("email verification tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a token record for the user and returns the raw token", async () => {
    const token = await createEmailVerificationToken("user-1");

    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
    expect(prisma.emailVerificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", token }),
    });
  });

  it("consumes a valid, unexpired token and deletes it", async () => {
    const future = new Date(Date.now() + 60_000);
    (prisma.emailVerificationToken.findUnique as any).mockResolvedValue({
      userId: "user-1",
      token: "abc",
      expires: future,
    });

    const result = await consumeEmailVerificationToken("abc");

    expect(result).toEqual({ userId: "user-1" });
    expect(prisma.emailVerificationToken.delete).toHaveBeenCalledWith({ where: { token: "abc" } });
  });

  it("returns null for an expired token without deleting it", async () => {
    const past = new Date(Date.now() - 60_000);
    (prisma.emailVerificationToken.findUnique as any).mockResolvedValue({
      userId: "user-1",
      token: "abc",
      expires: past,
    });

    const result = await consumeEmailVerificationToken("abc");

    expect(result).toBeNull();
    expect(prisma.emailVerificationToken.delete).not.toHaveBeenCalled();
  });

  it("returns null for a token that doesn't exist", async () => {
    (prisma.emailVerificationToken.findUnique as any).mockResolvedValue(null);

    const result = await consumeEmailVerificationToken("missing");

    expect(result).toBeNull();
  });
});

describe("password reset tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a token record for the user and returns the raw token", async () => {
    const token = await createPasswordResetToken("user-1");

    expect(typeof token).toBe("string");
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", token }),
    });
  });

  it("consumes a valid, unexpired token and deletes it", async () => {
    const future = new Date(Date.now() + 60_000);
    (prisma.passwordResetToken.findUnique as any).mockResolvedValue({
      userId: "user-1",
      token: "xyz",
      expires: future,
    });

    const result = await consumePasswordResetToken("xyz");

    expect(result).toEqual({ userId: "user-1" });
    expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { token: "xyz" } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/tokens.test.ts`
Expected: FAIL — `@/lib/tokens` does not exist yet.

- [ ] **Step 3: Implement `src/lib/tokens.ts`**

```ts
import crypto from "node:crypto";
import { prisma } from "./prisma";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = generateToken();
  await prisma.emailVerificationToken.create({
    data: { userId, token, expires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS) },
  });
  return token;
}

export async function consumeEmailVerificationToken(
  token: string
): Promise<{ userId: string } | null> {
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return null;
  }
  await prisma.emailVerificationToken.delete({ where: { token } });
  return { userId: record.userId };
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = generateToken();
  await prisma.passwordResetToken.create({
    data: { userId, token, expires: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
  });
  return token;
}

export async function consumePasswordResetToken(
  token: string
): Promise<{ userId: string } | null> {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return null;
  }
  await prisma.passwordResetToken.delete({ where: { token } });
  return { userId: record.userId };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/tokens.test.ts`
Expected: PASS — 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tokens.ts tests/lib/tokens.test.ts
git commit -m "Add email verification and password reset token helpers"
```

---

### Task 4: Resend email helper

**Files:**
- Create: `src/lib/mail.ts`
- Test: `tests/lib/mail.test.ts`

**Interfaces:**
- Consumes: `RESEND_API_KEY` (required), `EMAIL_FROM` (optional, defaults to
  `"Nerona <onboarding@resend.dev>"`), `NEXTAUTH_URL` from `.env.local`.
- Produces: `sendVerificationEmail(email: string, token: string): Promise<void>`,
  `sendPasswordResetEmail(email: string, token: string): Promise<void>`. Consumed by Task 6
  (`registerUser`), Task 10 (resend-verification route), Task 11 (`requestPasswordReset`).

- [ ] **Step 1: Install the Resend SDK**

Run: `npm install resend`

- [ ] **Step 2: Add `RESEND_API_KEY` to `.env.local`**

```
RESEND_API_KEY="<your Resend API key>"
```

- [ ] **Step 3: Write the failing tests**

Create `tests/lib/mail.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/mail";

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an email containing a verify-email link with the token", async () => {
    await sendVerificationEmail("user@example.com", "abc123");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.html).toContain("/verify-email?token=abc123");
  });
});

describe("sendPasswordResetEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an email containing a reset-password link with the token", async () => {
    await sendPasswordResetEmail("user@example.com", "xyz789");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.html).toContain("/reset-password/xyz789");
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run tests/lib/mail.test.ts`
Expected: FAIL — `@/lib/mail` does not exist yet.

- [ ] **Step 5: Implement `src/lib/mail.ts`**

```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || "Nerona <onboarding@resend.dev>";

function baseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

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

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/lib/mail.test.ts`
Expected: PASS — 2 passed.

- [ ] **Step 7: Commit**

```bash
git add src/lib/mail.ts tests/lib/mail.test.ts package.json package-lock.json
git commit -m "Add Resend email helper for verification and reset emails"
```

---

### Task 5: JWT sessions, Credentials provider, and custom sign-in page wiring

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/types/next-auth.d.ts`
- Modify: `src/lib/session-guards.ts`
- Modify: `tests/lib/auth.test.ts`
- Modify: `tests/lib/session-guards.test.ts`

**Interfaces:**
- Consumes: `verifyPassword` from `src/lib/password.ts` (Task 2).
- Produces: `authorizeCredentials(email: string, password: string): Promise<{ id: string; email: string; name: string | null } | null>`,
  `jwtCallback`, `sessionCallback` (both exported from `src/lib/auth.ts` for direct testing).
  `requireUser()` now redirects to `/login` instead of `/api/auth/signin`. `authOptions.pages.signIn`
  is `"/login"`. `session.user.id`/`.role` continue to work exactly as before for every
  consumer (`getAdminRole`, `requireUser`, `requireAdmin`, `/account`, `/admin`).

This task changes how sessions are stored (JWT instead of database-backed) — required because
next-auth v4's Credentials provider is incompatible with `session.strategy: "database"`. No
consumer of `session.user` needs to change.

- [ ] **Step 1: Write the failing tests (extends the existing test file)**

Replace the full contents of `tests/lib/auth.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminRole: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(),
}));

import { authorizeCredentials, getAdminRole, jwtCallback, sessionCallback } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

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

describe("authorizeCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the user when email and password match", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      name: "A",
      password: "hashed",
    });
    (verifyPassword as any).mockResolvedValue(true);

    const result = await authorizeCredentials("a@example.com", "correct-password");

    expect(result).toEqual({ id: "user-1", email: "a@example.com", name: "A" });
    expect(verifyPassword).toHaveBeenCalledWith("correct-password", "hashed");
  });

  it("returns null when the password is wrong", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      name: "A",
      password: "hashed",
    });
    (verifyPassword as any).mockResolvedValue(false);

    const result = await authorizeCredentials("a@example.com", "wrong-password");

    expect(result).toBeNull();
  });

  it("returns null when the user has no password set (Google-only account)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      name: "A",
      password: null,
    });

    const result = await authorizeCredentials("a@example.com", "any-password");

    expect(result).toBeNull();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("returns null when no user exists with that email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await authorizeCredentials("nobody@example.com", "any-password");

    expect(result).toBeNull();
  });
});

describe("jwtCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores id and role on the token when a user signs in", async () => {
    (prisma.adminRole.findUnique as any).mockResolvedValue({ role: "owner_admin" });

    const token = await jwtCallback({ token: {}, user: { id: "user-1" } } as any);

    expect(token).toMatchObject({ id: "user-1", role: "owner_admin" });
  });

  it("leaves the token unchanged when there is no user (token refresh)", async () => {
    const existingToken = { id: "user-1", role: "support" };

    const token = await jwtCallback({ token: existingToken } as any);

    expect(token).toBe(existingToken);
    expect(prisma.adminRole.findUnique).not.toHaveBeenCalled();
  });
});

describe("sessionCallback", () => {
  it("copies id and role from the token onto session.user", () => {
    const session = { user: { email: "a@example.com" } } as any;
    const token = { id: "user-1", role: "owner_admin" } as any;

    const result = sessionCallback({ session, token });

    expect(result.user.id).toBe("user-1");
    expect(result.user.role).toBe("owner_admin");
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run tests/lib/auth.test.ts`
Expected: FAIL — `authorizeCredentials`, `jwtCallback`, `sessionCallback` are not exported yet.

- [ ] **Step 3: Replace the full contents of `src/lib/auth.ts`**

```ts
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";

export type AdminRoleValue = "owner_admin" | "support";

export async function getAdminRole(userId: string): Promise<AdminRoleValue | null> {
  const record = await prisma.adminRole.findUnique({ where: { userId } });
  return (record?.role as AdminRoleValue | undefined) ?? null;
}

export async function authorizeCredentials(
  email: string,
  password: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user?.password) {
    return null;
  }
  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    return null;
  }
  return { id: user.id, email: user.email, name: user.name };
}

export async function jwtCallback({
  token,
  user,
}: {
  token: JWT;
  user?: { id: string };
}): Promise<JWT> {
  if (user) {
    token.id = user.id;
    token.role = await getAdminRole(user.id);
  }
  return token;
}

export function sessionCallback({ session, token }: { session: Session; token: JWT }): Session {
  if (session.user) {
    session.user.id = token.id as string;
    session.user.role = (token.role as AdminRoleValue | null) ?? null;
  }
  return session;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        return authorizeCredentials(credentials.email, credentials.password);
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt: jwtCallback,
    session: sessionCallback,
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/auth.test.ts`
Expected: PASS — 9 passed.

- [ ] **Step 5: Add the `JWT` type augmentation**

Replace the full contents of `src/types/next-auth.d.ts` with:

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

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AdminRoleValue | null;
  }
}
```

- [ ] **Step 6: Point `requireUser` at the custom `/login` page**

In `src/lib/session-guards.ts`, change the redirect target:

```ts
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
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

- [ ] **Step 7: Update the session-guards test to match**

In `tests/lib/session-guards.test.ts`, change the one assertion that referenced the old
redirect target:

```ts
  it("redirects to sign-in when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });
```

(Leave every other test in that file unchanged.)

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: PASS — 24 passed, 0 failed (9 in auth.test.ts, 4 in session-guards.test.ts, 3 in
password.test.ts, 6 in tokens.test.ts, 2 in mail.test.ts).

- [ ] **Step 9: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/lib/auth.ts src/types/next-auth.d.ts src/lib/session-guards.ts tests/lib/auth.test.ts tests/lib/session-guards.test.ts
git commit -m "Switch to JWT sessions, add Credentials provider, point at custom /login page"
```

---

### Task 6: Registration logic

**Files:**
- Create: `src/lib/register.ts`
- Test: `tests/lib/register.test.ts`

**Interfaces:**
- Consumes: `hashPassword` (Task 2), `createEmailVerificationToken` (Task 3),
  `sendVerificationEmail` (Task 4), `prisma` (Task 3 of Foundation phase).
- Produces: `type RegisterResult = { ok: true } | { ok: false; error: "invalid_email" | "weak_password" | "email_taken" }`
  and `registerUser(email: string, password: string): Promise<RegisterResult>`. Consumed by
  Task 8 (`POST /api/register`).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/register.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn() }));
vi.mock("@/lib/tokens", () => ({ createEmailVerificationToken: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendVerificationEmail: vi.fn() }));

import { registerUser } from "@/lib/register";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createEmailVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";

describe("registerUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an invalid email format", async () => {
    const result = await registerUser("not-an-email", "long-enough-password");

    expect(result).toEqual({ ok: false, error: "invalid_email" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 8 characters", async () => {
    const result = await registerUser("a@example.com", "short");

    expect(result).toEqual({ ok: false, error: "weak_password" });
  });

  it("rejects when the email is already registered", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "existing-user" });

    const result = await registerUser("a@example.com", "long-enough-password");

    expect(result).toEqual({ ok: false, error: "email_taken" });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("creates the user, sends a verification email, and returns ok on success", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (hashPassword as any).mockResolvedValue("hashed-password");
    (prisma.user.create as any).mockResolvedValue({ id: "new-user", email: "a@example.com" });
    (createEmailVerificationToken as any).mockResolvedValue("token-abc");

    const result = await registerUser("a@example.com", "long-enough-password");

    expect(result).toEqual({ ok: true });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: "a@example.com", password: "hashed-password" },
    });
    expect(createEmailVerificationToken).toHaveBeenCalledWith("new-user");
    expect(sendVerificationEmail).toHaveBeenCalledWith("a@example.com", "token-abc");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/register.test.ts`
Expected: FAIL — `@/lib/register` does not exist yet.

- [ ] **Step 3: Implement `src/lib/register.ts`**

```ts
import { prisma } from "./prisma";
import { hashPassword } from "./password";
import { createEmailVerificationToken } from "./tokens";
import { sendVerificationEmail } from "./mail";

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: "invalid_email" | "weak_password" | "email_taken" };

export async function registerUser(email: string, password: string): Promise<RegisterResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, error: "invalid_email" };
  }
  if (password.length < 8) {
    return { ok: false, error: "weak_password" };
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { ok: false, error: "email_taken" };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email: normalizedEmail, password: passwordHash },
  });

  const token = await createEmailVerificationToken(user.id);
  await sendVerificationEmail(normalizedEmail, token);

  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/register.test.ts`
Expected: PASS — 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/register.ts tests/lib/register.test.ts
git commit -m "Add registerUser registration logic"
```

---

### Task 7: Shared Apple-style auth UI components

**Files:**
- Create: `src/components/auth/AuthCard.tsx`
- Create: `src/components/auth/AuthInput.tsx`
- Create: `src/components/auth/AuthButton.tsx`
- Create: `src/components/auth/GoogleButton.tsx`

**Interfaces:**
- Produces: `<AuthCard title subtitle? children>`, `<AuthInput label type name value onChange error? autoComplete?>`,
  `<AuthButton type? variant? disabled? onClick? children>`, `<GoogleButton>`. Consumed by
  Tasks 8, 9, 11, 12.

- [ ] **Step 1: Create `src/components/auth/AuthCard.tsx`**

```tsx
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 p-8 shadow-xl dark:border-gray-800">
        <h1 className="text-center text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create `src/components/auth/AuthInput.tsx`**

```tsx
interface AuthInputProps {
  label: string;
  type: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete?: string;
}

export function AuthInput({
  label,
  type,
  name,
  value,
  onChange,
  error,
  autoComplete,
}: AuthInputProps) {
  return (
    <div className="mb-4">
      <label
        htmlFor={name}
        className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border px-4 py-2.5 text-gray-900 transition focus:outline-none focus:ring-2 focus:ring-gray-900 dark:text-white dark:focus:ring-white ${
          error ? "border-red-500" : "border-gray-300 dark:border-gray-700"
        }`}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/auth/AuthButton.tsx`**

```tsx
interface AuthButtonProps {
  type?: "button" | "submit";
  variant?: "primary" | "secondary";
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function AuthButton({
  type = "button",
  variant = "primary",
  disabled,
  onClick,
  children,
}: AuthButtonProps) {
  const base = "w-full rounded-full py-2.5 text-sm font-medium transition disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
      : "border border-gray-300 text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-900";

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Create `src/components/auth/GoogleButton.tsx`**

```tsx
"use client";

import { signIn } from "next-auth/react";
import { AuthButton } from "./AuthButton";

export function GoogleButton() {
  return (
    <AuthButton variant="secondary" onClick={() => signIn("google", { callbackUrl: "/account" })}>
      Continue with Google
    </AuthButton>
  );
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/AuthCard.tsx src/components/auth/AuthInput.tsx src/components/auth/AuthButton.tsx src/components/auth/GoogleButton.tsx
git commit -m "Add shared Apple-style auth UI components"
```

---

### Task 8: Registration page and API route

**Files:**
- Create: `src/app/api/register/route.ts`
- Create: `src/app/register/page.tsx`

**Interfaces:**
- Consumes: `registerUser` (Task 6), `AuthCard`/`AuthInput`/`AuthButton`/`GoogleButton` (Task 7).

- [ ] **Step 1: Create `src/app/api/register/route.ts`**

```ts
import { NextResponse } from "next/server";
import { registerUser } from "@/lib/register";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email: "Enter a valid email address.",
  weak_password: "Password must be at least 8 characters.",
  email_taken: "An account with this email may already exist — try signing in instead.",
};

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email || "");
  const password = String(body.password || "");

  const result = await registerUser(email, password);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: ERROR_MESSAGES[result.error] }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create `src/app/register/page.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthButton } from "@/components/auth/AuthButton";
import { GoogleButton } from "@/components/auth/GoogleButton";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.message || "Something went wrong.");
      setSubmitting(false);
      return;
    }

    await signIn("credentials", { email, password, redirect: false });
    router.push("/account");
  }

  return (
    <AuthCard title="Create account" subtitle="Start managing your Nerona license.">
      <GoogleButton />
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
        <span className="text-xs text-gray-400">or</span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
      </div>
      <form onSubmit={handleSubmit}>
        <AuthInput label="Email" type="email" name="email" value={email} onChange={setEmail} autoComplete="email" />
        <AuthInput
          label="Password"
          type="password"
          name="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <AuthInput
          label="Confirm password"
          type="password"
          name="confirmPassword"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={error}
          autoComplete="new-password"
        />
        <AuthButton type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </AuthButton>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <a href="/login" className="font-medium text-gray-900 underline dark:text-white">
          Sign in
        </a>
      </p>
    </AuthCard>
  );
}
```

- [ ] **Step 3: Manually verify the route responds correctly**

Run: `npm run dev`, then in another terminal:

```bash
curl -s -X POST http://localhost:3000/api/register -H "Content-Type: application/json" -d "{\"email\":\"not-an-email\",\"password\":\"whatever\"}"
```

Expected: `{"ok":false,"message":"Enter a valid email address."}`

```bash
curl -s -X POST http://localhost:3000/api/register -H "Content-Type: application/json" -d "{\"email\":\"planbuild-test@example.com\",\"password\":\"long-enough-password\"}"
```

Expected: `{"ok":true}` (this creates a real row — that's fine, it's a disposable test account).
Stop the dev server once confirmed.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/register/route.ts" src/app/register/page.tsx
git commit -m "Add registration page and API route"
```

---

### Task 9: Login page

**Files:**
- Create: `src/app/login/page.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `AuthCard`/`AuthInput`/`AuthButton`/`GoogleButton` (Task 7), next-auth's `pages.signIn: "/login"` (Task 5).

- [ ] **Step 1: Create `src/app/login/page.tsx`**

```tsx
"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthButton } from "@/components/auth/AuthButton";
import { GoogleButton } from "@/components/auth/GoogleButton";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    searchParams.get("error") ? "Something went wrong signing in." : ""
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setError("Invalid email or password.");
      setSubmitting(false);
      return;
    }

    router.push("/account");
  }

  return (
    <AuthCard title="Sign in" subtitle="Manage your Nerona license.">
      <GoogleButton />
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
        <span className="text-xs text-gray-400">or</span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
      </div>
      <form onSubmit={handleSubmit}>
        <AuthInput label="Email" type="email" name="email" value={email} onChange={setEmail} autoComplete="email" />
        <AuthInput
          label="Password"
          type="password"
          name="password"
          value={password}
          onChange={setPassword}
          error={error}
          autoComplete="current-password"
        />
        <div className="mb-4 text-right">
          <a href="/reset-password" className="text-sm text-gray-500 underline">
            Forgot password?
          </a>
        </div>
        <AuthButton type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </AuthButton>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <a href="/register" className="font-medium text-gray-900 underline dark:text-white">
          Create one
        </a>
      </p>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Point the home page's sign-in link at `/login`**

In `src/app/page.tsx`, replace the sign-in link:

```tsx
        <p className="mt-4">
          <a href="/login" className="text-blue-600 underline">
            Sign in
          </a>
        </p>
```

(This replaces the old `<a href="/api/auth/signin">Sign in with Google</a>` line — leave the
rest of the file, including the signed-in branch, unchanged.)

- [ ] **Step 3: Manually verify**

Run: `npm run dev`, open `http://localhost:3000/login` in a browser — confirm the page renders
the card with a "Continue with Google" button, a divider, email/password fields, "Forgot
password?" link, and a "Create one" link to `/register`. Open `http://localhost:3000/` and
confirm its sign-in link now points to `/login`. Stop the dev server once confirmed.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx src/app/page.tsx
git commit -m "Add login page, point home page at it"
```

---

### Task 10: Email verification (page, resend action, account banner)

**Files:**
- Create: `src/lib/verify-email.ts`
- Test: `tests/lib/verify-email.test.ts`
- Create: `src/app/verify-email/page.tsx`
- Create: `src/app/api/resend-verification/route.ts`
- Create: `src/components/auth/ResendVerificationButton.tsx`
- Modify: `src/app/account/page.tsx`

**Interfaces:**
- Consumes: `consumeEmailVerificationToken` (Task 3), `createEmailVerificationToken` (Task 3),
  `sendVerificationEmail` (Task 4), `requireUser` (Foundation phase Task 6), `authOptions`
  (Task 5).
- Produces: `verifyEmailToken(token: string): Promise<{ ok: true } | { ok: false; error: "invalid_or_expired" }>`.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/verify-email.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: vi.fn() } },
}));
vi.mock("@/lib/tokens", () => ({
  consumeEmailVerificationToken: vi.fn(),
}));

import { verifyEmailToken } from "@/lib/verify-email";
import { prisma } from "@/lib/prisma";
import { consumeEmailVerificationToken } from "@/lib/tokens";

describe("verifyEmailToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the user's email verified when the token is valid", async () => {
    (consumeEmailVerificationToken as any).mockResolvedValue({ userId: "user-1" });

    const result = await verifyEmailToken("valid-token");

    expect(result).toEqual({ ok: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { emailVerified: expect.any(Date) },
    });
  });

  it("returns an error and does not update anything for an invalid token", async () => {
    (consumeEmailVerificationToken as any).mockResolvedValue(null);

    const result = await verifyEmailToken("bad-token");

    expect(result).toEqual({ ok: false, error: "invalid_or_expired" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/verify-email.test.ts`
Expected: FAIL — `@/lib/verify-email` does not exist yet.

- [ ] **Step 3: Implement `src/lib/verify-email.ts`**

```ts
import { prisma } from "./prisma";
import { consumeEmailVerificationToken } from "./tokens";

export type VerifyEmailResult = { ok: true } | { ok: false; error: "invalid_or_expired" };

export async function verifyEmailToken(token: string): Promise<VerifyEmailResult> {
  const consumed = await consumeEmailVerificationToken(token);
  if (!consumed) {
    return { ok: false, error: "invalid_or_expired" };
  }
  await prisma.user.update({
    where: { id: consumed.userId },
    data: { emailVerified: new Date() },
  });
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/verify-email.test.ts`
Expected: PASS — 2 passed.

- [ ] **Step 5: Create `src/app/verify-email/page.tsx`**

```tsx
import Link from "next/link";
import { verifyEmailToken } from "@/lib/verify-email";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;
  const result = token
    ? await verifyEmailToken(token)
    : ({ ok: false, error: "invalid_or_expired" } as const);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 p-8 text-center shadow-xl dark:border-gray-800">
        {result.ok ? (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Email verified
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Your email address has been verified.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Link expired
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              This verification link is invalid or has expired.
            </p>
          </>
        )}
        <Link
          href="/account"
          className="mt-6 inline-block font-medium text-gray-900 underline dark:text-white"
        >
          Go to your account
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Create `src/app/api/resend-verification/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createEmailVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const token = await createEmailVerificationToken(session.user.id);
  await sendVerificationEmail(session.user.email, token);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Create `src/components/auth/ResendVerificationButton.tsx`**

```tsx
"use client";

import { useState } from "react";

export function ResendVerificationButton() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function handleClick() {
    setStatus("sending");
    await fetch("/api/resend-verification", { method: "POST" });
    setStatus("sent");
  }

  if (status === "sent") {
    return <p className="text-sm text-green-600">Verification email sent — check your inbox.</p>;
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "sending"}
      className="text-sm font-medium text-gray-900 underline disabled:opacity-50 dark:text-white"
    >
      {status === "sending" ? "Sending..." : "Resend verification email"}
    </button>
  );
}
```

- [ ] **Step 8: Add the verification banner to `/account`**

Replace the full contents of `src/app/account/page.tsx`:

```tsx
import { requireUser } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";

export default async function AccountPage() {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
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
    </main>
  );
}
```

- [ ] **Step 9: Manually verify**

Run: `npm run dev`. Register a test account at `/register` using the same email address your
Resend account is registered under (per the "Before you start" note). Confirm the verification
email arrives, click its link, confirm `/verify-email` shows "Email verified". Sign in and
visit `/account` before verifying to confirm the yellow banner and resend button appear, and
disappear after verifying. Stop the dev server once confirmed.

- [ ] **Step 10: Commit**

```bash
git add src/lib/verify-email.ts tests/lib/verify-email.test.ts src/app/verify-email/page.tsx "src/app/api/resend-verification/route.ts" src/components/auth/ResendVerificationButton.tsx src/app/account/page.tsx
git commit -m "Add email verification flow and account page banner"
```

---

### Task 11: Password reset — request step

**Files:**
- Create: `src/lib/forgot-password.ts`
- Test: `tests/lib/forgot-password.test.ts`
- Create: `src/app/api/forgot-password/route.ts`
- Create: `src/app/reset-password/page.tsx`

**Interfaces:**
- Consumes: `createPasswordResetToken` (Task 3), `sendPasswordResetEmail` (Task 4),
  `AuthCard`/`AuthInput`/`AuthButton` (Task 7).
- Produces: `requestPasswordReset(email: string): Promise<void>` — always resolves without
  throwing, regardless of whether the email is registered (anti-enumeration).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/forgot-password.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/tokens", () => ({ createPasswordResetToken: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendPasswordResetEmail: vi.fn() }));

import { requestPasswordReset } from "@/lib/forgot-password";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/mail";

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a token and sends an email when the user has a password set", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1", password: "hashed" });
    (createPasswordResetToken as any).mockResolvedValue("token-abc");

    await requestPasswordReset("a@example.com");

    expect(createPasswordResetToken).toHaveBeenCalledWith("user-1");
    expect(sendPasswordResetEmail).toHaveBeenCalledWith("a@example.com", "token-abc");
  });

  it("does nothing when no user exists with that email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    await requestPasswordReset("nobody@example.com");

    expect(createPasswordResetToken).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("does nothing when the user exists but has no password (Google-only account)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1", password: null });

    await requestPasswordReset("a@example.com");

    expect(createPasswordResetToken).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/forgot-password.test.ts`
Expected: FAIL — `@/lib/forgot-password` does not exist yet.

- [ ] **Step 3: Implement `src/lib/forgot-password.ts`**

```ts
import { prisma } from "./prisma";
import { createPasswordResetToken } from "./tokens";
import { sendPasswordResetEmail } from "./mail";

export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.password) {
    return;
  }
  const token = await createPasswordResetToken(user.id);
  await sendPasswordResetEmail(normalizedEmail, token);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/forgot-password.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 5: Create `src/app/api/forgot-password/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/forgot-password";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email || "");
  await requestPasswordReset(email);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Create `src/app/reset-password/page.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthButton } from "@/components/auth/AuthButton";

export default function RequestResetPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <AuthCard title="Reset password" subtitle="We'll email you a reset link.">
      {submitted ? (
        <p className="text-center text-sm text-gray-500">
          If that email exists, we&apos;ve sent a reset link — check your inbox.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <AuthInput
            label="Email"
            type="email"
            name="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <AuthButton type="submit" disabled={submitting}>
            {submitting ? "Sending..." : "Send reset link"}
          </AuthButton>
        </form>
      )}
    </AuthCard>
  );
}
```

- [ ] **Step 7: Manually verify**

Run: `npm run dev`, open `http://localhost:3000/reset-password`, submit the email address your
test account (Task 10) used, confirm the page shows the "if that email exists..." message and a
reset email arrives. Stop the dev server once confirmed.

- [ ] **Step 8: Commit**

```bash
git add src/lib/forgot-password.ts tests/lib/forgot-password.test.ts "src/app/api/forgot-password/route.ts" src/app/reset-password/page.tsx
git commit -m "Add password reset request flow"
```

---

### Task 12: Password reset — confirm step

**Files:**
- Create: `src/lib/reset-password-confirm.ts`
- Test: `tests/lib/reset-password-confirm.test.ts`
- Create: `src/app/api/reset-password/route.ts`
- Create: `src/app/reset-password/[token]/page.tsx`

**Interfaces:**
- Consumes: `consumePasswordResetToken` (Task 3), `hashPassword` (Task 2),
  `AuthCard`/`AuthInput`/`AuthButton` (Task 7).
- Produces: `confirmPasswordReset(token: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: "invalid_or_expired" | "weak_password" }>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/reset-password-confirm.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: vi.fn() } },
}));
vi.mock("@/lib/tokens", () => ({ consumePasswordResetToken: vi.fn() }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn() }));

import { confirmPasswordReset } from "@/lib/reset-password-confirm";
import { prisma } from "@/lib/prisma";
import { consumePasswordResetToken } from "@/lib/tokens";
import { hashPassword } from "@/lib/password";

describe("confirmPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a password shorter than 8 characters without consuming the token", async () => {
    const result = await confirmPasswordReset("some-token", "short");

    expect(result).toEqual({ ok: false, error: "weak_password" });
    expect(consumePasswordResetToken).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expired token", async () => {
    (consumePasswordResetToken as any).mockResolvedValue(null);

    const result = await confirmPasswordReset("bad-token", "long-enough-password");

    expect(result).toEqual({ ok: false, error: "invalid_or_expired" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("updates the user's password hash on a valid token", async () => {
    (consumePasswordResetToken as any).mockResolvedValue({ userId: "user-1" });
    (hashPassword as any).mockResolvedValue("new-hashed-password");

    const result = await confirmPasswordReset("valid-token", "long-enough-password");

    expect(result).toEqual({ ok: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password: "new-hashed-password" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/reset-password-confirm.test.ts`
Expected: FAIL — `@/lib/reset-password-confirm` does not exist yet.

- [ ] **Step 3: Implement `src/lib/reset-password-confirm.ts`**

```ts
import { prisma } from "./prisma";
import { hashPassword } from "./password";
import { consumePasswordResetToken } from "./tokens";

export type ConfirmResetResult =
  | { ok: true }
  | { ok: false; error: "invalid_or_expired" | "weak_password" };

export async function confirmPasswordReset(
  token: string,
  newPassword: string
): Promise<ConfirmResetResult> {
  if (newPassword.length < 8) {
    return { ok: false, error: "weak_password" };
  }

  const consumed = await consumePasswordResetToken(token);
  if (!consumed) {
    return { ok: false, error: "invalid_or_expired" };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: consumed.userId },
    data: { password: passwordHash },
  });

  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/reset-password-confirm.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 5: Create `src/app/api/reset-password/route.ts`**

```ts
import { NextResponse } from "next/server";
import { confirmPasswordReset } from "@/lib/reset-password-confirm";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_or_expired: "This reset link is invalid or has expired.",
  weak_password: "Password must be at least 8 characters.",
};

export async function POST(request: Request) {
  const body = await request.json();
  const token = String(body.token || "");
  const password = String(body.password || "");

  const result = await confirmPasswordReset(token, password);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: ERROR_MESSAGES[result.error] }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Create `src/app/reset-password/[token]/page.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthButton } from "@/components/auth/AuthButton";

export default function ConfirmResetPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.message || "Something went wrong.");
      setSubmitting(false);
      return;
    }

    router.push("/login");
  }

  return (
    <AuthCard title="Set new password">
      <form onSubmit={handleSubmit}>
        <AuthInput
          label="New password"
          type="password"
          name="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <AuthInput
          label="Confirm new password"
          type="password"
          name="confirmPassword"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={error}
          autoComplete="new-password"
        />
        <AuthButton type="submit" disabled={submitting}>
          {submitting ? "Updating..." : "Update password"}
        </AuthButton>
      </form>
    </AuthCard>
  );
}
```

- [ ] **Step 7: Manually verify end-to-end**

Run: `npm run dev`. Using the reset email from Task 11's manual check, open its link (should
land on `/reset-password/<token>`), set a new password, confirm redirect to `/login`, then sign
in with the new password and confirm it lands on `/account`. Stop the dev server once confirmed.

- [ ] **Step 8: Commit**

```bash
git add src/lib/reset-password-confirm.ts tests/lib/reset-password-confirm.test.ts "src/app/api/reset-password/route.ts" "src/app/reset-password/[token]/page.tsx"
git commit -m "Add password reset confirm flow"
```

---

### Task 13: Final integration — docs and full verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- None — this task only updates documentation and runs final verification across everything
  built in Tasks 1-12.

- [ ] **Step 1: Update `.env.example`**

Add these two lines (after `OWNER_ADMIN_EMAIL`):

```
RESEND_API_KEY=""
EMAIL_FROM="Nerona <onboarding@resend.dev>"
```

- [ ] **Step 2: Update `README.md`**

Add a bullet to the existing env var list in the "Setup" section (after the
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` bullet):

```markdown
   - `RESEND_API_KEY` — from https://resend.dev (Dashboard → API Keys). Used to send
     verification and password-reset emails. Without a verified sending domain, Resend can
     only deliver to the email address your Resend account was created with.
   - `EMAIL_FROM` — optional, defaults to `"Nerona <onboarding@resend.dev>"`.
```

Add a new section after "## Testing":

```markdown
## Auth methods

Two ways to sign in: Google OAuth, or email/password (`/register`, `/login`). Email/password
accounts get a verification email on signup (`/verify-email`) and can reset their password via
`/reset-password`. Unverified accounts can still sign in and use `/account`, with a reminder
banner shown there until verified.
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — 36 passed, 0 failed (9 auth.test.ts + 4 session-guards.test.ts + 3
password.test.ts + 6 tokens.test.ts + 2 mail.test.ts + 4 register.test.ts + 2
verify-email.test.ts + 3 forgot-password.test.ts + 3 reset-password-confirm.test.ts).

- [ ] **Step 4: Run the production build**

Run: `npm run build`
Expected: build completes successfully (`✓ Compiled successfully`), with `/login`, `/register`,
`/verify-email`, `/reset-password`, and `/reset-password/[token]` all listed as routes in the
output.

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md
git commit -m "Document email/password auth setup"
```

---

## Feature complete when

- `npm test` passes with every new test file green alongside the Foundation phase's original 6.
- `npm run build` succeeds and lists all new routes.
- A human can: register a new account at `/register`, receive and click a verification email,
  see the `/account` banner disappear once verified, sign out, sign back in at `/login` with
  the same password, request a password reset at `/reset-password`, receive and use that reset
  link, and sign in with the new password — all pages styled per the Apple-inspired direction
  in the design spec.
