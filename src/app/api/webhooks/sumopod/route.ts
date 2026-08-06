import { NextResponse } from "next/server";
import { catatWebhookTerverifikasi, handlePaymentEvent } from "@/lib/payments/orders";
import {
  HEADER_ID,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  headerPertama,
  parsePaymentEvent,
  verifyWebhookSignature,
  verifyWebhookToken,
} from "@/lib/payments/sumopod";

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

  const ambil = (nama: string) => request.headers.get(nama);
  const secret = (process.env.SUMOPOD_PAY_WEBHOOK_SECRET || "").trim();
  const verifikasi = verifyWebhookSignature({
    secret,
    svixId: headerPertama(ambil, HEADER_ID),
    svixTimestamp: headerPertama(ambil, HEADER_TIMESTAMP),
    svixSignature: headerPertama(ambil, HEADER_SIGNATURE),
    rawBody,
  });

  // Cadangan token, dan HANYA saat header tanda tangannya memang tidak ada.
  // Tanda tangan yang ADA tapi tidak cocok tetap ditolak mentah-mentah — itu
  // keadaan yang hanya punya dua sebab, salah konfigurasi atau serangan, dan
  // keduanya tidak boleh diselamatkan oleh jalur yang lebih lemah.
  const tokenDiharapkan = (process.env.SUMOPOD_PAY_WEBHOOK_TOKEN || "").trim();
  const lewatToken =
    !verifikasi.ok &&
    verifikasi.reason === "missing_headers" &&
    Boolean(tokenDiharapkan) &&
    verifyWebhookToken(ambil("x-webhook-token"), tokenDiharapkan);

  if (lewatToken) {
    // Dicatat setiap kali, bukan sekali: jalur ini lebih lemah, dan satu-satunya
    // hal yang mencegahnya jadi normal baru tanpa disadari adalah ia terlihat
    // di log setiap kali dipakai.
    console.warn(
      "[webhook sumopod] diterima lewat X-Webhook-Token, bukan tanda tangan — " +
        "jalur ini tanpa timestamp dan tidak terikat isi badan"
    );
  }

  if (!verifikasi.ok && !lewatToken) {
    // Balasannya tetap 401 polos untuk semua sebab — membedakannya di sana
    // berarti memberi tahu penyerang keadaan server kita. Tapi sebabnya WAJIB
    // terlihat di log, karena tanpa itu satu-satunya gejala dari rahasia yang
    // salah tempel dan tanda tangan yang benar-benar palsu adalah 401 yang
    // sama persis, dan tidak ada cara membedakannya dari luar.
    //
    // Satu baris datar, bukan objek bersarang: konsol Vercel melipat objek jadi
    // `{…}`, dan yang terlipat kemarin justru satu-satunya bagian yang
    // menjawab pertanyaannya.
    //
    // NAMA header, bukan nilainya. Nama tidak rahasia, dan tanpa daftar ini
    // menebak ejaan yang dipakai pengirim adalah satu-satunya cara maju.
    const namaHeader = [...request.headers.keys()].sort().join(",");
    console.warn(
      `[webhook sumopod] ditolak alasan=${verifikasi.ok ? "-" : verifikasi.reason} ` +
        `awalanRahasia=${secret ? secret.slice(0, 6) : "(kosong)"} ` +
        `panjangRahasia=${secret.length} panjangBadan=${rawBody.length} ` +
        `tokenDisetel=${Boolean(tokenDiharapkan)} ` +
        `tokenDikirim=${Boolean(ambil("x-webhook-token"))} ` +
        `headerMasuk=[${namaHeader}]`
    );
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
