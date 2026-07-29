import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    pointTransaction: { groupBy: vi.fn(async () => []) },
  },
}));

import { GET } from "@/app/api/admin/users/route";
import { prisma } from "@/lib/prisma";

function request(): Request {
  return new Request("http://localhost/api/admin/users");
}

const USERS = [
  {
    id: "user-1",
    email: "a@example.com",
    name: "A",
    createdAt: new Date("2026-01-01"),
    adminRole: null,
    licenses: [],
    agentProfile: null,
  },
  {
    id: "user-2",
    email: "b@example.com",
    name: "B",
    createdAt: new Date("2026-01-02"),
    adminRole: null,
    licenses: [],
    agentProfile: null,
  },
];

describe("GET /api/admin/users balances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });
    (prisma.user.count as any).mockResolvedValue(2);
    (prisma.user.findMany as any).mockResolvedValue(USERS);
  });

  it("attaches each user's point balance", async () => {
    (prisma.pointTransaction.groupBy as any).mockResolvedValue([
      { userId: "user-1", _sum: { delta: 5_000 } },
    ]);

    const res = await GET(request());
    const body = await res.json();

    expect(body.users[0].points).toBe(5_000);
    // No ledger rows at all means zero, not undefined.
    expect(body.users[1].points).toBe(0);
  });

  it("treats a null sum as zero", async () => {
    (prisma.pointTransaction.groupBy as any).mockResolvedValue([
      { userId: "user-1", _sum: { delta: null } },
    ]);

    const res = await GET(request());
    const body = await res.json();

    expect(body.users[0].points).toBe(0);
  });

  it("reads every balance in one grouped query, not one per user", async () => {
    await GET(request());

    expect(prisma.pointTransaction.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.pointTransaction.groupBy).toHaveBeenCalledWith({
      by: ["userId"],
      where: { userId: { in: ["user-1", "user-2"] } },
      _sum: { delta: true },
    });
  });
});
