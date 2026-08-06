import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const gatewayEnabledMock = vi.fn();
const setGatewayEnabledMock = vi.fn();
const sumopodConfigMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => getServerSessionMock(...a),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
const webhookTerakhirOkMock = vi.fn();
vi.mock("@/lib/payments/orders", () => ({
  gatewayEnabled: () => gatewayEnabledMock(),
  setGatewayEnabled: (...a: unknown[]) => setGatewayEnabledMock(...a),
  webhookTerakhirOk: () => webhookTerakhirOkMock(),
}));
vi.mock("@/lib/payments/sumopod", () => ({ sumopodConfig: () => sumopodConfigMock() }));

import { GET, POST } from "@/app/api/admin/payment-gateway/route";

function post(body: unknown) {
  return new Request("http://t/api/admin/payment-gateway", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  gatewayEnabledMock.mockResolvedValue(false);
  sumopodConfigMock.mockReturnValue(null);
  webhookTerakhirOkMock.mockResolvedValue(null);
});

describe("/api/admin/payment-gateway", () => {
  it("menolak yang bukan admin", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });
    expect((await GET()).status).toBe(401);
    expect((await POST(post({ enabled: true }))).status).toBe(401);
    expect(setGatewayEnabledMock).not.toHaveBeenCalled();
  });

  // Membedakan "saklarnya mati" dari "kuncinya belum ada": tanpa ini,
  // satu-satunya gejala kunci yang belum dipasang adalah tombol QRIS yang tidak
  // muncul, tanpa sebab yang terlihat.
  it("melaporkan configured false saat kunci belum dipasang", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    const body = await (await GET()).json();
    expect(body).toMatchObject({ ok: true, enabled: false, configured: false, sandbox: false });
  });

  it("menandai mode sandbox dari base URL, tanpa membocorkan nilainya", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    sumopodConfigMock.mockReturnValue({
      baseUrl: "https://api-pay-sandbox.sumopod.com",
      apiKey: "rahasia",
    });
    gatewayEnabledMock.mockResolvedValue(true);

    const body = await (await GET()).json();

    expect(body).toMatchObject({ enabled: true, configured: true, sandbox: true });
    // Kunci dan alamat tidak pernah ikut dikirim ke klien.
    expect(JSON.stringify(body)).not.toContain("rahasia");
    expect(JSON.stringify(body)).not.toContain("sumopod.com");
  });

  // Keadaan yang paling mahal kalau tidak terlihat: QRIS menyala sementara
  // webhook belum pernah lolos sekali pun berarti pelanggan bisa membayar
  // tanpa paketnya pernah aktif.
  it("melaporkan kapan webhook terakhir lolos verifikasi", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });

    expect((await (await GET()).json()).webhookLastOk).toBeNull();

    webhookTerakhirOkMock.mockResolvedValue("2026-08-06T09:13:21.000Z");
    expect((await (await GET()).json()).webhookLastOk).toBe("2026-08-06T09:13:21.000Z");
  });

  it("live saat base URL bukan sandbox", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    sumopodConfigMock.mockReturnValue({ baseUrl: "https://api-pay.sumopod.com", apiKey: "k" });
    expect((await (await GET()).json()).sandbox).toBe(false);
  });

  it("menyimpan saklar dan menolak badan yang bukan boolean", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });

    expect((await POST(post({ enabled: true }))).status).toBe(200);
    expect(setGatewayEnabledMock).toHaveBeenCalledWith(true);

    // "1" atau "on" dari klien yang salah tulis tidak boleh diam-diam
    // diperlakukan sebagai true — ini saklar yang menagih uang.
    expect((await POST(post({ enabled: "1" }))).status).toBe(400);
    expect((await POST(post({}))).status).toBe(400);
    expect(setGatewayEnabledMock).toHaveBeenCalledTimes(1);
  });
});
