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

import {
  createExtensionToken,
  issueExtensionToken,
  resolveExtensionToken,
  revokeExtensionToken,
} from "@/lib/extension-auth";
import { prisma } from "@/lib/prisma";

beforeEach(() => vi.clearAllMocks());

describe("createExtensionToken", () => {
  it("stores and returns an nrx_ token", async () => {
    (prisma.extensionToken.create as any).mockResolvedValue({ id: "t1" });
    const token = await createExtensionToken("u1", "Chrome");
    expect(token).toMatch(/^nrx_[0-9a-f]{48}$/);
    expect(prisma.extensionToken.create).toHaveBeenCalledWith({
      data: { userId: "u1", token, label: "Chrome" },
      select: { id: true },
    });
  });
  it("keeps existing tokens — replacement must stay opt-in", async () => {
    (prisma.extensionToken.create as any).mockResolvedValue({ id: "t1" });
    await createExtensionToken("u1", "Chrome");
    expect(prisma.extensionToken.deleteMany).not.toHaveBeenCalled();
  });
});

describe("issueExtensionToken", () => {
  it("returns the id so a failed handover can be taken back", async () => {
    (prisma.extensionToken.create as any).mockResolvedValue({ id: "t9" });
    const issued = await issueExtensionToken("u1", "Extension · Chrome");
    expect(issued.id).toBe("t9");
    expect(issued.token).toMatch(/^nrx_[0-9a-f]{48}$/);
  });

  // The extension stores exactly ONE token, so without this every click of
  // "Hubungkan extension" leaves a live full-access credential nobody holds.
  it("revokes same-label tokens first when asked to replace", async () => {
    (prisma.extensionToken.create as any).mockResolvedValue({ id: "t2" });
    (prisma.extensionToken.deleteMany as any).mockResolvedValue({ count: 3 });
    await issueExtensionToken("u1", "Extension · Chrome", { replaceSameLabel: true });
    expect(prisma.extensionToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", label: "Extension · Chrome" },
    });
  });

  // A missing label would match every unlabelled token of every device.
  it("never mass-deletes when there is no label to match on", async () => {
    (prisma.extensionToken.create as any).mockResolvedValue({ id: "t3" });
    await issueExtensionToken("u1", undefined, { replaceSameLabel: true });
    expect(prisma.extensionToken.deleteMany).not.toHaveBeenCalled();
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
