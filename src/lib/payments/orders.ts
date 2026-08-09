import { prisma } from "@/lib/prisma";
import { fulfillOrderRequest } from "@/lib/orders";
import { coerceDuration, getDurationDiscounts, priceForDuration } from "@/lib/plan-duration";
import {
  createPayment,
  sumopodConfig,
  tampakMuatanQris,
  type PaymentEvent,
} from "@/lib/payments/sumopod";

/**
 * Menjembatani order Nerona dengan gateway. Berkas ini yang tahu soal harga,
 * order, dan pemenuhan; `sumopod.ts` tidak tahu apa-apa soal itu.
 */

export const GATEWAY_SETTING_KEY = "payment_gateway_enabled";

/**
 * Kapan terakhir kali sebuah webhook LOLOS verifikasi tanda tangan.
 *
 * Bukan hiasan: menyalakan QRIS sementara webhook masih ditolak berarti
 * pelanggan membayar sungguhan dan paketnya tidak pernah aktif — karena yang
 * mengaktifkannya adalah webhook. Sebelum ini tidak ada apa pun di sisi kita
 * yang bisa menjawab "apakah jalur itu pernah bekerja sekali pun".
 */
export const WEBHOOK_LAST_OK_KEY = "payment_webhook_last_ok";

export async function catatWebhookTerverifikasi(waktu: Date = new Date()): Promise<void> {
  const value = waktu.toISOString();
  await prisma.setting.upsert({
    where: { key: WEBHOOK_LAST_OK_KEY },
    create: { key: WEBHOOK_LAST_OK_KEY, value },
    update: { value },
  });
}

export async function webhookTerakhirOk(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: WEBHOOK_LAST_OK_KEY } });
  return row?.value?.trim() || null;
}

/**
 * Kegagalan gateway terakhir, untuk ditampilkan di panel admin.
 *
 * Pelanggan hanya melihat 502 dan itu memang benar — pesan galat mentah dari
 * pihak ketiga tidak boleh sampai ke browser mereka. Tapi seseorang harus bisa
 * melihatnya tanpa memburu log, kalau tidak setiap kegagalan menjadi satu
 * putaran tebak-menebak lagi.
 */
export async function kegagalanGatewayTerakhir(): Promise<
  { waktu: string; pesan: string } | null
> {
  const row = await prisma.payment.findFirst({
    where: { status: "failed", lastError: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, lastError: true },
  });
  if (!row?.lastError) return null;
  return { waktu: row.createdAt.toISOString(), pesan: row.lastError };
}

/**
 * Saklar di `Setting`, bukan env: gunanya supaya owner bisa mematikan QRIS
 * dalam satu klik tanpa deploy kalau gateway-nya bermasalah — semua pelanggan
 * langsung jatuh ke transfer manual yang memang tetap ada. Bawaannya MATI:
 * fitur pembayaran tidak boleh menyala sendiri hanya karena kodenya ter-deploy.
 */
export async function gatewayEnabled(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: GATEWAY_SETTING_KEY } });
  const nilai = (row?.value ?? "").trim().toLowerCase();
  return nilai === "1" || nilai === "true" || nilai === "on";
}

export async function setGatewayEnabled(nyala: boolean): Promise<void> {
  const value = nyala ? "1" : "0";
  await prisma.setting.upsert({
    where: { key: GATEWAY_SETTING_KEY },
    create: { key: GATEWAY_SETTING_KEY, value },
    update: { value },
  });
}

export interface OrderForPricing {
  product: string;
  planName: string;
  durationMonths: number;
  priceAmount: number | null;
  /**
   * Order perpanjangan dari alur lama. Hanya ia yang masih dihitung per durasi;
   * pembelian baru berharga tetap.
   */
  isRenewal?: boolean;
}

/**
 * Berapa rupiah yang harus ditagih, atau `null` kalau order ini tidak bisa
 * dibayar lewat QRIS.
 *
 * `null` bukan galat — ia keadaan yang sah untuk paket tanpa harga ("Hubungi
 * kami"), paket gratis, dan produk Agent yang sedang disembunyikan. Yang
 * memanggil menampilkan transfer manual saja, bukan pesan kesalahan.
 */
