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

import { processJob } from "@/lib/agent/process-job";
import { prisma } from "@/lib/prisma";
import { beginProcessing, completeJob, failJob } from "@/lib/agent/jobs";
import { getRecentHistory, logOutbound } from "@/lib/agent/messages";
import { listRecentFacts } from "@/lib/agent/memory";
import { generateReply } from "@/lib/agent/claude-client";
import { sendWhatsAppText } from "@/lib/agent/whatsapp-client";

const profile = {
  id: "profile-1",
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
    (generateReply as any).mockResolvedValue("Halo juga!");
  });

  it("sends the reply, logs it, and completes the job", async () => {
    await processJob("job-1");

    expect(sendWhatsAppText).toHaveBeenCalledWith("+15551234567", "Halo juga!");
    expect(logOutbound).toHaveBeenCalledWith({
      profileId: "profile-1",
      phone: "+15551234567",
      body: "Halo juga!",
    });
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
