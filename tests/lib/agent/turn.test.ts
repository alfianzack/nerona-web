import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent/gates", () => ({
  checkAgentGates: vi.fn(),
}));
vi.mock("@/lib/agent/messages", () => ({
  getRecentHistory: vi.fn(),
  logOutbound: vi.fn(),
}));
vi.mock("@/lib/agent/memory", () => ({
  listRecentFacts: vi.fn(),
}));
vi.mock("@/lib/agent/context", () => ({
  buildSystemPrompt: vi.fn(() => "system prompt"),
  toClaudeHistory: vi.fn((history) => history),
}));
vi.mock("@/lib/agent/tool-loop", () => ({
  runToolLoop: vi.fn(),
}));
vi.mock("@/lib/points", () => ({
  getBalance: vi.fn(),
  spendPoints: vi.fn(),
}));
// `pricing` is left REAL: it is pure, and the point of this test is that the rates
// resolved alongside the model actually reach the wallet.

import { runAgentTurn } from "@/lib/agent/turn";
import { checkAgentGates } from "@/lib/agent/gates";
import { getRecentHistory, logOutbound } from "@/lib/agent/messages";
import { listRecentFacts } from "@/lib/agent/memory";
import { buildSystemPrompt } from "@/lib/agent/context";
import { runToolLoop } from "@/lib/agent/tool-loop";
import { spendPoints } from "@/lib/points";

const profile = {
  id: "profile-1",
  userId: "user-1",
  plan: "pro",
  planExpiresAt: null as Date | null,
  businessName: "Toko A",
  timezone: "Asia/Jakarta",
  whatsappPhone: "+15551234567",
};

describe("runAgentTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkAgentGates as any).mockResolvedValue(null);
    (listRecentFacts as any).mockResolvedValue(["fact 1"]);
    (getRecentHistory as any).mockResolvedValue([{ direction: "in", body: "halo" }]);
    (runToolLoop as any).mockResolvedValue({
      text: "Halo juga!",
      model: "gemini-2.0-flash-lite",
      usage: { promptTokens: 20, completionTokens: 10 },
      pricing: { inPerMTok: 3, outPerMTok: 15, pointsPerUsd: 100_000 },
    });
    (spendPoints as any).mockResolvedValue(478);
  });

  it("returns the generated reply", async () => {
    const result = await runAgentTurn({ profile, channel: "web" });

    expect(result).toEqual({ ok: true, reply: "Halo juga!", pointsBalance: 478 });
  });

  it("builds the prompt from the profile and remembered facts", async () => {
    await runAgentTurn({ profile, channel: "web" });

    expect(buildSystemPrompt).toHaveBeenCalledWith({
      businessName: "Toko A",
      timezone: "Asia/Jakarta",
      facts: ["fact 1"],
    });
    expect(runToolLoop).toHaveBeenCalledWith({
      systemPrompt: "system prompt",
      history: [{ direction: "in", body: "halo" }],
      userId: "user-1",
      timezone: "Asia/Jakarta",
    });
  });

  it("logs the reply against the channel it came from", async () => {
    await runAgentTurn({ profile, channel: "web" });

    expect(logOutbound).toHaveBeenCalledWith({
      profileId: "profile-1",
      phone: null,
      body: "Halo juga!",
      channel: "web",
    });
  });

  it("logs against the phone number on the whatsapp channel", async () => {
    await runAgentTurn({ profile, channel: "whatsapp" });

    expect(logOutbound).toHaveBeenCalledWith({
      profileId: "profile-1",
      phone: "+15551234567",
      body: "Halo juga!",
      channel: "whatsapp",
    });
  });

  it("meters the call against the wallet at the configured rates", async () => {
    await runAgentTurn({ profile, channel: "web" });

    // 20/1e6*3 + 10/1e6*15 = 0.00021 USD × 100000 = 21 poin
    expect(spendPoints).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", cost: 21 })
    );
  });

  it("follows a rate change instead of a hardcoded model price", async () => {
    (runToolLoop as any).mockResolvedValue({
      text: "Halo juga!",
      model: "gemini-2.0-flash-lite",
      usage: { promptTokens: 20, completionTokens: 10 },
      pricing: { inPerMTok: 30, outPerMTok: 150, pointsPerUsd: 100_000 },
    });

    await runAgentTurn({ profile, channel: "web" });

    expect(spendPoints).toHaveBeenCalledWith(expect.objectContaining({ cost: 210 }));
  });

  it("returns the reply even when metering fails", async () => {
    (spendPoints as any).mockRejectedValue(new Error("db down"));

    const result = await runAgentTurn({ profile, channel: "web" });

    expect(result.ok).toBe(true);
    expect(result.reply).toBe("Halo juga!");
  });

  it("short-circuits when a gate blocks, without calling the AI", async () => {
    (checkAgentGates as any).mockResolvedValue({
      blocked: "no_points",
      message: "poin habis",
    });

    const result = await runAgentTurn({ profile, channel: "web" });

    expect(result).toEqual({ ok: false, blocked: "no_points", reply: "poin habis" });
    expect(runToolLoop).not.toHaveBeenCalled();
    expect(spendPoints).not.toHaveBeenCalled();
  });

  it("still logs the block message so it appears in history", async () => {
    (checkAgentGates as any).mockResolvedValue({
      blocked: "quota",
      message: "kuota habis",
    });

    await runAgentTurn({ profile, channel: "web" });

    expect(logOutbound).toHaveBeenCalledWith({
      profileId: "profile-1",
      phone: null,
      body: "kuota habis",
      channel: "web",
    });
  });

  it("propagates an AI failure to the caller", async () => {
    (runToolLoop as any).mockRejectedValue(new Error("upstream 502"));

    await expect(runAgentTurn({ profile, channel: "web" })).rejects.toThrow("upstream 502");
    expect(logOutbound).not.toHaveBeenCalled();
  });
});
