import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/features", () => ({ AGENT_ENABLED: false }));

// Pulled in when the route modules load. The guard returns before any of it
// runs, but the import graph still has to resolve without a real database.
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/agent/profile", () => ({
  getOwnProfile: vi.fn(async () => ({ id: "p1", userId: "u1", status: "active" })),
  normalizePhone: vi.fn((p: string) => p),
  startPhoneLink: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/agent/messages", () => ({ logInbound: vi.fn(async () => undefined) }));
vi.mock("@/lib/agent/turn", () => ({ runAgentTurn: vi.fn(async () => "reply") }));
vi.mock("@/lib/rate-limit", () => ({ hit: vi.fn(() => ({ ok: true })) }));

describe("agent API routes while agent is hidden", () => {
  it("POST /api/agent/chat answers 403 agent_disabled", async () => {
    const { POST } = await import("@/app/api/agent/chat/route");
    const res = await POST(
      new Request("http://t/api/agent/chat", { method: "POST", body: "{}" })
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "agent_disabled" });
  });

  it("POST /api/agent/link answers 403 agent_disabled", async () => {
    const { POST } = await import("@/app/api/agent/link/route");
    const res = await POST(
      new Request("http://t/api/agent/link", { method: "POST", body: "{}" })
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "agent_disabled" });
  });

  it("GET /api/agent/status answers 403 agent_disabled", async () => {
    const { GET } = await import("@/app/api/agent/status/route");
    const res = await GET();
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "agent_disabled" });
  });

  it("answers 403 before reading the session", async () => {
    // The guard is worthless below the auth check: an unauthenticated caller
    // would get 401 and learn nothing, but the endpoint would still be doing
    // work for a product that is switched off.
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockClear();
    const { GET } = await import("@/app/api/agent/status/route");
    await GET();
    expect(getServerSession).not.toHaveBeenCalled();
  });
});

/**
 * These two keep serving existing WhatsApp customers while the product is
 * hidden from the UI. Asserted statically rather than by importing them: the
 * point is that the guard is ABSENT from the source, and importing the webhook
 * would drag in the whole WhatsApp client for a question about one symbol.
 */
describe("the WhatsApp webhook and the agent job cron stay ungated", () => {
  const src = (relative: string) =>
    readFileSync(join(process.cwd(), "src", "app", "api", relative), "utf8");

  it("does not gate the WhatsApp webhook", () => {
    expect(src("whatsapp/webhook/route.ts")).not.toContain("AGENT_ENABLED");
  });

  it("does not gate the agent job cron", () => {
    expect(src("agent/cron/route.ts")).not.toContain("AGENT_ENABLED");
  });

  it("does not gate the extension API — it is the product being sold", () => {
    for (const route of ["extension/generate/route.ts", "extension/me/route.ts"]) {
      expect(src(route)).not.toContain("AGENT_ENABLED");
    }
  });
});
