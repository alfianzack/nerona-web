import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import {
  findProfileByPhone,
  getOwnProfile,
  markPhoneVerified,
  matchesLinkCode,
  normalizePhone,
  startPhoneLink,
} from "@/lib/agent/profile";
import { prisma } from "@/lib/prisma";

describe("normalizePhone", () => {
  it("keeps a number already in E.164 form", () => {
    expect(normalizePhone("+15551234567")).toBe("+15551234567");
  });

  it("converts a leading 0 to +62 (Indonesian local format)", () => {
    expect(normalizePhone("081234567890")).toBe("+6281234567890");
  });

  it("adds a + to a bare 62-prefixed number", () => {
    expect(normalizePhone("6281234567890")).toBe("+6281234567890");
  });

  it("strips spaces and dashes", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("+6281234567890");
  });
});

describe("findProfileByPhone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("looks up by whatsappPhone", async () => {
    (prisma.agentProfile.findUnique as any).mockResolvedValue({ id: "profile-1" });

    const result = await findProfileByPhone("+15551234567");

    expect(result).toEqual({ id: "profile-1" });
    expect(prisma.agentProfile.findUnique).toHaveBeenCalledWith({
      where: { whatsappPhone: "+15551234567" },
    });
  });
});

describe("getOwnProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("looks up by userId", async () => {
    (prisma.agentProfile.findUnique as any).mockResolvedValue({ id: "profile-1" });

    const result = await getOwnProfile("user-1");

    expect(result).toEqual({ id: "profile-1" });
    expect(prisma.agentProfile.findUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});

describe("startPhoneLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns phone_taken when another profile already owns the number", async () => {
    (prisma.agentProfile.findUnique as any).mockResolvedValue({ id: "other-profile" });

    const result = await startPhoneLink("profile-1", "+15551234567");

    expect(result).toEqual({ ok: false, reason: "phone_taken" });
    expect(prisma.agentProfile.update).not.toHaveBeenCalled();
  });

  it("generates a 6-digit code and updates the profile when the number is free", async () => {
    (prisma.agentProfile.findUnique as any).mockResolvedValue(null);

    const result = await startPhoneLink("profile-1", "+15551234567");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.code).toMatch(/^\d{6}$/);
      expect(result.expires).toBeInstanceOf(Date);
    }
    expect(prisma.agentProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: expect.objectContaining({
        whatsappPhone: "+15551234567",
        phoneVerifiedAt: null,
      }),
    });
  });

  it("allows re-linking the same phone already owned by this profile", async () => {
    (prisma.agentProfile.findUnique as any).mockResolvedValue({ id: "profile-1" });

    const result = await startPhoneLink("profile-1", "+15551234567");

    expect(result.ok).toBe(true);
  });

  it("returns phone_taken when the update hits a concurrent unique-constraint violation", async () => {
    (prisma.agentProfile.findUnique as any).mockResolvedValue(null);
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    (prisma.agentProfile.update as any).mockRejectedValueOnce(p2002);

    const result = await startPhoneLink("profile-1", "+15551234567");

    expect(result).toEqual({ ok: false, reason: "phone_taken" });
  });
});

describe("matchesLinkCode", () => {
  it("returns true for a matching, unexpired code", () => {
    const profile = { linkCode: "123456", linkCodeExpires: new Date(Date.now() + 60_000) };
    expect(matchesLinkCode(profile, "123456")).toBe(true);
  });

  it("trims surrounding whitespace from the incoming text", () => {
    const profile = { linkCode: "123456", linkCodeExpires: new Date(Date.now() + 60_000) };
    expect(matchesLinkCode(profile, "  123456  ")).toBe(true);
  });

  it("returns false for a mismatched code", () => {
    const profile = { linkCode: "123456", linkCodeExpires: new Date(Date.now() + 60_000) };
    expect(matchesLinkCode(profile, "000000")).toBe(false);
  });

  it("returns false for an expired code", () => {
    const profile = { linkCode: "123456", linkCodeExpires: new Date(Date.now() - 1) };
    expect(matchesLinkCode(profile, "123456")).toBe(false);
  });

  it("returns false when there is no active code", () => {
    expect(matchesLinkCode({ linkCode: null, linkCodeExpires: null }, "123456")).toBe(false);
  });
});

describe("markPhoneVerified", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets phoneVerifiedAt and clears the link code", async () => {
    await markPhoneVerified("profile-1");

    expect(prisma.agentProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: expect.objectContaining({ linkCode: null, linkCodeExpires: null }),
    });
    const call = (prisma.agentProfile.update as any).mock.calls[0][0];
    expect(call.data.phoneVerifiedAt).toBeInstanceOf(Date);
  });
});
