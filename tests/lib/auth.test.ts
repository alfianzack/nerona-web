import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminRole: {
      findUnique: vi.fn(),
    },
  },
}));

import { getAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

describe("getAdminRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the role when an AdminRole row exists", async () => {
    (prisma.adminRole.findUnique as any).mockResolvedValue({ role: "owner_admin" });

    const role = await getAdminRole("user-1");

    expect(role).toBe("owner_admin");
    expect(prisma.adminRole.findUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("returns null when no AdminRole row exists", async () => {
    (prisma.adminRole.findUnique as any).mockResolvedValue(null);

    const role = await getAdminRole("user-2");

    expect(role).toBeNull();
  });
});
