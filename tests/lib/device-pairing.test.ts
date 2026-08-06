import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devicePairing: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    // approvePairing menelusuri baris ExtensionToken yang baru dibuat untuk
    // mendapatkan id-nya — createExtensionToken hanya mengembalikan string token.
    extensionToken: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@/lib/extension-auth", () => ({ createExtensionToken: vi.fn() }));

import {
  PAIRING_TTL_MS, makeCode, formatCode, normalizeCode,
  startPairing, approvePairing, claimPairing,
} from "@/lib/device-pairing";
import { prisma } from "@/lib/prisma";
import { createExtensionToken } from "@/lib/extension-auth";

beforeEach(() => vi.clearAllMocks());

describe("kode", () => {
  it("8 karakter tanpa huruf yang mudah tertukar", () => {
    for (let i = 0; i < 200; i++) {
      expect(makeCode()).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    }
  });
  it("ditampilkan berkelompok, dibaca kembali apa adanya", () => {
    expect(formatCode("4KQ97ZTM")).toBe("4KQ9-7ZTM");
    expect(normalizeCode(" 4kq9-7ztm ")).toBe("4KQ97ZTM");
  });
});

describe("startPairing", () => {
  it("menyimpan baris pending dengan masa berlaku 10 menit", async () => {
    (prisma.devicePairing.create as any).mockResolvedValue({});
    const before = Date.now();
    const out = await startPairing({ kind: "hub", label: "Nerona Hub · PC" });

    expect(out.code).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    expect(out.deviceSecret).toMatch(/^nrd_[0-9a-f]{64}$/);
    expect(out.expiresAt.getTime()).toBeGreaterThanOrEqual(before + PAIRING_TTL_MS - 5000);

    const arg = (prisma.devicePairing.create as any).mock.calls[0][0];
    expect(arg.data).toMatchObject({ kind: "hub", label: "Nerona Hub · PC", status: "pending" });
  });
});

describe("approvePairing", () => {
  const pending = {
    id: "p1", status: "pending", label: "Nerona Hub · PC",
    expiresAt: new Date(Date.now() + 60_000),
  };

  it("membuat token dan menandai approved", async () => {
    (prisma.devicePairing.findUnique as any).mockResolvedValue(pending);
    (createExtensionToken as any).mockResolvedValue("nrx_abc");
    (prisma.extensionToken.findUnique as any).mockResolvedValue({ id: "et1" });
    (prisma.devicePairing.update as any).mockResolvedValue({});

    expect(await approvePairing({ userId: "u1", code: "4kq9-7ztm", setuju: true })).toEqual({ ok: true });
    expect(createExtensionToken).toHaveBeenCalledWith("u1", "Nerona Hub · PC");
    expect((prisma.devicePairing.findUnique as any).mock.calls[0][0].where).toEqual({ code: "4KQ97ZTM" });
  });

  it("menolak tanpa membuat token", async () => {
    (prisma.devicePairing.findUnique as any).mockResolvedValue(pending);
    (prisma.devicePairing.update as any).mockResolvedValue({});
    expect(await approvePairing({ userId: "u1", code: "4KQ97ZTM", setuju: false })).toEqual({ ok: true });
    expect(createExtensionToken).not.toHaveBeenCalled();
  });

  it("menolak kode kadaluarsa", async () => {
    (prisma.devicePairing.findUnique as any).mockResolvedValue({
      ...pending, expiresAt: new Date(Date.now() - 1000),
    });
    expect(await approvePairing({ userId: "u1", code: "4KQ97ZTM", setuju: true }))
      .toEqual({ ok: false, reason: "expired" });
    expect(createExtensionToken).not.toHaveBeenCalled();
  });

  it("menolak kode yang sudah ditangani", async () => {
    (prisma.devicePairing.findUnique as any).mockResolvedValue({ ...pending, status: "approved" });
    expect(await approvePairing({ userId: "u1", code: "4KQ97ZTM", setuju: true }))
      .toEqual({ ok: false, reason: "already_handled" });
  });

  it("menolak kode yang tidak ada", async () => {
    (prisma.devicePairing.findUnique as any).mockResolvedValue(null);
    expect(await approvePairing({ userId: "u1", code: "ZZZZZZZZ", setuju: true }))
      .toEqual({ ok: false, reason: "not_found" });
  });
});

describe("claimPairing", () => {
  it("menyerahkan token tepat sekali", async () => {
    (prisma.devicePairing.updateMany as any).mockResolvedValueOnce({ count: 1 });
    (prisma.devicePairing.findUnique as any).mockResolvedValue({
      status: "claimed", token: { token: "nrx_abc" },
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await claimPairing("nrd_x")).toEqual({ status: "approved", token: "nrx_abc" });

    // Klaim kedua: updateMany tidak lagi menemukan baris berstatus approved.
    (prisma.devicePairing.updateMany as any).mockResolvedValueOnce({ count: 0 });
    expect(await claimPairing("nrd_x")).toEqual({ status: "pending" });
  });

  it("melaporkan pending, denied, dan kadaluarsa", async () => {
    (prisma.devicePairing.updateMany as any).mockResolvedValue({ count: 0 });

    (prisma.devicePairing.findUnique as any).mockResolvedValueOnce({
      status: "pending", token: null, expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await claimPairing("nrd_x")).toEqual({ status: "pending" });

    (prisma.devicePairing.findUnique as any).mockResolvedValueOnce({
      status: "denied", token: null, expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await claimPairing("nrd_x")).toEqual({ status: "denied" });

    (prisma.devicePairing.findUnique as any).mockResolvedValueOnce({
      status: "pending", token: null, expiresAt: new Date(Date.now() - 1000),
    });
    expect(await claimPairing("nrd_x")).toEqual({ status: "expired" });
  });

  it("melaporkan not_found untuk deviceSecret asing", async () => {
    (prisma.devicePairing.updateMany as any).mockResolvedValue({ count: 0 });
    (prisma.devicePairing.findUnique as any).mockResolvedValue(null);
    expect(await claimPairing("nrd_asing")).toEqual({ status: "not_found" });
  });
});
