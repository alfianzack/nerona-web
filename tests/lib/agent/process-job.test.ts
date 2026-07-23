import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentProfile: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/agent/jobs", () => ({
  beginProcessing: vi.fn(),
  completeJob: vi.fn(),
  failJob: vi.fn(),
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
vi.mock("@/lib/agent/claude-client", () => ({
  generateReply: vi.fn(),
}));
vi.mock("@/lib/agent/whatsapp-client", () => ({
  sendWhatsAppText: vi.fn(),
}));
vi.mock("@/lib/points", () => ({
  getBalance: vi.fn(),
  spendPoints: vi.fn(),
}));
vi.mock("@/lib/agent/pricing", () => ({
  costForUsage: vi.fn(() => 22),
}));

import { processJob } from "@/lib/agent/process-job";
import { prisma } from "@/lib/prisma";
import { beginProcessing, completeJob, failJob } from "@/lib/agent/jobs";
import { getRecentHistory, logOutbound } from "@/lib/agent/messages";
import { listRecentFacts } from "@/lib/agent/memory";
import { generateReply } from "@/lib/agent/claude-client";
import { sendWhatsAppText } from "@/lib/agent/whatsapp-client";
import { getBalance, spendPoints } from "@/lib/points";
import { costForUsage } from "@/lib/agent/pricing";

const profile = {
  id: "profile-1",
  userId: "user-1",
  whatsappPhone: "+15551234567",
  businessName: "Toko A",
  timezone: "Asia/Jakarta",
};

describe("processJob — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (beginProcessing as any).mockResolvedValue({ id: "job-1", profileId: "profile-1", attempts: 1 });
    (prisma.agentProfile.findUnique as any).mockResolvedValue(profile);
    (listRecentFacts as any).mockResolvedValue(["fact 1"]);
    (getRecentHistory as any).mockResolvedValue([{ direction: "in", body: "halo" }]);
    (getBalance as any).mockResolvedValue(500);
    (generateReply as any).mockResolvedValue({
      text: "Halo juga!",
      model: "gemini-2.0-flash-lite",
      usage: { promptTokens: 20, completionTokens: 10 },
    });
  });

  it("sends the reply, logs it, and completes the job", async () => {
    await processJob("job-1");

    expect(sendWhatsAppText).toHaveBeenCalledWith("+15551234567", "Halo juga!");
    expect(logOutbound).toHaveBeenCalledWith({
      profileId: "profile-1",
      phone: "+15551234567",
      body: "Halo juga!",
    });
    expect(spendPoints).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", cost: 22 })
    );
    expect(completeJob).toHaveBeenCalledWith("job-1");
    expect(failJob).not.toHaveBeenCalled();
  });
});

describe("processJob — failure below MAX_ATTEMPTS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (beginProcessing as any).mockResolvedValue({ id: "job-1", profileId: "profile-1", attempts: 1 });
    (prisma.agentProfile.findUnique as any).mockResolvedValue(profile);
    (listRecentFacts as any).mockResolvedValue([]);
    (getRecentHistory as any).mockResolvedValue([]);
    (generateReply as any).mockRejectedValue(new Error("Claude API down"));
    (failJob as any).mockResolvedValue({ permanentlyFailed: false });
  });

  it("calls failJob with the job's attempts and does not send an apology", async () => {
    await processJob("job-1");

    expect(failJob).toHaveBeenCalledWith("job-1", 1, "Claude API down");
    expect(sendWhatsAppText).not.toHaveBeenCalled();
  });
});

describe("processJob — permanent failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (beginProcessing as any).mockResolvedValue({ id: "job-1", profileId: "profile-1", attempts: 3 });
    (prisma.agentProfile.findUnique as any).mockResolvedValue(profile);
    (listRecentFacts as any).mockResolvedValue([]);
    (getRecentHistory as any).mockResolvedValue([]);
    (generateReply as any).mockRejectedValue(new Error("Claude API down"));
    (failJob as any).mockResolvedValue({ permanentlyFailed: true });
    (sendWhatsAppText as any).mockResolvedValue(undefined);
    (logOutbound as any).mockResolvedValue(undefined);
  });

  it("sends and logs an apology message", async () => {
    await processJob("job-1");

    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("kendala teknis")
    );
    expect(logOutbound).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "profile-1", phone: "+15551234567" })
    );
  });

  it("does not reject processJob when the apology-path profile re-fetch throws", async () => {
    (prisma.agentProfile.findUnique as any)
      .mockResolvedValueOnce(profile)
      .mockRejectedValueOnce(new Error("transient DB error"));

    await expect(processJob("job-1")).resolves.toBeUndefined();

    expect(completeJob).not.toHaveBeenCalled();
    expect(sendWhatsAppText).not.toHaveBeenCalled();
  });
});

describe("processJob — out of points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (beginProcessing as any).mockResolvedValue({ id: "job-1", profileId: "profile-1", attempts: 1 });
    (prisma.agentProfile.findUnique as any).mockResolvedValue(profile);
    (getBalance as any).mockResolvedValue(0);
  });

  it("does not call the AI, sends poin-habis, and completes without spending", async () => {
    await processJob("job-1");

    expect(generateReply).not.toHaveBeenCalled();
    expect(spendPoints).not.toHaveBeenCalled();
    expect(sendWhatsAppText).toHaveBeenCalledWith("+15551234567", expect.stringContaining("poin"));
    expect(completeJob).toHaveBeenCalledWith("job-1");
    expect(failJob).not.toHaveBeenCalled();
  });
});
