import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/unduhan-settings", () => ({ updateUnduhanSettings: vi.fn() }));

import { POST } from "@/app/api/releases/publish/route";
import { updateUnduhanSettings } from "@/lib/unduhan-settings";

const RAHASIA = "rahasia-rilis";
const MSI =
  "https://github.com/alfianzack/nerona-hub-releases/releases/download/hub-v0.1.1/Nerona.Hub_0.1.1_x64_en-US.msi";
const DMG =
  "https://github.com/alfianzack/nerona-hub-releases/releases/download/hub-v0.1.1/Nerona.Hub_0.1.1_universal.dmg";
const ZIP =
  "https://github.com/alfianzack/nerona-hub-releases/releases/download/ext-v1.1.1/nerona-metadata-1.1.1.zip";

function req(body: unknown, auth: string | null = `Bearer ${RAHASIA}`) {
  return new Request("http://test/api/releases/publish", {
    method: "POST",
    headers: auth ? { authorization: auth, "content-type": "application/json" } : {},
    body: JSON.stringify(body),
  });
}

const hub = { produk: "hub", versi: "0.1.1", aset: { windows: MSI, mac: DMG } };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RELEASE_SECRET = RAHASIA;
});
afterEach(() => {
  delete process.env.RELEASE_SECRET;
});

describe("POST /api/releases/publish — penjaga", () => {
  it("401 tanpa header, dengan rahasia salah, atau dengan skema salah", async () => {
    expect((await POST(req(hub, null))).status).toBe(401);
    expect((await POST(req(hub, "Bearer salah"))).status).toBe(401);
    expect((await POST(req(hub, RAHASIA))).status).toBe(401);
    expect(updateUnduhanSettings).not.toHaveBeenCalled();
  });

  it("401 kalau RELEASE_SECRET belum diset di server", async () => {
    // Env yang belum ada harus berarti pintu tertutup, bukan pintu terbuka.
    delete process.env.RELEASE_SECRET;
    expect((await POST(req(hub, "Bearer apa pun"))).status).toBe(401);
    expect((await POST(req(hub, null))).status).toBe(401);
    expect(updateUnduhanSettings).not.toHaveBeenCalled();
  });
});

describe("POST /api/releases/publish — Hub", () => {
  it("menulis kedua installer dan versinya, tanpa menyentuh kunci extension", async () => {
    const res = await POST(req(hub));
    expect(res.status).toBe(200);
    expect(updateUnduhanSettings).toHaveBeenCalledWith({
      hubWindowsUrl: MSI,
      hubMacUrl: DMG,
      hubVersion: "0.1.1",
    });
  });

  it("menolak kalau salah satu installer hilang", async () => {
    // Rilis Hub yang cuma punya .msi berarti build macOS gagal. Menyimpan
    // separuhnya membuat tombol Mac menunjuk versi lama tanpa ada yang tahu.
    const res = await POST(req({ produk: "hub", versi: "0.1.1", aset: { windows: MSI } }));
    expect(res.status).toBe(400);
    expect(updateUnduhanSettings).not.toHaveBeenCalled();
  });
});

describe("POST /api/releases/publish — extension", () => {
  it("menulis URL ZIP dan versinya, tanpa menyentuh kunci Hub", async () => {
    const res = await POST(req({ produk: "extension", versi: "1.1.1", aset: { zip: ZIP } }));
    expect(res.status).toBe(200);
    expect(updateUnduhanSettings).toHaveBeenCalledWith({
      extensionUrl: ZIP,
      extensionVersion: "1.1.1",
    });
  });
});

describe("POST /api/releases/publish — penolakan isi", () => {
  it("menolak produk yang tidak dikenal", async () => {
    const res = await POST(req({ produk: "hubb", versi: "0.1.1", aset: { windows: MSI, mac: DMG } }));
    expect(res.status).toBe(400);
    expect(updateUnduhanSettings).not.toHaveBeenCalled();
  });

  it("menolak versi kosong", async () => {
    const res = await POST(req({ produk: "hub", versi: "  ", aset: { windows: MSI, mac: DMG } }));
    expect(res.status).toBe(400);
    expect(updateUnduhanSettings).not.toHaveBeenCalled();
  });

  it("menolak URL yang tidak boleh jadi href", async () => {
    // Penjaga di titik render tetap ada; ini yang membuat CI merah hari itu
    // juga, bukan tombol mati yang baru ketahuan dari keluhan pengguna.
    for (const jahat of ["http://x/y.msi", "javascript:alert(1)", "https://x/dua kata.msi", ""]) {
      const res = await POST(req({ produk: "hub", versi: "0.1.1", aset: { windows: jahat, mac: DMG } }));
      expect(res.status).toBe(400);
    }
    expect(updateUnduhanSettings).not.toHaveBeenCalled();
  });

  it("menolak upaya menulis versi minimum", async () => {
    // Itu kebijakan, bukan fakta build. CI tidak pernah boleh mengunci pengguna.
    const res = await POST(
      req({ produk: "extension", versi: "1.1.1", aset: { zip: ZIP }, extensionMinVersion: "1.1.1" })
    );
    expect(res.status).toBe(400);
    expect(updateUnduhanSettings).not.toHaveBeenCalled();
  });

  it("menolak badan yang bukan objek", async () => {
    expect((await POST(req(null))).status).toBe(400);
    expect((await POST(req("hub"))).status).toBe(400);
    expect(updateUnduhanSettings).not.toHaveBeenCalled();
  });
});
