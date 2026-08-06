import { createHmac, timingSafeEqual } from "crypto";

/**
 * Klien SumoPod Managed Payment — hanya QRIS.
 *
 * Berkas ini tidak menyentuh prisma dan tidak tahu apa-apa soal order Nerona.
 * Yang tinggal di sini cuma bentuk kontrak SumoPod dan aturan tanda tangannya,
 * supaya bagian yang paling mudah salah — verifikasi HMAC — bisa dites tanpa
 * basis data dan tanpa HTTP.
 */

export const QRIS_METHOD_CODE = "QRIS";

/** Batas maksimal yang diterima SumoPod. Lebih dari ini ditolak di sisi mereka. */
export const MAX_EXPIRES_IN_HOURS = 24;

/**
 * Permintaan yang timestamp-nya lebih tua dari ini ditolak walau tanda
 * tangannya cocok. Tanpa batas ini, satu permintaan sah yang pernah terekam
 * bisa diputar ulang kapan saja — dan tanda tangannya akan tetap cocok
 * selamanya, karena HMAC tidak tahu waktu.
 */
export const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface SumoPodConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Kunci hidup di env, bukan `Setting`: keduanya rahasia, dan `Setting` terbaca
 * dari panel admin. `null` berarti belum dikonfigurasi — pemanggil yang
 * memutuskan itu berarti "tombol QRIS mati", bukan "galat".
 *
 * Awalan `SUMOPOD_PAY_`, bukan `SUMOPOD_`: `SUMOPOD_API_KEY` dan
 * `SUMOPOD_BASE_URL` SUDAH dipakai layanan AI SumoPod (`ai-settings.ts`,
 * `agent/claude-client.ts`). Dua produk berbeda dari vendor yang sama, dengan
 * kunci yang berbeda — memakai nama yang sama berarti kunci AI dikirim ke
 * endpoint pembayaran, dan gagalnya berupa 401 yang menyesatkan.
 */
export function sumopodConfig(): SumoPodConfig | null {
  const baseUrl = (process.env.SUMOPOD_PAY_API_BASE || "").trim().replace(/\/+$/, "");
  const apiKey = (process.env.SUMOPOD_PAY_API_KEY || "").trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

export interface CreatePaymentInput {
  /** `order_id` di sisi SumoPod — referensi milik kita, unik per upaya bayar. */
  reference: string;
  amount: number;
  expiresInHours?: number;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreatedPayment {
  paymentId: string;
  linkUrl: string;
  amount: number;
  fee: number | null;
  netAmount: number | null;
  status: string;
  expiresAt: Date;
}

export type CreatePaymentResult =
  | { ok: true; payment: CreatedPayment }
  | { ok: false; reason: "network" | "rejected" | "malformed"; detail: string };

export async function createPayment(
  cfg: SumoPodConfig,
  input: CreatePaymentInput
): Promise<CreatePaymentResult> {
  const jam = Math.min(Math.max(1, Math.floor(input.expiresInHours ?? MAX_EXPIRES_IN_HOURS)), MAX_EXPIRES_IN_HOURS);

  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/api/v1/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": cfg.apiKey },
      body: JSON.stringify({
        order_id: input.reference,
        amount: input.amount,
        currency: "IDR",
        expires_in_hours: jam,
        payment_method_type_code: QRIS_METHOD_CODE,
        ...(input.successUrl ? { success_return_url: input.successUrl } : {}),
        ...(input.cancelUrl ? { cancel_return_url: input.cancelUrl } : {}),
      }),
    });
  } catch (err) {
    return { ok: false, reason: "network", detail: String((err as Error)?.message ?? err) };
  }

  const teks = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, reason: "rejected", detail: `${res.status} ${teks}`.trim() };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(teks);
  } catch {
    return { ok: false, reason: "malformed", detail: teks.slice(0, 200) };
  }

  const paymentId = typeof body.payment_id === "string" ? body.payment_id : "";
  const linkUrl = typeof body.payment_link_url === "string" ? body.payment_link_url : "";
  const expiresAt = typeof body.expires_at === "string" ? new Date(body.expires_at) : null;

  // Ketiganya syarat minimum untuk bisa menagih: tanpa tautan tidak ada yang
  // bisa dibayar, tanpa payment_id kita tidak bisa mencocokkan apa pun, dan
  // tanpa expires_at halaman tidak bisa berkata kapan tautannya mati. Balasan
  // 200 yang tidak lengkap lebih berbahaya daripada galat — ia terlihat sukses.
  if (!paymentId || !linkUrl || !expiresAt || Number.isNaN(expiresAt.getTime())) {
    return { ok: false, reason: "malformed", detail: teks.slice(0, 200) };
  }

  return {
    ok: true,
    payment: {
      paymentId,
      linkUrl,
      amount: angka(body.amount) ?? input.amount,
      fee: angka(body.fee),
      netAmount: angka(body.net_amount),
      status: typeof body.status === "string" ? body.status : "pending",
      expiresAt,
    },
  };
}

