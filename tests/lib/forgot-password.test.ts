import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/tokens", () => ({ createPasswordResetToken: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendPasswordResetEmail: vi.fn() }));

import { requestPasswordReset } from "@/lib/forgot-password";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/mail";

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a token and sends an email when the user has a password set", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1", password: "hashed" });
    (createPasswordResetToken as any).mockResolvedValue("token-abc");

    await requestPasswordReset("a@example.com");

    expect(createPasswordResetToken).toHaveBeenCalledWith("user-1");
    expect(sendPasswordResetEmail).toHaveBeenCalledWith("a@example.com", "token-abc");
  });

  it("does nothing when no user exists with that email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    await requestPasswordReset("nobody@example.com");

    expect(createPasswordResetToken).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("does nothing when the user exists but has no password (Google-only account)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1", password: null });

    await requestPasswordReset("a@example.com");

    expect(createPasswordResetToken).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
