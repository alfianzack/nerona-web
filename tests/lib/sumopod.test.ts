import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPayment,
  parsePaymentEvent,
  SIGNATURE_TOLERANCE_MS,
  sumopodConfig,
  verifyWebhookSignature,
} from "@/lib/payments/sumopod";

const SECRET = `whsec_${Buffer.from("rahasia-uji-yang-cukup-panjang").toString("base64")}`;
const BODY = JSON.stringify({
  event_type: "payment.completed",
  data: { payment_id: "uuid-1", order_id: "abc-1", amount: 29000, status: "completed" },
});

function tandaTangan(id: string, ts: string, body: string, secret = SECRET): string {
  const kunci = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return createHmac("sha256", kunci).update(`${id}.${ts}.${body}`).digest("base64");
}

const NOW = new Date("2026-08-06T12:00:00Z");
const TS = String(Math.floor(NOW.getTime() / 1000));

describe("verifyWebhookSignature", () => {
  it("menerima tanda tangan yang sah", () => {
    const res = verifyWebhookSignature({
      secret: SECRET,
      svixId: "msg_1",
      svixTimestamp: TS,
      svixSignature: `v1,${tandaTangan("msg_1", TS, BODY)}`,
      rawBody: BODY,
      now: NOW,
    });
    expect(res).toEqual({ ok: true });
  });

  // Inti dari seluruh penjagaan ini: badan yang berubah satu karakter pun
  // tidak boleh lolos, karena badan itulah yang menentukan berapa rupiah yang
  // dianggap sudah dibayar.
  it("menolak badan yang diubah satu karakter", () => {
    const sah = tandaTangan("msg_1", TS, BODY);
    const diubah = BODY.replace("29000", "29001");
    const res = verifyWebhookSignature({
      secret: SECRET,
      svixId: "msg_1",
      svixTimestamp: TS,
      svixSignature: `v1,${sah}`,
      rawBody: diubah,
      now: NOW,
    });
    expect(res).toEqual({ ok: false, reason: "mismatch" });
  });

  it("menolak tanda tangan dari rahasia lain", () => {
    const lain = `whsec_${Buffer.from("rahasia-yang-berbeda-sekali").toString("base64")}`;
    const res = verifyWebhookSignature({
      secret: SECRET,
      svixId: "msg_1",
      svixTimestamp: TS,
      svixSignature: `v1,${tandaTangan("msg_1", TS, BODY, lain)}`,
      rawBody: BODY,
      now: NOW,
    });
    expect(res).toEqual({ ok: false, reason: "mismatch" });
  });

  // svix-id ikut ditandatangani, jadi memakai ulang tanda tangan sah untuk
  // pesan lain harus gagal.
  it("menolak tanda tangan yang dipinjam dari pesan lain", () => {
    const res = verifyWebhookSignature({
      secret: SECRET,
      svixId: "msg_2",
      svixTimestamp: TS,
      svixSignature: `v1,${tandaTangan("msg_1", TS, BODY)}`,
      rawBody: BODY,
      now: NOW,
    });
    expect(res).toEqual({ ok: false, reason: "mismatch" });
  });

  it("menerima salah satu dari beberapa tanda tangan saat rahasia dirotasi", () => {
    const lama = `whsec_${Buffer.from("rahasia-lama-sebelum-rotasi").toString("base64")}`;
    const header = [
      `v1,${tandaTangan("msg_1", TS, BODY, lama)}`,
      `v1,${tandaTangan("msg_1", TS, BODY)}`,
    ].join(" ");
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        svixId: "msg_1",
        svixTimestamp: TS,
        svixSignature: header,
        rawBody: BODY,
        now: NOW,
      })
    ).toEqual({ ok: true });
  });

  it("menolak permintaan yang terlalu tua walau tanda tangannya cocok", () => {
    const tua = String(Math.floor((NOW.getTime() - SIGNATURE_TOLERANCE_MS - 1000) / 1000));
    const res = verifyWebhookSignature({
      secret: SECRET,
      svixId: "msg_1",
      svixTimestamp: tua,
      svixSignature: `v1,${tandaTangan("msg_1", tua, BODY)}`,
      rawBody: BODY,
      now: NOW,
    });
    // Tanda tangannya SAH — yang menolaknya jam, bukan HMAC. Tanpa baris ini
    // satu permintaan yang pernah terekam bisa diputar ulang selamanya.
    expect(res).toEqual({ ok: false, reason: "stale" });
  });

  it("menolak timestamp jauh di masa depan", () => {
    const depan = String(Math.floor((NOW.getTime() + SIGNATURE_TOLERANCE_MS + 1000) / 1000));
    const res = verifyWebhookSignature({
      secret: SECRET,
      svixId: "msg_1",
      svixTimestamp: depan,
      svixSignature: `v1,${tandaTangan("msg_1", depan, BODY)}`,
      rawBody: BODY,
      now: NOW,
    });
    expect(res).toEqual({ ok: false, reason: "stale" });
  });

  it("menolak header yang tidak lengkap atau timestamp bukan angka", () => {
    const dasar = {
      secret: SECRET,
      svixId: "msg_1",
      svixTimestamp: TS,
      svixSignature: `v1,${tandaTangan("msg_1", TS, BODY)}`,
      rawBody: BODY,
      now: NOW,
    };
    expect(verifyWebhookSignature({ ...dasar, svixId: null }).ok).toBe(false);
    expect(verifyWebhookSignature({ ...dasar, svixTimestamp: null }).ok).toBe(false);
    expect(verifyWebhookSignature({ ...dasar, svixSignature: null }).ok).toBe(false);
    expect(verifyWebhookSignature({ ...dasar, secret: "" }).ok).toBe(false);
    expect(verifyWebhookSignature({ ...dasar, svixTimestamp: "bukan-angka" })).toEqual({
      ok: false,
      reason: "bad_timestamp",
    });
  });

  // Dashboard Vercel menyimpan nilai apa adanya, sementara berkas .env
  // menyimpannya di antara tanda kutip. Nilai yang ditempel lengkap dengan
  // kutipnya menghasilkan 401 yang tidak bisa dibedakan dari tanda tangan
  // palsu — gejala yang persis sama, sebab yang sama sekali berbeda.
  it("menerima rahasia yang masih terbawa tanda kutip atau spasi", () => {
    const sig = `v1,${tandaTangan("msg_1", TS, BODY)}`;
    for (const varian of [`"${SECRET}"`, `'${SECRET}'`, `  ${SECRET}  `, `"  ${SECRET}  "`]) {
      expect(
        verifyWebhookSignature({
          secret: varian,
          svixId: "msg_1",
          svixTimestamp: TS,
          svixSignature: sig,
          rawBody: BODY,
          now: NOW,
        })
      ).toEqual({ ok: true });
    }
  });

  // Kirim ulang manual dari dashboard adalah SATU-SATUNYA jalan pemulihan yang
  // SumoPod sediakan, dan ia membawa timestamp aslinya. Jendela sempit menolak
  // hampir setiap pemulihan — manusia butuh waktu untuk menyadarinya dulu.
  it("menerima kiriman ulang yang berjam-jam kemudian", () => {
    const duaJamLalu = String(Math.floor((NOW.getTime() - 2 * 60 * 60 * 1000) / 1000));
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        svixId: "msg_1",
        svixTimestamp: duaJamLalu,
        svixSignature: `v1,${tandaTangan("msg_1", duaJamLalu, BODY)}`,
        rawBody: BODY,
        now: NOW,
      })
    ).toEqual({ ok: true });
  });

  it("menolak header tanpa awalan versi", () => {
    // "v1,<sig>" — tanpa koma, tidak ada kandidat yang bisa diambil.
    const res = verifyWebhookSignature({
      secret: SECRET,
      svixId: "msg_1",
      svixTimestamp: TS,
      svixSignature: tandaTangan("msg_1", TS, BODY),
      rawBody: BODY,
      now: NOW,
    });
    expect(res).toEqual({ ok: false, reason: "mismatch" });
  });
});

