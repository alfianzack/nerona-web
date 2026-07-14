import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: vi.fn() } },
}));
vi.mock("@/lib/tokens", () => ({
  consumeEmailVerificationToken: vi.fn(),
}));

import { verifyEmailToken } from "@/lib/verify-email";
import { prisma } from "@/lib/prisma";
import { consumeEmailVerificationToken } from "@/lib/tokens";

describe("verifyEmailToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the user's email verified when the token is valid", async () => {
    (consumeEmailVerificationToken as any).mockResolvedValue({ userId: "user-1" });

    const result = await verifyEmailToken("valid-token");

    expect(result).toEqual({ ok: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { emailVerified: expect.any(Date) },
    });
  });

  it("returns an error and does not update anything for an invalid token", async () => {
    (consumeEmailVerificationToken as any).mockResolvedValue(null);

    const result = await verifyEmailToken("bad-token");

    expect(result).toEqual({ ok: false, error: "invalid_or_expired" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
