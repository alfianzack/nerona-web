import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailVerificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import {
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  createPasswordResetToken,
} from "@/lib/tokens";
import { prisma } from "@/lib/prisma";

describe("email verification tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a token record for the user and returns the raw token", async () => {
    const token = await createEmailVerificationToken("user-1");

    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
    expect(prisma.emailVerificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", token }),
    });
  });

  it("consumes a valid, unexpired token and deletes it", async () => {
    const future = new Date(Date.now() + 60_000);
    (prisma.emailVerificationToken.findUnique as any).mockResolvedValue({
      userId: "user-1",
      token: "abc",
      expires: future,
    });

    const result = await consumeEmailVerificationToken("abc");

    expect(result).toEqual({ userId: "user-1" });
    expect(prisma.emailVerificationToken.delete).toHaveBeenCalledWith({ where: { token: "abc" } });
  });

  it("returns null for an expired token without deleting it", async () => {
    const past = new Date(Date.now() - 60_000);
    (prisma.emailVerificationToken.findUnique as any).mockResolvedValue({
      userId: "user-1",
      token: "abc",
      expires: past,
    });

    const result = await consumeEmailVerificationToken("abc");

    expect(result).toBeNull();
    expect(prisma.emailVerificationToken.delete).not.toHaveBeenCalled();
  });

  it("returns null for a token that doesn't exist", async () => {
    (prisma.emailVerificationToken.findUnique as any).mockResolvedValue(null);

    const result = await consumeEmailVerificationToken("missing");

    expect(result).toBeNull();
  });
});

describe("password reset tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a token record for the user and returns the raw token", async () => {
    const token = await createPasswordResetToken("user-1");

    expect(typeof token).toBe("string");
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", token }),
    });
  });

  it("consumes a valid, unexpired token and deletes it", async () => {
    const future = new Date(Date.now() + 60_000);
    (prisma.passwordResetToken.findUnique as any).mockResolvedValue({
      userId: "user-1",
      token: "xyz",
      expires: future,
    });

    const result = await consumePasswordResetToken("xyz");

    expect(result).toEqual({ userId: "user-1" });
    expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { token: "xyz" } });
  });
});
