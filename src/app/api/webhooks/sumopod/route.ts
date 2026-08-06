import { NextResponse } from "next/server";
import { handlePaymentEvent } from "@/lib/payments/orders";
import { parsePaymentEvent, verifyWebhookSignature } from "@/lib/payments/sumopod";

/**
 * Webhook SumoPod. Tanpa sesi dan tanpa token — yang membuktikan asalnya adalah
 * tanda tangan HMAC di header.
 *
 * SumoPod menandai webhook GAGAL kalau tidak dibalas 2xx dalam 10 detik, jadi
 * yang dikerjakan di sini harus tetap pendek: verifikasi, satu pencarian, lalu
 * pemenuhan yang isinya beberapa tulisan DB.
 */

const STATUS: Record<string, number> = {
  unknown_reference: 404,
  amount_mismatch: 409,
  fulfil_failed: 500,
};

export async function POST(request: Request) {
  // Badan MENTAH, dan baru di-parse setelah tanda tangannya cocok. Satu spasi
  // berbeda dari hasil parse-lalu-stringify sudah cukup membuat HMAC tidak
  // pernah cocok.
  const rawBody = await request.text();

  const secret = (process.env.SUMOPOD_PAY_WEBHOOK_SECRET || "").trim();
  const verifikasi = verifyWebhookSignature({
    secret,
    svixId: request.headers.get("svix-id"),
    svixTimestamp: request.headers.get("svix-timestamp"),
    svixSignature: request.headers.get("svix-signature"),
    rawBody,
  });
  if (!verifikasi.ok) {
    // 401 untuk semuanya, termasuk rahasia yang belum diatur: membedakan
    // "rahasia belum diatur" dari "tanda tangan salah" di balasan berarti
    // memberi tahu penyerang keadaan server kita.
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const event = parsePaymentEvent(rawBody);
  if (!event) return NextResponse.json({ ok: false, reason: "malformed" }, { status: 400 });

  const hasil = await handlePaymentEvent(event);
  if (!hasil.ok) {
    // Sengaja BUKAN 2xx: SumoPod menandainya gagal dan menyediakan kirim ulang
    // dari dashboard. Membalas 200 atas sesuatu yang tidak terproses berarti
    // menutup satu-satunya jalan pemulihan yang kita punya — tidak ada endpoint
    // untuk menanyakan status pembayaran.
    return NextResponse.json(
      { ok: false, reason: hasil.reason },
      { status: STATUS[hasil.reason] ?? 400 }
    );
  }

  return NextResponse.json({ ok: true, note: hasil.note });
}
