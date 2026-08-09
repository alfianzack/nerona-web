import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    plan: { findFirst: vi.fn() },
    orderRequest: { findFirst: vi.fn() },
    payment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/orders", () => ({ fulfillOrderRequest: vi.fn() }));
vi.mock("@/lib/payments/sumopod", async (importAsli) => {
  const asli = await importAsli<typeof import("@/lib/payments/sumopod")>();
  return { ...asli, createPayment: vi.fn(), sumopodConfig: vi.fn() };
});

import {
  amountForOrder,
  gatewayEnabled,
  handlePaymentEvent,
  startPaymentForOrder,
} from "@/lib/payments/orders";
import { prisma } from "@/lib/prisma";
import { fulfillOrderRequest } from "@/lib/orders";
import { createPayment, sumopodConfig, type PaymentEvent } from "@/lib/payments/sumopod";

const CFG = { baseUrl: "https://api-pay-sandbox.sumopod.com", apiKey: "kunci" };

function event(over: Partial<PaymentEvent> = {}): PaymentEvent {
  return {
    eventType: "payment.completed",
    paymentId: "uuid",
    reference: "ord1-1",
    amount: 29000,
    fee: 503,
    netAmount: 28497,
    status: "completed",
    completedAt: new Date("2026-08-06T12:00:00Z"),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (sumopodConfig as any).mockReturnValue(CFG);
  (prisma.setting.findUnique as any).mockResolvedValue({ value: "1" });
  (prisma.setting.findMany as any).mockResolvedValue([]);
});

describe("gatewayEnabled", () => {
  it("mati kalau kuncinya belum ada — fitur bayar tidak boleh menyala sendiri", async () => {
    (prisma.setting.findUnique as any).mockResolvedValue(null);
    expect(await gatewayEnabled()).toBe(false);
  });

  it("menerima 1, true, on", async () => {
    for (const nilai of ["1", "true", "ON"]) {
      (prisma.setting.findUnique as any).mockResolvedValue({ value: nilai });
      expect(await gatewayEnabled()).toBe(true);
    }
    (prisma.setting.findUnique as any).mockResolvedValue({ value: "0" });
    expect(await gatewayEnabled()).toBe(false);
  });
});

describe("amountForOrder", () => {
  it("top-up memakai harga yang dibekukan saat order dibuat", async () => {
    const amount = await amountForOrder({
      product: "points",
      planName: "1.000 poin",
      durationMonths: 1,
      priceAmount: 45000,
    });
    expect(amount).toBe(45000);
    expect(prisma.plan.findFirst).not.toHaveBeenCalled();
  });

  /**
   * Pembelian baru berharga TETAP — tidak dikalikan apa pun. Sejak alur sekali
   * bayar, yang dijual adalah akses selamanya, dan `durationMonths` cuma
   * menentukan kelipatan poin.
   *
   * Kalau harga di sini ikut dikalikan lagi, pembeli membayar 79.000 × 12 untuk
   * sesuatu yang dijanjikan 79.000.
   */
  it("pembelian baru memakai harga apa adanya, tanpa dikalikan durasi", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue({ priceMonthly: 79000 });
    expect(
      await amountForOrder({
        product: "metadata",
        planName: "Pro",
        durationMonths: 1,
        priceAmount: null,
      })
    ).toBe(79000);
  });

  /**
   * Perpanjangan dari alur LAMA tetap dihitung per durasi. Baris yang dibuat
   * dengan janji "3 bulan seharga sekian" harus ditagih sebesar itu, bukan
   * sebesar harga sekali bayar hari ini.
   */
  it("perpanjangan lama tetap dihitung dari durasi dan diskonnya", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue({ priceMonthly: 29000 });
    (prisma.setting.findMany as any).mockResolvedValue([
      { key: "duration_discount_3", value: "10" },
    ]);
    // 29000 * 3 = 87000, diskon 10% = 78300, dibulatkan ke ribuan = 78000
    expect(
      await amountForOrder({
        product: "metadata",
        planName: "Pro",
        durationMonths: 3,
        priceAmount: null,
        isRenewal: true,
      })
    ).toBe(78000);
  });

  it("null untuk paket tanpa harga, paket gratis, dan produk di luar lingkup", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue({ priceMonthly: null });
    expect(
      await amountForOrder({ product: "metadata", planName: "Business", durationMonths: 1, priceAmount: null })
    ).toBeNull();

    (prisma.plan.findFirst as any).mockResolvedValue({ priceMonthly: 0 });
    expect(
      await amountForOrder({ product: "metadata", planName: "Free", durationMonths: 1, priceAmount: null })
    ).toBeNull();

    expect(
      await amountForOrder({ product: "agent", planName: "pro", durationMonths: 1, priceAmount: null })
    ).toBeNull();

    expect(
      await amountForOrder({ product: "points", planName: "x", durationMonths: 1, priceAmount: 0 })
    ).toBeNull();
  });
});