describe("parsePaymentEvent", () => {
  it("membaca payload completed", () => {
    const ev = parsePaymentEvent(
      JSON.stringify({
        event_type: "payment.completed",
        data: {
          payment_id: "uuid",
          order_id: "INV-2026-001",
          amount: 50000,
          fee: 750,
          net_amount: 49250,
          status: "completed",
          payment_method: "qris",
          completed_at: "2026-06-18T12:00:00Z",
        },
      })
    );
    expect(ev).toMatchObject({
      eventType: "payment.completed",
      paymentId: "uuid",
      reference: "INV-2026-001",
      amount: 50000,
      fee: 750,
      netAmount: 49250,
      status: "completed",
    });
    expect(ev?.completedAt?.toISOString()).toBe("2026-06-18T12:00:00.000Z");
  });

  it("payment.test sah walau tanpa order", () => {
    const ev = parsePaymentEvent(JSON.stringify({ event_type: "payment.test", data: {} }));
    expect(ev?.eventType).toBe("payment.test");
    expect(ev?.reference).toBe("");
  });

  it("menolak yang bukan JSON atau tanpa event_type/data", () => {
    expect(parsePaymentEvent("bukan json")).toBeNull();
    expect(parsePaymentEvent(JSON.stringify({ data: {} }))).toBeNull();
    expect(parsePaymentEvent(JSON.stringify({ event_type: "payment.completed" }))).toBeNull();
    // Event sungguhan tanpa order_id tidak bisa dipetakan ke apa pun.
    expect(
      parsePaymentEvent(JSON.stringify({ event_type: "payment.completed", data: { amount: 1 } }))
    ).toBeNull();
  });
});

