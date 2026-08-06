import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gatewayEnabled, setGatewayEnabled } from "@/lib/payments/orders";
import { sumopodConfig } from "@/lib/payments/sumopod";

/**
 * Saklar QRIS untuk admin.
 *
 * `configured` dan `sandbox` ikut dilaporkan supaya panel bisa membedakan
 * "saklarnya mati" dari "kuncinya belum ada di server". Tanpa itu, satu-satunya
 * gejala dari kunci yang belum dipasang adalah tombol QRIS yang tidak muncul di
 * halaman order — dan tidak ada apa pun yang menunjukkan sebabnya.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) return NextResponse.json({ ok: false }, { status: 401 });

  const cfg = sumopodConfig();
  return NextResponse.json({
    ok: true,
    enabled: await gatewayEnabled(),
    configured: cfg !== null,
    // Nilainya tidak pernah ikut dikirim — cuma jawaban ya/tidak atas
    // pertanyaan yang perlu dijawab: ini menagih uang sungguhan atau tidak.
    sandbox: cfg !== null && cfg.baseUrl.includes("sandbox"),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  await setGatewayEnabled(body.enabled);
  return NextResponse.json({ ok: true, enabled: body.enabled });
}
