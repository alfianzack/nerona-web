import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/points", () => ({ adjustPoints: vi.fn() }));

import { POST } from "@/app/api/admin/points/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { adjustPoints } from "@/lib/points";

function req(body: unknown) {
  return new Request("http://test/api/admin/points", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/admin/points", () => {
  it("401 when the caller is not an admin", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(req({ userId: "u1", delta: 10 }));
    expect(res.status).toBe(401);
  });

  it("400 when delta is zero or not an integer", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    expect((await POST(req({ userId: "u1", delta: 0 }))).status).toBe(400);
    expect((await POST(req({ userId: "u1", delta: 1.5 }))).status).toBe(400);
  });

  it("404 when the user cannot be resolved", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res = await POST(req({ userEmail: "missing@x.com", delta: 10 }));
    expect(res.status).toBe(404);
  });

  it("400 when the adjustment would go below zero", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    (adjustPoints as any).mockResolvedValue({ ok: false, reason: "below_zero" });
    const res = await POST(req({ userId: "u1", delta: -10 }));
    expect(res.status).toBe(400);
  });

  it("returns the new balance on success", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    (adjustPoints as any).mockResolvedValue({ ok: true, balance: 150 });
    const res = await POST(req({ userId: "u1", delta: 50, note: "bonus" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, balance: 150 });
    expect(adjustPoints).toHaveBeenCalledWith({ userId: "u1", delta: 50, note: "bonus", createdById: "a1" });
  });
});
