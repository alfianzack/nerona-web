import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    agentProfile: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { activateAgentProfile, disableAgentProfile } from "@/lib/agent/admin";
import { prisma } from "@/lib/prisma";

describe("activateAgentProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user_not_found when no User matches the email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await activateAgentProfile("missing@example.com");

    expect(result).toEqual({ ok: false, reason: "user_not_found" });
    expect(prisma.agentProfile.upsert).not.toHaveBeenCalled();
  });

  it("upserts the AgentProfile to active", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });

    const result = await activateAgentProfile("user@example.com");

    expect(result).toEqual({ ok: true });
    expect(prisma.agentProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      update: { status: "active" },
      create: { userId: "user-1", status: "active" },
    });
  });
});

describe("disableAgentProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user_not_found when no User matches the email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await disableAgentProfile("missing@example.com");

    expect(result).toEqual({ ok: false, reason: "user_not_found" });
  });

  it("returns profile_not_found when the user has no AgentProfile", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.agentProfile.findUnique as any).mockResolvedValue(null);

    const result = await disableAgentProfile("user@example.com");

    expect(result).toEqual({ ok: false, reason: "profile_not_found" });
  });

  it("sets status to disabled when a profile exists", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.agentProfile.findUnique as any).mockResolvedValue({ id: "profile-1" });

    const result = await disableAgentProfile("user@example.com");

    expect(result).toEqual({ ok: true });
    expect(prisma.agentProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: { status: "disabled" },
    });
  });
});