function angka(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export interface VerifyInput {
  /** Rahasia proyek, berawalan `whsec_`. */
  secret: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  /** Badan MENTAH. Hasil parse-lalu-stringify tidak akan pernah cocok. */
  rawBody: string;
  now?: Date;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing_headers" | "bad_timestamp" | "stale" | "mismatch" };

/**
 * Verifikasi tanda tangan gaya Svix.
 *
 * Dipakai alih-alih `X-Webhook-Token` yang jauh lebih sederhana: token itu
 * string tetap yang sama di setiap permintaan, jadi sekali bocor (log, proxy,
 * riwayat) siapa pun bisa mengulang permintaan palsu selamanya dan tidak ada
 * apa pun di permintaan itu yang bisa kita tolak.
 */
export function verifyWebhookSignature(input: VerifyInput): VerifyResult {
  const { secret, svixId, svixTimestamp, svixSignature, rawBody } = input;
  if (!secret || !svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: "missing_headers" };
  }

  const detik = Number(svixTimestamp);
  if (!Number.isFinite(detik)) return { ok: false, reason: "bad_timestamp" };

  const sekarang = (input.now ?? new Date()).getTime();
  // Dua arah, bukan cuma masa lalu: timestamp jauh di masa depan berarti jam
  // pengirim salah atau permintaannya dikarang, dan keduanya bukan sesuatu
  // yang boleh kita proses.
  if (Math.abs(sekarang - detik * 1000) > SIGNATURE_TOLERANCE_MS) {
    return { ok: false, reason: "stale" };
  }

  const kunci = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const konten = `${svixId}.${svixTimestamp}.${rawBody}`;
  const diharapkan = createHmac("sha256", kunci).update(konten).digest("base64");

  // Header bisa berisi beberapa tanda tangan dipisah spasi (`v1,<sig> v1,<sig>`)
  // — itu yang terjadi selama ±24 jam setelah rahasia dirotasi. Cocok dengan
  // salah satunya sudah cukup.
  const daftar = svixSignature
    .split(" ")
    .map((bagian) => bagian.split(",")[1] ?? "")
    .filter(Boolean);

  for (const kandidat of daftar) {
    if (samaAman(kandidat, diharapkan)) return { ok: true };
  }
  return { ok: false, reason: "mismatch" };
}

/** Panjang dibandingkan lebih dulu karena `timingSafeEqual` melempar kalau beda. */
function samaAman(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export interface PaymentEvent {
  eventType: string;
  paymentId: string;
  /** `order_id` yang kita kirim — kolom `reference` di tabel `payments`. */
  reference: string;
  amount: number | null;
  fee: number | null;
  netAmount: number | null;
  status: string;
  completedAt: Date | null;
}

/** `null` = bentuknya tidak dikenali. Pemanggil membalas 400, bukan 500. */
export function parsePaymentEvent(rawBody: string): PaymentEvent | null {
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const eventType = typeof body?.event_type === "string" ? body.event_type : "";
  const data = body?.data;
  if (!eventType || !data || typeof data !== "object") return null;

  const reference = typeof data.order_id === "string" ? data.order_id : "";
  const paymentId = typeof data.payment_id === "string" ? data.payment_id : "";
  // `payment.test` datang tanpa order sungguhan; pemanggil menanganinya
  // sebelum menyentuh apa pun, jadi di sini ia tetap sah walau referensinya
  // kosong.
  if (!reference && eventType !== "payment.test") return null;

  const selesai = typeof data.completed_at === "string" ? new Date(data.completed_at) : null;
  return {
    eventType,
    paymentId,
    reference,
    amount: angka(data.amount),
    fee: angka(data.fee),
    netAmount: angka(data.net_amount),
    status: typeof data.status === "string" ? data.status : "",
    completedAt: selesai && !Number.isNaN(selesai.getTime()) ? selesai : null,
  };
}
