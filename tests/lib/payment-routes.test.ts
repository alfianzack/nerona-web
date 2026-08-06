import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const startPaymentForOrderMock = vi.fn();
const handlePaymentEventMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/base-url", () => ({ baseUrl: () => "https://nerona-web.vercel.app" }));
const catatWebhookMock = vi.fn();
vi.mock("@/lib/payments/orders", () => ({
  startPaymentForOrder: (...a: unknown[]) => startPaymentForOrderMock(...a),
  handlePaymentEvent: (...a: unknown[]) => handlePaymentEventMock(...a),
  catatWebhookTerverifikasi: (...a: unknown[]) => catatWebhookMock(...a),
}));

import { POST as CREATE } from "@/app/api/payments/create/route";
import { POST as WEBHOOK } from "@/app/api/webhooks/sumopod/route";

const SECRET = `whsec_${Buffer.from("rahasia-webhook-untuk-tes").toString("base64")}`;

let ipCounter = 0;
const freshIp = () => ({ "x-forwarded-for": `10.1.0.${++ipCounter}` });

function postCreate(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://t/api/payments/create", {
    method: "POST",
    headers: { "content-type": "application/json", ...freshIp(), ...headers },
    body: JSON.stringify(body),
  });
}

function postWebhook(rawBody: string, over: Record<string, string> = {}) {
  const id = "msg_1";
  const ts = String(Math.floor(Date.now() / 1000));
  const kunci = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
  const sig = createHmac("sha256", kunci).update(`${id}.${ts}.${rawBody}`).digest("base64");
  return new Request("http://t/api/webhooks/sumopod", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": ts,
      "svix-signature": `v1,${sig}`,
      ...over,
    },
    body: rawBody,
  });
}

const EVENT = JSON.stringify({
  event_type: "payment.completed",
  data: { payment_id: "uuid", order_id: "ord1-1", amount: 29000, status: "completed" },
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUMOPOD_PAY_WEBHOOK_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.SUMOPOD_PAY_WEBHOOK_SECRET;
});

describe("POST /api/payments/create", () => {
  it("401 tanpa sesi, tanpa menyentuh gateway", async () => {
    getServerSessionMock.mockResolvedValue(null);
    expect((await CREATE(postCreate({ orderId: "ord1" }))).status).toBe(401);
    expect(startPaymentForOrderMock).not.toHaveBeenCalled();
  });

  it("meneruskan userId sesi dan URL kembali", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1" } });
    startPaymentForOrderMock.mockResolvedValue({
      ok: true,
      linkUrl: "https://pay.sumopod.com/pay/uuid",
      expiresAt: new Date("2026-08-07T12:00:00Z"),
      reused: false,
    });

    const res = await CREATE(postCreate({ orderId: "ord1" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      linkUrl: "https://pay.sumopod.com/pay/uuid",
      reused: false,
    });
    expect(startPaymentForOrderMock).toHaveBeenCalledWith("u1", "ord1", {
      successUrl: "https://nerona-web.vercel.app/order/ord1",
      cancelUrl: "https://nerona-web.vercel.app/order/ord1",
    });
  });

  it("memetakan setiap alasan ke status yang berbeda", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1" } });
    const pasangan: [string, number][] = [
      ["disabled", 503],
      ["not_configured", 503],
      ["order_not_found", 404],
      ["not_pending", 409],
      ["no_price", 400],
      ["gateway_error", 502],
    ];
    for (const [reason, status] of pasangan) {
      startPaymentForOrderMock.mockResolvedValue({ ok: false, reason });
      const res = await CREATE(postCreate({ orderId: "ord1" }));
      expect([reason, res.status]).toEqual([reason, status]);
    }
  });

  it("429 setelah melewati batas laju", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1" } });
    startPaymentForOrderMock.mockResolvedValue({
      ok: true,
      linkUrl: "x",
      expiresAt: new Date(),
      reused: false,
    });
    const ip = freshIp();
    const kirim = () =>
      CREATE(
        new Request("http://t/api/payments/create", {
          method: "POST",
          headers: { "content-type": "application/json", ...ip },
          body: JSON.stringify({ orderId: "ord1" }),
        })
      );
    for (let i = 0; i < 5; i++) expect((await kirim()).status).toBe(200);
    // Tiap permintaan yang lolos membuat satu tagihan di sistem pihak ketiga.
    expect((await kirim()).status).toBe(429);
  });
});

