import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn() }));
vi.mock("@/lib/tokens", () => ({ createEmailVerificationToken: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendVerificationEmail: vi.fn() }));

import { registerUser } from "@/lib/register";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createEmailVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";

describe("registerUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an invalid email format", async () => {
    const result = await registerUser("not-an-email", "long-enough-password");

    expect(result).toEqual({ ok: false, error: "invalid_email" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 8 characters", async () => {
    const result = await registerUser("a@example.com", "short");

    expect(result).toEqual({ ok: false, error: "weak_password" });
  });

  it("rejects when the email is already registered", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "existing-user" });

    const result = await registerUser("a@example.com", "long-enough-password");

    expect(result).toEqual({ ok: false, error: "email_taken" });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("creates the user, sends a verification email, and returns ok on success", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (hashPassword as any).mockResolvedValue("hashed-password");
    (prisma.user.create as any).mockResolvedValue({ id: "new-user", email: "a@example.com" });
    (createEmailVerificationToken as any).mockResolvedValue("token-abc");

    const result = await registerUser("a@example.com", "long-enough-password");

    expect(result).toEqual({ ok: true });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: "a@example.com", password: "hashed-password" },
    });
    expect(createEmailVerificationToken).toHaveBeenCalledWith("new-user");
    expect(sendVerificationEmail).toHaveBeenCalledWith("a@example.com", "token-abc");
  });
});