export async function amountForOrder(order: OrderForPricing): Promise<number | null> {
  if (order.product === "points") {
    // Top-up membawa harganya sendiri sejak dibuat, jadi harga poin yang
    // berubah setelahnya tidak mengubah tagihan yang sudah disepakati.
    return order.priceAmount && order.priceAmount > 0 ? order.priceAmount : null;
  }
  if (order.product !== "metadata") return null;

  const plan = await prisma.plan.findFirst({ where: { name: order.planName } });
  if (!plan || plan.priceMonthly === null || plan.priceMonthly <= 0) return null;

  // Harga apa adanya, TIDAK dikalikan durasi. Sejak alur sekali bayar,
  // `priceMonthly` adalah harga sekali bayar untuk akses selamanya — namanya
  // yang tertinggal, bukan artinya.
  //
  // Order perpanjangan yang masih tersisa dari alur lama tetap memakai aturan
  // lama: baris yang dibuat dengan janji "12 bulan seharga sekian" harus
  // ditagih sebesar itu, bukan sebesar harga hari ini.
  if (order.isRenewal) {
    const months = coerceDuration(order.durationMonths);
    const discounts = await getDurationDiscounts();
    const lama = priceForDuration(plan.priceMonthly, months, discounts[months] ?? 0);
    return lama > 0 ? lama : null;
  }
  return plan.priceMonthly > 0 ? plan.priceMonthly : null;
}

export type StartPaymentResult =
  | { ok: true; linkUrl: string; expiresAt: Date; reused: boolean }
  | {
      ok: false;
      reason: "disabled" | "not_configured" | "order_not_found" | "not_pending" | "no_price" | "gateway_error";
      detail?: string;
    };

/**
 * Membuat (atau memakai ulang) satu pembayaran QRIS untuk sebuah order.
 *
 * `userId` ikut jadi syarat pencarian, bukan diperiksa setelahnya: order milik
 * orang lain harus tampak seperti order yang tidak ada.
 */
export async function startPaymentForOrder(
  userId: string,
  orderId: string,
  opts: { successUrl?: string; cancelUrl?: string } = {}
): Promise<StartPaymentResult> {
  if (!(await gatewayEnabled())) return { ok: false, reason: "disabled" };

  const cfg = sumopodConfig();
  if (!cfg) return { ok: false, reason: "not_configured" };

  const order = await prisma.orderRequest.findFirst({
    where: { id: orderId, userId },
    select: { id: true, product: true, planName: true, durationMonths: true, priceAmount: true, status: true, isRenewal: true },
  });
  if (!order) return { ok: false, reason: "order_not_found" };
  if (order.status !== "pending") return { ok: false, reason: "not_pending" };

  // Tautan yang masih hidup dipakai ulang. Membuat yang baru setiap kali tombol
  // ditekan meninggalkan beberapa tagihan terbuka untuk satu order — dan kalau
  // dua-duanya sempat dibayar, hanya satu yang bisa memenuhi ordernya.
  const hidup = await prisma.payment.findFirst({
    where: { orderId: order.id, status: "pending", expiresAt: { gt: new Date() }, linkUrl: { not: "" } },
    orderBy: { createdAt: "desc" },
  });
  if (hidup) {
    return { ok: true, linkUrl: hidup.linkUrl, expiresAt: hidup.expiresAt, reused: true };
  }

  const amount = await amountForOrder(order);
  if (amount === null) return { ok: false, reason: "no_price" };

  const urutan = (await prisma.payment.count({ where: { orderId: order.id } })) + 1;
  const reference = `${order.id}-${urutan}`;

  // Barisnya dibuat SEBELUM memanggil gateway, walau nilainya belum lengkap:
  // webhook mencari lewat `reference`, dan urutan sebaliknya membuka celah
  // pembayaran yang tiba sebelum barisnya ada — webhook itu akan dijawab 404
  // dan hanya bisa dipulihkan dengan kirim ulang manual.
  const sementara = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const baris = await prisma.payment.create({
    data: { orderId: order.id, reference, amount, linkUrl: "", expiresAt: sementara },
  });

  const hasil = await createPayment(cfg, {
    reference,
    amount,
    successUrl: opts.successUrl,
    cancelUrl: opts.cancelUrl,
  });

  if (!hasil.ok) {
    // Dicatat DI SINI, satu-satunya tempat yang memegang sebab sesungguhnya.
    // Rutenya sengaja cuma membalas `gateway_error` tanpa detail — pesan galat
    // mentah dari pihak ketiga tidak boleh sampai ke browser pelanggan — jadi
    // tanpa baris ini 502 itu buta total. `detail` memuat status HTTP dan badan
    // balasan SumoPod, yang menyebut apakah masalahnya kunci, jumlah, atau kode
    // metode.
    console.warn(
      `[bayar sumopod] gagal membuat pembayaran reference=${reference} ` +
        `amount=${amount} jenis=${hasil.reason} detail=${hasil.detail}`
    );
    await prisma.payment.update({
      where: { id: baris.id },
      data: {
        status: "failed",
        // Dipotong 500 karakter: badan galat HTML dari proxy bisa puluhan
        // kilobyte, dan yang berguna selalu di awal.
        lastError: `${hasil.reason}: ${hasil.detail}`.slice(0, 500),
      },
    });
    return { ok: false, reason: "gateway_error", detail: hasil.detail };
  }

  await prisma.payment.update({
    where: { id: baris.id },
    data: {
      providerPaymentId: hasil.payment.paymentId,
      linkUrl: hasil.payment.linkUrl,
      expiresAt: hasil.payment.expiresAt,
      fee: hasil.payment.fee,
      netAmount: hasil.payment.netAmount,
      paymentCode: hasil.payment.paymentCode,
      paymentCodeType: hasil.payment.paymentCodeType,
    },
  });

  // Bentuk balasan QRIS tidak ada contohnya di dokumentasi — yang ada contoh VA.
  // Satu baris ini yang membuktikan apakah `payment_code` benar-benar muatan
  // EMVCo yang bisa digambar sendiri, tanpa perlu menebak.
  console.info(
    `[bayar sumopod] pembayaran dibuat reference=${reference} ` +
      `codeType=${hasil.payment.paymentCodeType ?? "-"} ` +
      `codeAwalan=${(hasil.payment.paymentCode ?? "").slice(0, 8) || "-"} ` +
      `qrisTerbaca=${tampakMuatanQris(hasil.payment.paymentCode)}`
  );

  return { ok: true, linkUrl: hasil.payment.linkUrl, expiresAt: hasil.payment.expiresAt, reused: false };
}

