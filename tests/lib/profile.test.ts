import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async () => "new-hash"),
  verifyPassword: vi.fn(),
}));

import { updateProfile, changePassword } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("updateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates only the fields provided", async () => {
    await updateProfile("user-1", { name: "Budi", businessName: "Toko Budi" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Budi", businessName: "Toko Budi" },
    });
  });

  it("passes null to clear a field but omits absent fields", async () => {
    await updateProfile("user-1", { phone: null });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { phone: null },
    });
  });
});

describe("changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no_password when the account has no password (e.g. Google-only)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ password: null });

    const result = await changePassword("user-1", "old", "newsecret8");

    expect(result).toEqual({ ok: false, reason: "no_password" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns wrong_password when the current password does not match", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ password: "stored-hash" });
    (verifyPassword as any).mockResolvedValue(false);

    const result = await changePassword("user-1", "wrong", "newsecret8");

    expect(result).toEqual({ ok: false, reason: "wrong_password" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("hashes and stores the new password when the current one matches", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ password: "stored-hash" });
    (verifyPassword as any).mockResolvedValue(true);

    const result = await changePassword("user-1", "correct", "newsecret8");

    expect(result).toEqual({ ok: true });
    expect(hashPassword).toHaveBeenCalledWith("newsecret8");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password: "new-hash" },
    });
  });
});
