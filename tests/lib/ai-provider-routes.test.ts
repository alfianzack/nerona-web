import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const listMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const setDefaultMock = vi.fn();
const getByIdMock = vi.fn();
const testConnectionMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/ai-providers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai-providers")>("@/lib/ai-providers");
  return {
    ...actual,
    listProvidersForAdmin: (...a: unknown[]) => listMock(...(a as [])),
    createProvider: (...a: unknown[]) => createMock(...(a as [])),
    updateProvider: (...a: unknown[]) => updateMock(...(a as [])),
    deleteProvider: (...a: unknown[]) => deleteMock(...(a as [])),
    setDefaultProvider: (...a: unknown[]) => setDefaultMock(...(a as [])),
    getProviderById: (...a: unknown[]) => getByIdMock(...(a as [])),
  };
});
vi.mock("@/lib/ai-connection-test", () => ({
  testAiConnection: (...a: unknown[]) => testConnectionMock(...(a as [])),
}));

import { GET, POST } from "@/app/api/admin/ai-providers/route";
import { DELETE, PATCH } from "@/app/api/admin/ai-providers/[id]/route";
import { POST as TEST } from "@/app/api/admin/ai-providers/[id]/test/route";
import { AiProviderError } from "@/lib/ai-providers";

const ctx = { params: { id: "p1" } };

function req(payload: unknown, method = "POST"): Request {
  return new Request("http://localhost/api/admin/ai-providers", {
    method,
    body: JSON.stringify(payload),
  });
}

const VALID = { label: "SumoPod", baseUrl: "https://a.example/v1" };

beforeEach(() => {
  vi.clearAllMocks();
  getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "owner_admin" } });
  listMock.mockResolvedValue([]);
  createMock.mockResolvedValue({ id: "p1" });
  updateMock.mockResolvedValue({ id: "p1" });
  getByIdMock.mockResolvedValue({ id: "p1", baseUrl: "https://a.example/v1", apiKey: "kunci" });
  testConnectionMock.mockResolvedValue({ ok: true });
});

describe("gerbang owner", () => {
  it("menolak sesi tanpa role dengan 401", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });
    expect((await GET()).status).toBe(401);
    expect((await POST(req(VALID))).status).toBe(401);
  });

  it("menolak admin support dengan 403 — ia masuk, hanya tidak berwenang", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });
    expect((await GET()).status).toBe(403);
    expect((await POST(req(VALID))).status).toBe(403);
    expect((await PATCH(req(VALID, "PATCH"), ctx)).status).toBe(403);
    expect((await DELETE(req({}, "DELETE"), ctx)).status).toBe(403);
    expect((await TEST(req({ model: "m" }), ctx)).status).toBe(403);
    expect(createMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("meloloskan owner", async () => {
    expect((await GET()).status).toBe(200);
  });
});

describe("POST", () => {
  it("meneruskan kunci ke lapisan bawah saat dikirim", async () => {
    await POST(req({ ...VALID, apiKey: "kunci-baru" }));
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "kunci-baru" }));
  });

  it("tidak mengirim kunci sama sekali saat kolomnya kosong — kosong = biarkan", async () => {
    await POST(req({ ...VALID, apiKey: "" }));
    expect(createMock.mock.calls[0][0]).not.toHaveProperty("apiKey");
  });
});

describe("PATCH", () => {
  it("menjadikan bawaan sebagai aksi tersendiri, bukan kolom formulir", async () => {
    await PATCH(req({ isDefault: true }, "PATCH"), ctx);
    expect(setDefaultMock).toHaveBeenCalledWith("p1");
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("DELETE", () => {
  it("menerjemahkan penolakan 'masih dipakai' jadi 409 dengan pesan yang bisa ditindaklanjuti", async () => {
    deleteMock.mockRejectedValue(new AiProviderError("in_use"));
    const res = await DELETE(req({}, "DELETE"), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toContain("masih dipakai");
  });
});

describe("POST test", () => {
  it("menguji kunci tersimpan provider itu terhadap model id yang diketik", async () => {
    await TEST(req({ model: "claude-opus-5" }), ctx);
    expect(testConnectionMock).toHaveBeenCalledWith({
      apiKey: "kunci",
      baseUrl: "https://a.example/v1",
      model: "claude-opus-5",
    });
  });

  it("menolak permintaan tanpa model id — provider tidak bisa diuji sendirian", async () => {
    const res = await TEST(req({ model: "" }), ctx);
    expect(res.status).toBe(400);
    expect(testConnectionMock).not.toHaveBeenCalled();
  });
});
