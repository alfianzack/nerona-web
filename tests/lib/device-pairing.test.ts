import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devicePairing: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    // approvePairing menelusuri baris ExtensionToken yang baru dibuat untuk
    // mendapatkan id-nya — createExtensionToken hanya mengembalikan string token.
    extensionToken: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    license: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@/lib/extension-auth", () => ({ createExtensionToken: vi.fn() }));

import {
  PAIRING_TTL_MS, makeCode, formatCode, normalizeCode,
  startPairing, approvePairing, claimPairing, revokeHubTokens,
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
    id: "p1", status: "pending", kind: "hub", label: "Nerona Hub · PC",
    expiresAt: new Date(Date.now() + 60_000),
  };

  it("membuat token dan menandai approved", async () => {
    (prisma.devicePairing.findUnique as any).mockResolvedValue(pending);
    (prisma.license.findFirst as any).mockResolvedValue({ hub: true });
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

  it("menolak pairing Hub kalau paketnya tidak menyertakan Hub", async () => {
    (prisma.devicePairing.findUnique as any).mockResolvedValue(pending);
    (prisma.license.findFirst as any).mockResolvedValue({ hub: false });

    expect(await approvePairing({ userId: "u1", code: "4KQ97ZTM", setuju: true }))
      .toEqual({ ok: false, reason: "plan_required" });

    // Yang paling penting dari uji ini: TIDAK ADA token yang tercetak. Token
    // yang terlanjur ada lalu "dibatalkan" tetap kredensial penuh sampai ada
    // yang mencabutnya.
    expect(createExtensionToken).not.toHaveBeenCalled();

    // Statusnya HARUS ditulis. Kalau barisnya dibiarkan `pending`, Hub terus
    // polling sampai kodenya kedaluwarsa lalu melapor "kode kedaluwarsa" —
    // pesan yang menunjuk sebab yang salah, dan pengguna mencoba lagi.
    expect((prisma.devicePairing.update as any).mock.calls[0][0].data)
      .toEqual({ status: "plan_required" });
  });

  it("claimPairing meneruskan plan_required, terpisah dari denied", async () => {
    (prisma.devicePairing.updateMany as any).mockResolvedValue({ count: 0 });
    (prisma.devicePairing.findUnique as any).mockResolvedValue({
      status: "plan_required", token: null, expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await claimPairing("nrd_x")).toEqual({ status: "plan_required" });
  });

  it("menolak pairing Hub kalau akun belum punya lisensi sama sekali", async () => {
    (prisma.devicePairing.findUnique as any).mockResolvedValue(pending);
    (prisma.license.findFirst as any).mockResolvedValue(null);
    expect(await approvePairing({ userId: "u1", code: "4KQ97ZTM", setuju: true }))
      .toEqual({ ok: false, reason: "plan_required" });
    expect(createExtensionToken).not.toHaveBeenCalled();
  });

  it("pairing extension TIDAK ikut terkena gerbang paket", async () => {
    // Gerbangnya khusus `kind === "hub"`. Kalau ia melebar ke extension,
    // seluruh pengguna Free kehilangan extension-nya — kegagalan yang jauh
    // lebih besar daripada yang sedang dicegah.
    (prisma.devicePairing.findUnique as any).mockResolvedValue({
      ...pending, kind: "extension", label: "Extension · Chrome",
    });
    (prisma.license.findFirst as any).mockResolvedValue({ hub: false });
    (createExtensionToken as any).mockResolvedValue("nrx_ext");
    (prisma.extensionToken.findUnique as any).mockResolvedValue({ id: "et2" });
    (prisma.devicePairing.update as any).mockResolvedValue({});

    expect(await approvePairing({ userId: "u1", code: "4KQ97ZTM", setuju: true })).toEqual({ ok: true });
    expect(createExtensionToken).toHaveBeenCalledWith("u1", "Extension · Chrome");
  });
});

describe("revokeHubTokens", () => {
  it("mencabut token yang lahir dari pairing Hub", async () => {
    (prisma.devicePairing.findMany as any).mockResolvedValue([
      { tokenId: "et1" }, { tokenId: "et9" },
    ]);
    (prisma.extensionToken.deleteMany as any).mockResolvedValue({ count: 2 });

    expect(await revokeHubTokens("u1")).toBe(2);

    // Sasarannya lewat relasi pairing, BUKAN pencocokan teks label.
    expect((prisma.devicePairing.findMany as any).mock.calls[0][0].where)
      .toMatchObject({ userId: "u1", kind: "hub" });
    expect((prisma.extensionToken.deleteMany as any).mock.calls[0][0].where)
      .toEqual({ id: { in: ["et1", "et9"] }, userId: "u1" });
  });

  it("tidak menyentuh apa pun kalau akun tidak punya pairing Hub", async () => {
    (prisma.devicePairing.findMany as any).mockResolvedValue([]);
    expect(await revokeHubTokens("u1")).toBe(0);
    expect(prisma.extensionToken.deleteMany).not.toHaveBeenCalled();
  });

  it("mengabaikan pairing yang tokennya sudah lenyap", async () => {
    // `tokenId` di-SetNull saat tokennya dihapus, jadi baris pairing lama tetap
    // ada tanpa token. Tanpa penyaringan ini, `deleteMany` dipanggil dengan
    // `in: [null]` — permintaan yang tidak berarti apa-apa.
    (prisma.devicePairing.findMany as any).mockResolvedValue([{ tokenId: null }]);
    expect(await revokeHubTokens("u1")).toBe(0);
    expect(prisma.extensionToken.deleteMany).not.toHaveBeenCalled();
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