describe("startPaymentForOrder", () => {
  const order = {
    id: "ord1",
    product: "points",
    planName: "1.000 poin",
    durationMonths: 1,
    priceAmount: 45000,
    status: "pending",
  };

  it("menolak saat saklar mati, sebelum menyentuh order apa pun", async () => {
    (prisma.setting.findUnique as any).mockResolvedValue({ value: "0" });
    expect(await startPaymentForOrder("u1", "ord1")).toEqual({ ok: false, reason: "disabled" });
    expect(prisma.orderRequest.findFirst).not.toHaveBeenCalled();
  });

  it("order milik orang lain tampak seperti order yang tidak ada", async () => {
    (prisma.orderRequest.findFirst as any).mockResolvedValue(null);
    expect(await startPaymentForOrder("u1", "ord1")).toEqual({
      ok: false,
      reason: "order_not_found",
    });
    // userId ikut jadi syarat pencarian, bukan diperiksa sesudahnya.
    expect((prisma.orderRequest.findFirst as any).mock.calls[0][0].where).toMatchObject({
      id: "ord1",
      userId: "u1",
    });
  });

  it("menolak order yang sudah dipenuhi atau dibatalkan", async () => {
    (prisma.orderRequest.findFirst as any).mockResolvedValue({ ...order, status: "fulfilled" });
    expect(await startPaymentForOrder("u1", "ord1")).toEqual({ ok: false, reason: "not_pending" });
  });

  // Klik kedua tidak boleh meninggalkan dua tagihan terbuka untuk satu order:
  // kalau dua-duanya sempat dibayar, hanya satu yang bisa memenuhi ordernya.
  it("memakai ulang tautan yang masih hidup", async () => {
    (prisma.orderRequest.findFirst as any).mockResolvedValue(order);
    const besok = new Date(Date.now() + 3600_000);
    (prisma.payment.findFirst as any).mockResolvedValue({
      linkUrl: "https://pay.sumopod.com/pay/lama",
      expiresAt: besok,
    });

    const res = await startPaymentForOrder("u1", "ord1");

    expect(res).toEqual({ ok: true, linkUrl: "https://pay.sumopod.com/pay/lama", expiresAt: besok, reused: true });
    expect(createPayment).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("membuat barisnya SEBELUM memanggil gateway, dengan referensi berurutan", async () => {
    (prisma.orderRequest.findFirst as any).mockResolvedValue(order);
    (prisma.payment.findFirst as any).mockResolvedValue(null);
    (prisma.payment.count as any).mockResolvedValue(2); // sudah ada dua upaya
    (prisma.payment.create as any).mockResolvedValue({ id: "pay3" });
    (createPayment as any).mockResolvedValue({
      ok: true,
      payment: {
        paymentId: "uuid",
        linkUrl: "https://pay.sumopod.com/pay/uuid",
        amount: 45000,
        fee: 615,
        netAmount: 44385,
        status: "pending",
        expiresAt: new Date("2026-08-07T12:00:00Z"),
      },
    });

    const res = await startPaymentForOrder("u1", "ord1");

    expect(res.ok).toBe(true);
    const dibuat = (prisma.payment.create as any).mock.calls[0][0].data;
    expect(dibuat).toMatchObject({ orderId: "ord1", reference: "ord1-3", amount: 45000, linkUrl: "" });
    // Barisnya ada sebelum gateway dipanggil — webhook mencari lewat reference,
    // dan urutan sebaliknya membuka celah pembayaran yang tiba lebih dulu.
    const urutanCreate = (prisma.payment.create as any).mock.invocationCallOrder[0];
    const urutanGateway = (createPayment as any).mock.invocationCallOrder[0];
    expect(urutanCreate).toBeLessThan(urutanGateway);
  });

  it("menandai barisnya gagal saat gateway menolak", async () => {
    (prisma.orderRequest.findFirst as any).mockResolvedValue(order);
    (prisma.payment.findFirst as any).mockResolvedValue(null);
    (prisma.payment.count as any).mockResolvedValue(0);
    (prisma.payment.create as any).mockResolvedValue({ id: "pay1" });
    (createPayment as any).mockResolvedValue({ ok: false, reason: "rejected", detail: "400" });

    expect(await startPaymentForOrder("u1", "ord1")).toMatchObject({
      ok: false,
      reason: "gateway_error",
    });
    const data = (prisma.payment.update as any).mock.calls[0][0].data;
    expect(data.status).toBe("failed");
    // Sebabnya disimpan, bukan cuma dicatat ke log: pelanggan hanya melihat 502,
    // dan tanpa baris ini admin harus memburu log Vercel untuk tahu apa-apa.
    expect(data.lastError).toContain("rejected");
    expect(data.lastError).toContain("400");
  });

  it("menolak order yang tidak punya harga tanpa membuat baris apa pun", async () => {
    (prisma.orderRequest.findFirst as any).mockResolvedValue({
      ...order,
      product: "metadata",
      priceAmount: null,
    });
    (prisma.payment.findFirst as any).mockResolvedValue(null);
    (prisma.plan.findFirst as any).mockResolvedValue({ priceMonthly: null });

    expect(await startPaymentForOrder("u1", "ord1")).toEqual({ ok: false, reason: "no_price" });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});

describe("handlePaymentEvent", () => {
  const payment = { id: "pay1", orderId: "ord1", amount: 29000, status: "pending", fee: null, netAmount: null, providerPaymentId: null };

  it("payment.test dibalas tanpa menyentuh apa pun", async () => {
    expect(await handlePaymentEvent(event({ eventType: "payment.test", reference: "" }))).toEqual({
      ok: true,
      note: "test",
    });
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });

  it("referensi asing ditolak", async () => {
    (prisma.payment.findUnique as any).mockResolvedValue(null);
    expect(await handlePaymentEvent(event())).toEqual({ ok: false, reason: "unknown_reference" });
    expect(fulfillOrderRequest).not.toHaveBeenCalled();
  });

  // Penjaga terhadap kesalahan pemetaan di sisi kita, bukan terhadap pemalsuan:
  // paket mahal tidak boleh aktif atas pembayaran murah.
  it("jumlah yang tidak cocok ditolak dan tidak memenuhi apa pun", async () => {
    (prisma.payment.findUnique as any).mockResolvedValue(payment);
    expect(await handlePaymentEvent(event({ amount: 1000 }))).toMatchObject({
      ok: false,
      reason: "amount_mismatch",
    });
    expect(fulfillOrderRequest).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("memenuhi order dengan aktor null, lalu menandai lunas", async () => {
    (prisma.payment.findUnique as any).mockResolvedValue(payment);
    (fulfillOrderRequest as any).mockResolvedValue({ ok: true });

    expect(await handlePaymentEvent(event())).toEqual({ ok: true, note: "fulfilled" });

    // null = tidak ada manusia yang melakukannya. Memakai id pelanggan sebagai
    // aktor akan menulis jejak audit yang berbohong.
    expect(fulfillOrderRequest).toHaveBeenCalledWith(null, "ord1");
    const urutanFulfil = (fulfillOrderRequest as any).mock.invocationCallOrder[0];
    const urutanUpdate = (prisma.payment.update as any).mock.invocationCallOrder[0];
    // Penuhi dulu, tandai lunas sesudahnya.
    expect(urutanFulfil).toBeLessThan(urutanUpdate);
    expect((prisma.payment.update as any).mock.calls[0][0].data).toMatchObject({
      status: "completed",
      fee: 503,
      netAmount: 28497,
    });
  });

  it("webhook kedua tidak memenuhi ulang dan tetap dianggap berhasil", async () => {
    (prisma.payment.findUnique as any).mockResolvedValue({ ...payment, status: "completed" });
    expect(await handlePaymentEvent(event())).toEqual({ ok: true, note: "already" });
    expect(fulfillOrderRequest).not.toHaveBeenCalled();
  });

  it("order yang sudah dipenuhi admin tetap menandai pembayarannya lunas", async () => {
    (prisma.payment.findUnique as any).mockResolvedValue(payment);
    (fulfillOrderRequest as any).mockResolvedValue({ ok: false, reason: "not_pending" });

    expect(await handlePaymentEvent(event())).toEqual({ ok: true, note: "already" });
    expect(prisma.payment.update).toHaveBeenCalled();
  });

  it("kegagalan pemenuhan sungguhan TIDAK menandai lunas", async () => {
    (prisma.payment.findUnique as any).mockResolvedValue(payment);
    (fulfillOrderRequest as any).mockResolvedValue({ ok: false, reason: "plan_not_found" });

    expect(await handlePaymentEvent(event())).toMatchObject({ ok: false, reason: "fulfil_failed" });
    // Tidak ditandai lunas: kalau ditandai, kiriman ulang berikutnya akan diam
    // saja dan pelanggan membayar tanpa pernah dapat paketnya.
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("expired dan failed hanya menyentuh baris yang masih menggantung", async () => {
    (prisma.payment.findUnique as any).mockResolvedValue(payment);

    expect(await handlePaymentEvent(event({ eventType: "payment.expired" }))).toEqual({
      ok: true,
      note: "recorded",
    });
    const call = (prisma.payment.updateMany as any).mock.calls[0][0];
    expect(call.where).toMatchObject({ id: "pay1", status: "pending" });
    expect(call.data).toMatchObject({ status: "expired" });
    expect(fulfillOrderRequest).not.toHaveBeenCalled();
  });
});