describe("sumopodConfig", () => {
  const asli = { ...process.env };
  afterEach(() => {
    process.env = { ...asli };
  });

  it("null kalau belum dikonfigurasi", () => {
    delete process.env.SUMOPOD_PAY_API_BASE;
    delete process.env.SUMOPOD_PAY_API_KEY;
    expect(sumopodConfig()).toBeNull();

    process.env.SUMOPOD_PAY_API_BASE = "https://api-pay-sandbox.sumopod.com";
    expect(sumopodConfig()).toBeNull();
  });

  it("membuang garis miring di ujung base URL", () => {
    process.env.SUMOPOD_PAY_API_BASE = "https://api-pay-sandbox.sumopod.com/";
    process.env.SUMOPOD_PAY_API_KEY = "kunci";
    expect(sumopodConfig()).toEqual({
      baseUrl: "https://api-pay-sandbox.sumopod.com",
      apiKey: "kunci",
    });
  });

  // Bahaya yang sama dengan rahasia webhook: kutip yang ikut tersalin dari
  // berkas .env ke dashboard Vercel. Di sini akibatnya kunci API salah dan
  // gateway membalas 401 — sekali lagi tanpa gejala yang menunjuk sebabnya.
  it("membuang tanda kutip yang ikut tersalin ke dashboard", () => {
    process.env.SUMOPOD_PAY_API_BASE = '"https://api-pay-sandbox.sumopod.com"';
    process.env.SUMOPOD_PAY_API_KEY = '"kunci"';
    expect(sumopodConfig()).toEqual({
      baseUrl: "https://api-pay-sandbox.sumopod.com",
      apiKey: "kunci",
    });
  });
});

describe("createPayment", () => {
  const cfg = { baseUrl: "https://api-pay-sandbox.sumopod.com", apiKey: "kunci" };
  const BALASAN = {
    payment_id: "uuid",
    order_id: "abc-1",
    amount: 29000,
    fee: 503,
    net_amount: 28497,
    payment_link_url: "https://pay.sumopod.com/pay/uuid",
    status: "pending",
    expires_at: "2026-08-07T12:00:00Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("mengirim QRIS dengan referensi kita dan membaca balasannya", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(BALASAN), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await createPayment(cfg, { reference: "abc-1", amount: 29000 });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payment.linkUrl).toBe("https://pay.sumopod.com/pay/uuid");
    expect(res.payment.fee).toBe(503);
    expect(res.payment.expiresAt.toISOString()).toBe("2026-08-07T12:00:00.000Z");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api-pay-sandbox.sumopod.com/api/v1/payments");
    expect(init.headers["X-Api-Key"]).toBe("kunci");
    const dikirim = JSON.parse(init.body);
    expect(dikirim).toMatchObject({
      order_id: "abc-1",
      amount: 29000,
      currency: "IDR",
      // Huruf besar, mengikuti contoh PERMINTAAN di dokumentasi — tempat yang
      // berwenang soal field permintaan. Chip `qris` di daftar Supported
      // Payment Methods dan `"payment_method": "qris"` di webhook bicara soal
      // hal yang berbeda, dan mengikuti keduanya sempat membuat gateway menolak.
      payment_method_type_code: "QRIS",
    });
  });

  it("kode metode bisa ditimpa env tanpa deploy kode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(BALASAN), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.SUMOPOD_PAY_METHOD_CODE = "QRIS_STATIC";

    await createPayment(cfg, { reference: "abc-1", amount: 29000 });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).payment_method_type_code).toBe(
      "QRIS_STATIC"
    );
    delete process.env.SUMOPOD_PAY_METHOD_CODE;
  });

  it("membatasi expires_in_hours ke 24", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(BALASAN), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await createPayment(cfg, { reference: "abc-1", amount: 29000, expiresInHours: 999 });

    // Lebih dari 24 ditolak SumoPod; memotongnya di sini membuat kegagalannya
    // tidak pernah terjadi, bukan sekadar tertangani.
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).expires_in_hours).toBe(24);
  });

  // Balasan 200 yang tidak lengkap lebih berbahaya daripada galat: ia terlihat
  // sukses, dan tanpa tautan tidak ada yang bisa dibayar siapa pun.
  it("menolak balasan 200 yang tidak punya tautan bayar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ...BALASAN, payment_link_url: undefined }), { status: 200 })
      )
    );
    const res = await createPayment(cfg, { reference: "abc-1", amount: 29000 });
    expect(res).toMatchObject({ ok: false, reason: "malformed" });
  });

  it("melaporkan penolakan dan kegagalan jaringan secara terpisah", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("amount too small", { status: 400 }))
    );
    expect(await createPayment(cfg, { reference: "a", amount: 1 })).toMatchObject({
      ok: false,
      reason: "rejected",
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(await createPayment(cfg, { reference: "a", amount: 29000 })).toMatchObject({
      ok: false,
      reason: "network",
    });
  });
});
