import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/device-pairing", () => ({
  startPairing: vi.fn(),
  approvePairing: vi.fn(),
  claimPairing: vi.fn(),
  formatCode: (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`,
  PAIRING_TTL_MS: 600000,
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { POST as START } from "@/app/api/extension/pair/start/route";
import { GET as POLL } from "@/app/api/extension/pair/poll/route";
import { POST as APPROVE } from "@/app/api/extension/pair/approve/route";
import { startPairing, approvePairing, claimPairing } from "@/lib/device-pairing";
import { getServerSession } from "next-auth";

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
function get(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

// IP diacak per tes supaya pembatas laju di dalam proses tidak bocor antar tes.
let ipCounter = 0;
const freshIp = () => ({ "x-forwarded-for": `10.0.0.${++ipCounter}` });

beforeEach(() => vi.clearAllMocks());

describe("POST /api/extension/pair/start", () => {
  it("mengembalikan kode terformat, deviceSecret, dan approveUrl", async () => {
    (startPairing as any).mockResolvedValue({
      code: "4KQ97ZTM", deviceSecret: "nrd_x", expiresAt: new Date(Date.now() + 600000),
    });
    const res = await START(post("http://t/api/extension/pair/start",
      { kind: "hub", label: "Nerona Hub · PC" }, freshIp()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe("4KQ9-7ZTM");
    expect(body.deviceSecret).toBe("nrd_x");
    expect(body.approveUrl).toContain("/hubungkan?kode=4KQ9-7ZTM");
    expect(body.expiresInSec).toBeGreaterThan(500);
  });

  it("menolak kind yang tidak dikenal", async () => {
    const res = await START(post("http://t/api/extension/pair/start",
      { kind: "aneh", label: "x" }, freshIp()));
    expect(res.status).toBe(400);
    expect(startPairing).not.toHaveBeenCalled();
  });

  // Batasnya sengaja jauh di atas `accountAction` (5): skrip QA Hub di
  // nerona-hub/docs/pemasangan.md saja menuntut sembilan kali mulai, dan
  // pembatas lama mengunci pengujinya di tengah jalan selama sepuluh menit.
  it("429 setelah melewati batas laju, tapi tidak sebelum 20 kali", async () => {
    (startPairing as any).mockResolvedValue({
      code: "4KQ97ZTM", deviceSecret: "nrd_x", expiresAt: new Date(Date.now() + 600000),
    });
    const ip = freshIp();
    const kirim = () => START(post("http://t/api/extension/pair/start", { kind: "hub", label: "x" }, ip));
    for (let i = 0; i < 20; i++) expect((await kirim()).status).toBe(200);
    expect((await kirim()).status).toBe(429);
  });
});

describe("GET /api/extension/pair/poll", () => {
  it("401 tanpa bearer", async () => {
    expect((await POLL(get("http://t/api/extension/pair/poll"))).status).toBe(401);
  });
  it("404 untuk deviceSecret asing", async () => {
    (claimPairing as any).mockResolvedValue({ status: "not_found" });
    const res = await POLL(get("http://t/api/extension/pair/poll", { authorization: "Bearer nrd_asing" }));
    expect(res.status).toBe(404);
  });
  it("meneruskan token saat disetujui", async () => {
    (claimPairing as any).mockResolvedValue({ status: "approved", token: "nrx_abc" });
    const res = await POLL(get("http://t/api/extension/pair/poll", { authorization: "Bearer nrd_x" }));
    expect(await res.json()).toEqual({ ok: true, status: "approved", token: "nrx_abc" });
  });
  it("meneruskan pending tanpa token", async () => {
    (claimPairing as any).mockResolvedValue({ status: "pending" });
    expect(await (await POLL(get("http://t/api/extension/pair/poll",
      { authorization: "Bearer nrd_x" }))).json()).toEqual({ ok: true, status: "pending" });
  });
});

describe("POST /api/extension/pair/approve", () => {
  it("401 tanpa sesi", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await APPROVE(post("http://t/api/extension/pair/approve",
      { code: "4KQ9-7ZTM", setuju: true }, freshIp()));
    expect(res.status).toBe(401);
    expect(approvePairing).not.toHaveBeenCalled();
  });
  it("meneruskan userId sesi, bukan dari body", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1" } });
    (approvePairing as any).mockResolvedValue({ ok: true });
    const res = await APPROVE(post("http://t/api/extension/pair/approve",
      { code: "4KQ9-7ZTM", setuju: true, userId: "u-penyerang" }, freshIp()));
    expect(res.status).toBe(200);
    expect(approvePairing).toHaveBeenCalledWith({ userId: "u1", code: "4KQ9-7ZTM", setuju: true });
  });
  // Tanpa `reason`, halaman persetujuan jatuh ke kalimat generiknya —
  // "Gagal memproses kode. Coba lagi." — padahal setiap percobaan ulang
  // dijamin gagal selama jendela batas lajunya masih berjalan.
  it("429 menyertakan reason yang bisa dipetakan halaman persetujuan", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u-batas" } });
    (approvePairing as any).mockResolvedValue({ ok: true });
    const kirim = () => APPROVE(post("http://t/api/extension/pair/approve",
      { code: "4KQ9-7ZTM", setuju: true }, freshIp()));
    for (let i = 0; i < 5; i++) expect((await kirim()).status).toBe(200);
    const res = await kirim();
    expect(res.status).toBe(429);
    expect((await res.json()).reason).toBe("too_many");
  });

  it("410 untuk kode kadaluarsa", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1" } });
    (approvePairing as any).mockResolvedValue({ ok: false, reason: "expired" });
    const res = await APPROVE(post("http://t/api/extension/pair/approve",
      { code: "4KQ9-7ZTM", setuju: true }, freshIp()));
    expect(res.status).toBe(410);
    expect((await res.json()).reason).toBe("expired");
  });
});