describe("POST /api/webhooks/sumopod", () => {
  it("memproses event yang tanda tangannya sah", async () => {
    handlePaymentEventMock.mockResolvedValue({ ok: true, note: "fulfilled" });
    const res = await WEBHOOK(postWebhook(EVENT));
    expect(res.status).toBe(200);
    expect(handlePaymentEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "ord1-1", amount: 29000 })
    );
  });

  it("401 untuk tanda tangan salah, dan pemrosesan tidak pernah dipanggil", async () => {
    const res = await WEBHOOK(postWebhook(EVENT, { "svix-signature": "v1,bukantandatangan" }));
    expect(res.status).toBe(401);
    expect(handlePaymentEventMock).not.toHaveBeenCalled();
    // Yang ditolak tidak boleh tercatat sebagai bukti jalur webhook bekerja —
    // panel admin memakai catatan itu untuk memutuskan QRIS boleh dinyalakan.
    expect(catatWebhookMock).not.toHaveBeenCalled();
  });

  // Dicatat walau isinya nanti gagal diproses: yang dibuktikan catatan ini
  // adalah "SumoPod bisa mencapai kita dengan rahasia yang benar", bukan
  // "event terakhir berhasil dipenuhi".
  it("mencatat verifikasi yang lolos, termasuk saat pemrosesan gagal", async () => {
    handlePaymentEventMock.mockResolvedValue({ ok: false, reason: "unknown_reference" });
    expect((await WEBHOOK(postWebhook(EVENT))).status).toBe(404);
    expect(catatWebhookMock).toHaveBeenCalled();
  });

  // Badan mentah yang dipakai untuk HMAC harus badan yang SAMA dengan yang
  // di-parse. Kalau rute mem-parse lalu men-stringify ulang, permintaan sah ini
  // akan gagal — inilah tes yang menangkapnya.
  it("menerima badan dengan spasi tidak lazim", async () => {
    handlePaymentEventMock.mockResolvedValue({ ok: true, note: "fulfilled" });
    const renggang = `{ "event_type" : "payment.completed" ,\n  "data" : { "payment_id":"uuid", "order_id" : "ord1-1", "amount": 29000 } }`;
    const res = await WEBHOOK(postWebhook(renggang));
    expect(res.status).toBe(200);
  });

  it("401 kalau rahasianya belum diatur", async () => {
    delete process.env.SUMOPOD_PAY_WEBHOOK_SECRET;
    expect((await WEBHOOK(postWebhook(EVENT))).status).toBe(401);
  });

  it("400 untuk payload yang bentuknya tidak dikenali", async () => {
    const res = await WEBHOOK(postWebhook(JSON.stringify({ hai: "dunia" })));
    expect(res.status).toBe(400);
    expect(handlePaymentEventMock).not.toHaveBeenCalled();
  });

  // Bukan 2xx: SumoPod menandainya gagal dan menyediakan kirim ulang manual.
  // Membalas 200 atas sesuatu yang tidak terproses menutup satu-satunya jalan
  // pemulihan yang kita punya.
  it("membalas non-2xx saat event tidak bisa diproses", async () => {
    handlePaymentEventMock.mockResolvedValue({ ok: false, reason: "unknown_reference" });
    expect((await WEBHOOK(postWebhook(EVENT))).status).toBe(404);

    handlePaymentEventMock.mockResolvedValue({ ok: false, reason: "amount_mismatch" });
    expect((await WEBHOOK(postWebhook(EVENT))).status).toBe(409);

    handlePaymentEventMock.mockResolvedValue({ ok: false, reason: "fulfil_failed" });
    expect((await WEBHOOK(postWebhook(EVENT))).status).toBe(500);
  });
});
