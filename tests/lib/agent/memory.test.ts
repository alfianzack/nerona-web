import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentMemory: {
      findMany: vi.fn(),
    },
  },
}));

import { listRecentFacts } from "@/lib/agent/memory";
import { prisma } from "@/lib/prisma";

describe("listRecentFacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the fact strings, newest first, scoped to the profile", async () => {
    (prisma.agentMemory.findMany as any).mockResolvedValue([
      { fact: "Supplier utama: Pak Budi" },
      { fact: "Toko tutup jam 9 malam" },
    ]);

    const result = await listRecentFacts("profile-1");

    expect(result).toEqual(["Supplier utama: Pak Budi", "Toko tutup jam 9 malam"]);
    expect(prisma.agentMemory.findMany).toHaveBeenCalledWith({
      where: { profileId: "profile-1" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { fact: true },
    });
  });

  it("respects a custom limit", async () => {
    (prisma.agentMemory.findMany as any).mockResolvedValue([]);

    await listRecentFacts("profile-1", 5);

    expect(prisma.agentMemory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });
});
