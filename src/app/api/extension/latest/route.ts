import { NextResponse } from "next/server";
import { tautanAman } from "@/lib/unduhan";
import { getUnduhanSettings } from "@/lib/unduhan-settings";
import { limitByIp, RATE_LIMITS, tooManyRequests } from "@/lib/rate-limit";

/**
 * Versi extension terbaru dan URL ZIP-nya. **Publik, tanpa auth.**
 *
 * Pemanggilnya `perbarui.ps1` di dalam folder extension yang sudah terpasang —
 * skrip itu tidak punya token dan tidak seharusnya punya. Yang terungkap hanya
 * nomor versi dan URL yang memang dirancang untuk diunduh siapa pun; ZIP-nya
 * sendiri aset rilis publik di nerona-hub-releases.
 *
 * Sumber kebenarannya kunci `Setting` yang sama dengan `/unduh`, bukan GitHub
 * API. Bedanya menentukan: versi yang sengaja ditahan owner ikut tertahan di
 * sini, sedangkan GitHub selalu menyerahkan yang paling baru.
 */
export async function GET(request: Request) {
  const batas = limitByIp(request, "ext-latest", RATE_LIMITS.versiPublik);
  if (batas) {
    const { body, init } = tooManyRequests(batas, "Terlalu banyak permintaan.");
    return NextResponse.json(body, init);
  }

  const settings = await getUnduhanSettings();
  const versi = settings.extensionVersion.trim();
  // Divalidasi DI SINI, dan inilah titik render-nya: yang keluar dari rute ini
  // langsung dipakai skrip untuk mengunduh. Nilainya diketik admin, jadi
  // `http://` dan `javascript:` tidak boleh punya jalan sampai ke sana.
  const url = tautanAman(settings.extensionUrl);

  // Keduanya wajib, dan balasannya 503 — bukan 200 dengan kolom kosong.
  //
  // Tanpa `versi`, skrip tidak bisa memutuskan perlu memperbarui atau tidak, dan
  // mengunduh tanpa alasan lebih buruk daripada tidak berbuat apa-apa. Tanpa
  // `url`, tidak ada yang bisa diunduh. 503 juga yang membuat skrip bisa
  // membedakan "belum ada rilis" dari "server rusak" — keduanya bukan
  // "ini URL-nya, silakan pasang".
  if (!versi || !url) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Versi extension belum diterbitkan. Coba lagi nanti, atau unduh manual dari halaman Unduh.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { ok: true, versi, url },
    {
      // Endpoint tanpa auth yang menyentuh basis data tiap panggilan adalah
      // jalan membebani DB secara gratis. Rilis baru terbit paling sering
      // beberapa kali sebulan, jadi lima menit basi tidak merugikan siapa pun.
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    }
  );
}
