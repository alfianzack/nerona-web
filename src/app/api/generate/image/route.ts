import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateImage, type ImageGenErrorCode } from "@/lib/image-generation";

/**
 * Generate gambar untuk layar /studio.
 *
 * Rute ini sengaja tipis: seluruh urutan gerbangnya ada di lib/image-generation
 * supaya bisa diuji tanpa Next.js. Yang tinggal di sini cuma dua hal yang memang
 * urusan HTTP, yaitu sesi dan pemetaan kode galat ke status.
 *
 * Memakai getServerSession, BUKAN requireUser() dari session-guards: yang
 * terakhir memanggil redirect(), yang di sebuah rute API berarti mengirim 307 ke
 * halaman login alih-alih JSON yang bisa dibaca layarnya.
 */

const STATUS: Record<ImageGenErrorCode, number> = {
  no_model: 503,
  plan: 403,
  no_points: 402,
  // Tiga di bawah ini tidak memotong poin. 502 dipilih supaya terbaca sebagai
  // "yang di seberang gagal", dan blocked tetap 400 karena yang perlu berubah
  // adalah prompt-nya, bukan waktunya.
  blocked: 400,
  no_image: 502,
  upstream: 502,
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const size = typeof body?.size === "string" ? body.size.trim() : "";
  // Dijepit di lib, bukan di sini: batasnya urusan aturan bisnis, dan rute ini
  // cuma menerjemahkan HTTP. Yang bukan angka jatuh ke bawaan 1.
  const jumlah = Number.isFinite(Number(body?.jumlah)) ? Number(body.jumlah) : 1;

  if (!prompt) {
    return NextResponse.json({ ok: false, error: "prompt_kosong" }, { status: 400 });
  }
  if (!size) {
    return NextResponse.json({ ok: false, error: "ukuran_kosong" }, { status: 400 });
  }

  // userId datang dari sesi, bukan dari badan permintaan, sama seperti rute
  // preset prompt: apa pun yang dikirim klien di kolom itu diabaikan.
  const hasil = await generateImage({ userId: session.user.id, prompt, size, jumlah });

  if (!hasil.ok) {
    return NextResponse.json(
      { ok: false, error: hasil.code, pesan: hasil.pesan },
      { status: STATUS[hasil.code] }
    );
  }

  return NextResponse.json({
    ok: true,
    id: hasil.id,
    url: hasil.url,
    urls: hasil.urls,
    ids: hasil.ids,
    points: hasil.points,
    pointsBalance: hasil.sisaPoin,
  });
}
