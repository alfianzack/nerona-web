import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentMessage: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import {
  getRecentHistory,
  isDuplicateMessage,
  logInbound,
  logOutbound,
} from "@/lib/agent/messages";
import { prisma } from "@/lib/prisma";

describe("isDuplicateMessage", () => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it("returns true when a message with that waMessageId already exists", async () => {
    (prisma.agentMessage.findUnique as any).mockResolvedValue({ id: "msg-1" });
    expect(await isDuplicateMessage("wamid.1")).toBe(true);
  });

  it("returns false when no message exists yet", async () => {
    (prisma.agentMessage.findUnique as any).mockResolvedValue(null);
    expect(await isDuplicateMessage("wamid.1")).toBe(false);
  });
});

describe("logInbound", () => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it("creates an inbound message row", async () => {
    await logInbound({
      profileId: "profile-1",
      waMessageId: "wamid.1",
      phone: "+15551234567",
      body: "hello",
    });

    expect(prisma.agentMessage.create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        waMessageId: "wamid.1",
        phone: "+15551234567",
        direction: "in",
        body: "hello",
      },
    });
  });

  it("allows a null profileId for unknown senders", async () => {
    await logInbound({
      profileId: null,
      waMessageId: "wamid.2",
      phone: "+15551234567",
      body: "hi",
    });

    expect(prisma.agentMessage.create).toHaveBeenCalledWith({
      data: {
        profileId: null,
        waMessageId: "wamid.2",
        phone: "+15551234567",
        direction: "in",
        body: "hi",
      },
    });
  });
});

describe("logOutbound", () => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it("creates an outbound message row with no waMessageId", async () => {
    await logOutbound({ profileId: "profile-1", phone: "+15551234567", body: "reply" });

    expect(prisma.agentMessage.create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        phone: "+15551234567",
        direction: "out",
        body: "reply",
      },
    });
  });
});

describe("getRecentHistory", () => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it("returns rows oldest-first, limited and scoped to the profile", async () => {
    (prisma.agentMessage.findMany as any).mockResolvedValue([
      { direction: "out", body: "third" },
      { direction: "in", body: "second" },
      { direction: "in", body: "first" },
    ]);

    const result = await getRecentHistory("profile-1", 3);

    expect(prisma.agentMessage.findMany).toHaveBeenCalledWith({
      where: { profileId: "profile-1" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { direction: true, body: true },
    });
    expect(result).toEqual([
      { direction: "in", body: "first" },
      { direction: "in", body: "second" },
      { direction: "out", body: "third" },
    ]);
  });

  it("defaults the limit to 20", async () => {
    (prisma.agentMessage.findMany as any).mockResolvedValue([]);

    await getRecentHistory("profile-1");

    expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    );
  });
});
