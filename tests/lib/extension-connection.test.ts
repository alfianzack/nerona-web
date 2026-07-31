import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { extensionToken: { findMany: vi.fn() } },
}));

import { getExtensionConnectionState } from "@/lib/extension-connection";
import { prisma } from "@/lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getExtensionConnectionState", () => {
  it("reports none when the user has never made a token", async () => {
    (prisma.extensionToken.findMany as any).mockResolvedValue([]);
    await expect(getExtensionConnectionState("u1")).resolves.toEqual({ status: "none" });
  });

  it("reports unused when a token exists but has never been called", async () => {
    // Making a token is not connecting: plenty of people create one and stop
    // before pasting it into the popup, and the dashboard has to tell those two
    // states apart to know which nudge to show.
    (prisma.extensionToken.findMany as any).mockResolvedValue([{ lastUsedAt: null }]);
    await expect(getExtensionConnectionState("u1")).resolves.toEqual({ status: "unused" });
  });

  it("reports connected with the most recent use", async () => {
    const recent = new Date("2026-07-30T10:00:00Z");
    const older = new Date("2026-07-01T10:00:00Z");
    (prisma.extensionToken.findMany as any).mockResolvedValue([
      { lastUsedAt: older },
      { lastUsedAt: recent },
    ]);
    await expect(getExtensionConnectionState("u1")).resolves.toEqual({
      status: "connected",
      lastUsedAt: recent,
    });
  });

  it("counts a used token even when an unused one exists alongside it", async () => {
    const used = new Date("2026-07-30T10:00:00Z");
    (prisma.extensionToken.findMany as any).mockResolvedValue([
      { lastUsedAt: null },
      { lastUsedAt: used },
    ]);
    await expect(getExtensionConnectionState("u1")).resolves.toEqual({
      status: "connected",
      lastUsedAt: used,
    });
  });

  it("asks only for the column it needs, scoped to the user", async () => {
    (prisma.extensionToken.findMany as any).mockResolvedValue([]);
    await getExtensionConnectionState("u1");
    expect(prisma.extensionToken.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      select: { lastUsedAt: true },
    });
  });
});
