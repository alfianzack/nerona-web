import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: vi.fn() } },
}));
vi.mock("@/lib/tokens", () => ({ consumePasswordResetToken: vi.fn() }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn() }));

import { confirmPasswordReset } from "@/lib/reset-password-confirm";
import { prisma } from "@/lib/prisma";
import { consumePasswordResetToken } from "@/lib/tokens";
import { hashPassword } from "@/lib/password";

describe("confirmPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a password shorter than 8 characters without consuming the token", async () => {
    const result = await confirmPasswordReset("some-token", "short");

    expect(result).toEqual({ ok: false, error: "weak_password" });
    expect(consumePasswordResetToken).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expired token", async () => {
    (consumePasswordResetToken as any).mockResolvedValue(null);

    const result = await confirmPasswordReset("bad-token", "long-enough-password");

    expect(result).toEqual({ ok: false, error: "invalid_or_expired" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("updates the user's password hash on a valid token", async () => {
    (consumePasswordResetToken as any).mockResolvedValue({ userId: "user-1" });
    (hashPassword as any).mockResolvedValue("new-hashed-password");

    const result = await confirmPasswordReset("valid-token", "long-enough-password");

    expect(result).toEqual({ ok: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password: "new-hashed-password" },
    });
  });
});
