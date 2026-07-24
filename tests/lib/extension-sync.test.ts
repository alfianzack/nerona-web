import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() }, license: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/points", () => ({ getBalance: vi.fn() }));

import { getExtensionAccountState } from "@/lib/extension-sync";
import { prisma } from "@/lib/prisma";
import { getBalance } from "@/lib/points";

const now = new Date("2026-07-24T00:00:00Z");
beforeEach(() => {
  vi.clearAllMocks();
  (prisma.user.findUnique as any).mockResolvedValue({ email: "u@x.com" });
  (getBalance as any).mockResolvedValue(1250);
});

describe("getExtensionAccountState", () => {
  it("active for an active license with future validUntil", async () => {
    (prisma.license.findFirst as any).mockResolvedValue({
      status: "active", validUntil: new Date("2026-08-01T00:00:00Z"),
      marketplaces: "*", rejectAnalyzer: false, plan: { name: "Pro" },
    });
    const s = await getExtensionAccountState("u1", now);
    expect(s).toMatchObject({ email: "u@x.com", plan: "Pro", active: true, pointsBalance: 1250 });
  });
  it("inactive when validUntil is in the past", async () => {
    (prisma.license.findFirst as any).mockResolvedValue({
      status: "active", validUntil: new Date("2026-07-01T00:00:00Z"),
      marketplaces: "*", rejectAnalyzer: false, plan: { name: "Pro" },
    });
    expect((await getExtensionAccountState("u1", now)).active).toBe(false);
  });
  it("inactive when there is no license", async () => {
    (prisma.license.findFirst as any).mockResolvedValue(null);
    const s = await getExtensionAccountState("u1", now);
    expect(s.active).toBe(false);
    expect(s.plan).toBeNull();
  });
  it("active with null validUntil (legacy)", async () => {
    (prisma.license.findFirst as any).mockResolvedValue({
      status: "comp", validUntil: null, marketplaces: "*", rejectAnalyzer: false, plan: { name: "Comp" },
    });
    expect((await getExtensionAccountState("u1", now)).active).toBe(true);
  });
});
