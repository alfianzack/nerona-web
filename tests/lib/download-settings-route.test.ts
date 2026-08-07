import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const getUnduhanSettingsMock = vi.fn();
const updateUnduhanSettingsMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/unduhan-settings", () => ({
  getUnduhanSettings: () => getUnduhanSettingsMock(),
  updateUnduhanSettings: (...args: unknown[]) => updateUnduhanSettingsMock(...(args as [])),
}));

import { GET, POST } from "@/app/api/admin/download-settings/route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/admin/download-settings", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/admin/download-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses a caller with no admin role", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });

    expect((await GET()).status).toBe(401);
    expect((await POST(post({ hubVersion: "9.9" }))).status).toBe(401);
    expect(getUnduhanSettingsMock).not.toHaveBeenCalled();
    // Tautan unduhan menentukan berkas apa yang dipasang pengguna di mesinnya
    // sendiri. Yang bukan admin tidak boleh menyentuhnya.
    expect(updateUnduhanSettingsMock).not.toHaveBeenCalled();
  });

  it("returns the settings for an admin", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });
    getUnduhanSettingsMock.mockResolvedValue({
      hubWindowsUrl: "https://x/y.msi",
      hubMacUrl: "",
      hubVersion: "0.1.0",
      extensionUrl: "",
      extensionVersion: "",
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).settings.hubWindowsUrl).toBe("https://x/y.msi");
  });

  it("saves trimmed strings and treats non-strings as empty", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });

    const res = await POST(
      post({
        hubWindowsUrl: "  https://x/y.msi  ",
        hubMacUrl: null,
        hubVersion: 0.1,
        extensionUrl: "https://x/e.zip",
        extensionVersion: "1.3",
        extensionMinVersion: " 1.1 ",
      })
    );

    expect(res.status).toBe(200);
    expect(updateUnduhanSettingsMock).toHaveBeenCalledWith({
      hubWindowsUrl: "https://x/y.msi",
      hubMacUrl: "",
      hubVersion: "",
      extensionUrl: "https://x/e.zip",
      extensionVersion: "1.3",
      extensionMinVersion: "1.1",
    });
  });

  it("mengosongkan versi minimum yang tidak dikirim, jadi admin bisa mencabut gerbangnya", async () => {
    // Panel selalu mengirim keenam kunci. Kolom yang dikosongkan admin harus
    // benar-benar tersimpan kosong — kalau `undefined` membuatnya dilewati,
    // gerbang yang sudah dipasang tidak akan pernah bisa dicabut dari sini.
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });

    await POST(post({ extensionMinVersion: "" }));

    expect(updateUnduhanSettingsMock.mock.calls[0][0].extensionMinVersion).toBe("");
  });

  it("rejects a body that is not an object", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });

    expect((await POST(post("bukan objek"))).status).toBe(400);
    expect(updateUnduhanSettingsMock).not.toHaveBeenCalled();
  });
});