export type HandleEventResult =
  | { ok: true; note: "test" | "already" | "fulfilled" | "recorded" }
  | { ok: false; reason: "unknown_reference" | "amount_mismatch" | "fulfil_failed"; detail?: string };

/**
 * Memproses satu webhook yang tanda tangannya SUDAH terbukti sah.
 *
 * Idempoten karena webhook memang dikirim ulang — itu bagian desain SumoPod,
 * bukan kegagalan.
 */
export async function handlePaymentEvent(event: PaymentEvent): Promise<HandleEventResult> {
  if (event.eventType === "payment.test") return { ok: true, note: "test" };

  const payment = await prisma.payment.findUnique({ where: { reference: event.reference } });
  if (!payment) return { ok: false, reason: "unknown_reference" };

  // Tanda tangannya sudah membuktikan pesan ini dari SumoPod, jadi ini bukan
  // penjaga terhadap pemalsuan — ia penjaga terhadap kesalahan pemetaan di sisi
  // kita sendiri, yang akibatnya paket mahal aktif atas pembayaran murah.
  if (event.amount !== null && event.amount !== payment.amount) {
    return { ok: false, reason: "amount_mismatch", detail: `${event.amount} != ${payment.amount}` };
  }

  if (event.eventType !== "payment.completed") {
    // failed / expired: hanya menyentuh baris yang masih menggantung, supaya
    // event yang datang terlambat tidak menghapus keberhasilan yang sudah tercatat.
    const status = event.eventType === "payment.expired" ? "expired" : "failed";
    await prisma.payment.updateMany({
      where: { id: payment.id, status: "pending" },
      data: { status, providerPaymentId: payment.providerPaymentId ?? (event.paymentId || null) },
    });
    return { ok: true, note: "recorded" };
  }

  if (payment.status === "completed") return { ok: true, note: "already" };

  // Penuhi DULU, tandai lunas SESUDAHNYA. Kalau dibalik, kegagalan di tengah
  // meninggalkan pembayaran yang tercatat lunas sementara paketnya tidak pernah
  // aktif — dan setiap kiriman ulang berikutnya akan diam saja.
  const hasil = await fulfillOrderRequest(null, payment.orderId);
  if (!hasil.ok && hasil.reason !== "not_pending") {
    return { ok: false, reason: "fulfil_failed", detail: hasil.reason };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "completed",
      completedAt: event.completedAt ?? new Date(),
      fee: event.fee ?? payment.fee,
      netAmount: event.netAmount ?? payment.netAmount,
      providerPaymentId: payment.providerPaymentId ?? (event.paymentId || null),
    },
  });

  // `not_pending` berarti order itu sudah dipenuhi lebih dulu — admin menekan
  // tombol konfirmasi sebelum webhook sampai. Pembayarannya tetap ditandai
  // lunas; yang tidak boleh terjadi cuma memenuhinya dua kali.
  return { ok: true, note: hasil.ok ? "fulfilled" : "already" };
}
