import { NextResponse } from "next/server";
import { catatWebhookTerverifikasi, handlePaymentEvent } from "@/lib/payments/orders";
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
    // Balasannya tetap 401 polos untuk semua sebab — membedakannya di sana
    // berarti memberi tahu penyerang keadaan server kita. Tapi sebabnya WAJIB
    // terlihat di log, karena tanpa itu satu-satunya gejala dari rahasia yang
    // salah tempel dan tanda tangan yang benar-benar palsu adalah 401 yang
    // sama persis, dan tidak ada cara membedakannya dari luar.
    console.warn("[webhook sumopod] ditolak", {
      alasan: verifikasi.reason,
      // Awalan saja, tidak pernah nilainya. `whtok_` di sini berarti yang
      // tertempel adalah Webhook Token, bukan Signing Secret — dua nilai
      // berbeda yang duduk bersebelahan di tab Settings SumoPod.
      awalanRahasia: secret ? secret.slice(0, 6) : "(kosong)",
      panjangRahasia: secret.length,
      header: {
        svixId: Boolean(request.headers.get("svix-id")),
        svixTimestamp: request.headers.get("svix-timestamp") ?? null,
        svixSignature: Boolean(request.headers.get("svix-signature")),
        webhookToken: Boolean(request.headers.get("x-webhook-token")),
      },
      panjangBadan: rawBody.length,
    });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Dicatat SEBELUM isinya diproses, dan sengaja begitu: yang ingin dijawab
  // panel admin adalah "apakah SumoPod bisa mencapai kita dengan rahasia yang
  // benar", bukan "apakah event terakhir berhasil dipenuhi". Keduanya keadaan
  // berbeda, dan yang pertama itulah syarat sebelum QRIS boleh dinyalakan.
  await catatWebhookTerverifikasi();

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
