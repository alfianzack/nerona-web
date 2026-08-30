import { NextResponse } from "next/server";
import { getProviderById, resolveProviderCredentials } from "@/lib/ai-providers";
import { testAiConnection } from "@/lib/ai-connection-test";
import { requireOwner } from "@/lib/ai-errors";

interface Ctx {
  params: { id: string };
}

/**
 * Provider tidak bisa diuji sendirian — yang menjawab sebuah panggilan adalah
 * pasangan gateway DAN model. Model id-nya diketik saat menguji dan tidak
 * disimpan; ia hanya bahan uji.
 */
export async function POST(request: Request, { params }: Ctx) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const model = typeof body?.model === "string" ? body.model.trim() : "";
  if (!model) {
    return NextResponse.json({ ok: false, message: "Isi model id untuk diuji." }, { status: 400 });
  }

  const provider = await getProviderById(params.id);
  if (!provider) {
    return NextResponse.json({ ok: false, message: "Provider tidak ditemukan." }, { status: 404 });
  }

  const { apiKey, baseUrl } = resolveProviderCredentials(provider);
  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      result: {
        ok: false,
        configured: false,
        model,
        text: { ok: false, skipped: true },
        vision: { ok: false, skipped: true },
      },
    });
  }

  const result = await testAiConnection({ apiKey, baseUrl, model });
  return NextResponse.json({ ok: true, result });
}
