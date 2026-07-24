import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    extensionToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { createExtensionToken, resolveExtensionToken, revokeExtensionToken } from "@/lib/extension-auth";
import { prisma } from "@/lib/prisma";

beforeEach(() => vi.clearAllMocks());

describe("createExtensionToken", () => {
  it("stores and returns an nrx_ token", async () => {
    (prisma.extensionToken.create as any).mockResolvedValue({});
    const token = await createExtensionToken("u1", "Chrome");
    expect(token).toMatch(/^nrx_[0-9a-f]{48}$/);
    expect(prisma.extensionToken.create).toHaveBeenCalledWith({
      data: { userId: "u1", token, label: "Chrome" },
    });
  });
});

describe("resolveExtensionToken", () => {
  it("returns userId and bumps lastUsedAt for a known token", async () => {
    (prisma.extensionToken.findUnique as any).mockResolvedValue({ id: "t1", userId: "u1" });
    (prisma.extensionToken.update as any).mockResolvedValue({});
    expect(await resolveExtensionToken("nrx_abc")).toEqual({ userId: "u1" });
    expect(prisma.extensionToken.update).toHaveBeenCalled();
  });
  it("returns null for unknown / empty token", async () => {
    (prisma.extensionToken.findUnique as any).mockResolvedValue(null);
    expect(await resolveExtensionToken("nope")).toBeNull();
    expect(await resolveExtensionToken("")).toBeNull();
  });
});

describe("revokeExtensionToken", () => {
  it("deletes only a token owned by the user", async () => {
    (prisma.extensionToken.deleteMany as any).mockResolvedValue({ count: 1 });
    expect(await revokeExtensionToken("u1", "t1")).toBe(true);
    expect(prisma.extensionToken.deleteMany).toHaveBeenCalledWith({ where: { id: "t1", userId: "u1" } });
    (prisma.extensionToken.deleteMany as any).mockResolvedValue({ count: 0 });
    expect(await revokeExtensionToken("u1", "other")).toBe(false);
  });
});
