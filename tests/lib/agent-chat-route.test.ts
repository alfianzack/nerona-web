import { beforeEach, describe, expect, it, vi } from "vitest";

// This suite tests the chat route's real behaviour — auth, validation, rate
// limiting, metering. The shipped build has AGENT_ENABLED false, which would
// turn every case into a 403; the hidden position is covered in
// agent-hidden-routes.test.ts.
vi.mock("@/lib/features", () => ({ AGENT_ENABLED: true }));

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/agent/profile", () => ({ getOwnProfile: vi.fn() }));
vi.mock("@/lib/agent/messages", () => ({ logInbound: vi.fn() }));
vi.mock("@/lib/agent/turn", () => ({ runAgentTurn: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ hit: vi.fn() }));

import { POST } from "@/app/api/agent/chat/route";
import { getServerSession } from "next-auth";
import { getOwnProfile } from "@/lib/agent/profile";
import { logInbound } from "@/lib/agent/messages";
import { runAgentTurn } from "@/lib/agent/turn";
import { hit } from "@/lib/rate-limit";

function req(body: unknown) {
  return new Request("http://test/api/agent/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const activeProfile = {
  id: "profile-1",
  userId: "user-1",
  status: "active",
  plan: "pro",
  planExpiresAt: null,
  businessName: "Toko A",
  timezone: "Asia/Jakarta",
  whatsappPhone: null,
};

describe("POST /api/agent/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getServerSession as any).mockResolvedValue({ user: { id: "user-1" } });
    (getOwnProfile as any).mockResolvedValue(activeProfile);
    (hit as any).mockReturnValue({ ok: true });
    (runAgentTurn as any).mockResolvedValue({
      ok: true,
      reply: "Halo juga!",
      pointsBalance: 478,
    });
  });

  it("401 without a session", async () => {
    (getServerSession as any).mockResolvedValue(null);
    expect((await POST(req({ text: "halo" }))).status).toBe(401);
  });

  it("403 when the tenant has no agent profile", async () => {
    (getOwnProfile as any).mockResolvedValue(null);
    expect((await POST(req({ text: "halo" }))).status).toBe(403);
  });

  it("403 when the profile is not active", async () => {
    (getOwnProfile as any).mockResolvedValue({ ...activeProfile, status: "pending" });
    expect((await POST(req({ text: "halo" }))).status).toBe(403);
  });

  it("400 on empty text", async () => {
    expect((await POST(req({ text: "   " }))).status).toBe(400);
    expect(runAgentTurn).not.toHaveBeenCalled();
  });

  it("400 when the message is too long", async () => {
    expect((await POST(req({ text: "x".repeat(4001) }))).status).toBe(400);
  });

  it("429 when rate limited", async () => {
    (hit as any).mockReturnValue({ ok: false, retryAfterSeconds: 30 });
    const res = await POST(req({ text: "halo" }));
    expect(res.status).toBe(429);
    expect(runAgentTurn).not.toHaveBeenCalled();
  });

  it("logs the tenant message on the web channel before answering", async () => {
    await POST(req({ text: "  stok kopi berapa?  " }));

    expect(logInbound).toHaveBeenCalledWith({
      profileId: "profile-1",
      body: "stok kopi berapa?",
      channel: "web",
    });
  });

  it("returns the reply and the updated balance", async () => {
    const res = await POST(req({ text: "halo" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      reply: "Halo juga!",
      pointsBalance: 478,
    });
    expect(runAgentTurn).toHaveBeenCalledWith({
      profile: activeProfile,
      channel: "web",
    });
  });

  it("returns a blocked turn as a 200 so the UI can show it in the thread", async () => {
    (runAgentTurn as any).mockResolvedValue({
      ok: false,
      blocked: "no_points",
      reply: "poin habis",
    });

    const res = await POST(req({ text: "halo" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: false,
      blocked: "no_points",
      reply: "poin habis",
    });
  });

  it("502 when the AI call fails", async () => {
    (runAgentTurn as any).mockRejectedValue(new Error("upstream down"));

    const res = await POST(req({ text: "halo" }));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.reply).toContain("kendala teknis");
  });
});
