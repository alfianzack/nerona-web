import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { attachPaymentProof, getProofImage } from "@/lib/orders";

export const maxDuration = 30;

const PROOF_ERRORS: Record<string, { status: number; message: string }> = {
  not_found: { status: 404, message: "Order tidak ditemukan." },
  not_pending: { status: 409, message: "Order ini sudah diproses." },
  invalid_type: { status: 400, message: "File harus berupa gambar (PNG, JPG, atau WEBP)." },
  too_large: { status: 400, message: "Ukuran gambar maksimal 5 MB." },
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("proof");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "File belum dipilih." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await attachPaymentProof(session.user.id, params.id, bytes, file.type);
  if (!result.ok) {
    const mapped = PROOF_ERRORS[result.reason];
    return NextResponse.json({ ok: false, message: mapped.message }, { status: mapped.status });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const image = await getProofImage(params.id, session.user.id, Boolean(session.user.role));
  if (!image) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.bytes), {
    status: 200,
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "private, no-store",
    },
  });
}
