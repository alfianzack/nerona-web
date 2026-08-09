import { NextResponse } from "next/server";
import { baseUrl } from "@/lib/base-url";

/**
 * Keadaan konfigurasi server, untuk diawasi dari luar.
 *
 * Ada karena satu kejadian nyata: `NEXTAUTH_URL` tidak terpasang di Vercel, dan
 * produksi membagikan `http://localhost:3000/hubungkan?kode=…` ke SETIAP Nerona
 * Hub yang mencoba menyambung — entah sejak kapan. Tidak ada galat di sisi mana
 * pun, dan tidak ada satu pun permukaan yang bisa ditanyai untuk mengetahuinya.
 * Yang menemukannya kebetulan.
 *
 * `baseUrl` sengaja publik: itu alamat situs ini sendiri, yang sudah diketahui
 * siapa pun yang membukanya. Yang membuatnya berguna justru karena bisa dibaca
 * tanpa kredensial — pengawasnya tidak perlu memegang rahasia apa pun untuk
 * memeriksa hal yang paling sering salah.
 */
const ENV_YANG_DIPANTAU = [
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "DATABASE_URL",
  "DIRECT_URL",
  "CRON_SECRET",
  "RELEASE_SECRET",
  "SUMOPOD_API_KEY",
] as const;

export async function GET(request: Request) {
  const badan: Record<string, unknown> = {
    ok: true,
    baseUrl: baseUrl(),
  };

  // Detailnya di balik CRON_SECRET, dan yang keluar HANYA benar/salah — tidak
  // pernah nilainya. Pemanggilnya memang sudah memegang satu rahasia, tapi itu
  // bukan alasan membagikan yang lain: endpoint yang mengembalikan isi env
  // mengubah satu rahasia yang bocor jadi seluruhnya bocor.
  const rahasia = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (rahasia && header === `Bearer ${rahasia}`) {
    badan.env = Object.fromEntries(
      ENV_YANG_DIPANTAU.map((nama) => [nama, Boolean((process.env[nama] ?? "").trim())])
    );
  }

  // Tidak di-cache: pengawas yang membaca jawaban lima menit lalu tidak sedang
  // mengawasi apa pun.
  return NextResponse.json(badan, {
    headers: { "Cache-Control": "no-store" },
  });
}
