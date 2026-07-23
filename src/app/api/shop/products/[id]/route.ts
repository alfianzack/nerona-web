import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteProduct, updateProduct, type ProductInput } from "@/lib/shop";

function toInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const patch: Partial<ProductInput> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ ok: false, message: "Nama tidak boleh kosong." }, { status: 400 });
    patch.name = name;
  }
  if (body.description !== undefined) {
    patch.description = typeof body.description === "string" ? body.description.trim() || null : null;
  }
  if (body.price !== undefined) {
    const price = toInt(body.price);
    if (price === null || price < 0)
      return NextResponse.json({ ok: false, message: "Harga tidak valid." }, { status: 400 });
    patch.price = price;
  }
  if (body.stock !== undefined) {
    patch.stock = body.stock === null || body.stock === "" ? null : toInt(body.stock);
  }
  if (body.isActive !== undefined) {
    patch.isActive = Boolean(body.isActive);
  }

  const product = await updateProduct(session.user.id, params.id, patch);
  if (!product) {
    return NextResponse.json({ ok: false, message: "Produk tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, product });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const ok = await deleteProduct(session.user.id, params.id);
  if (!ok) {
    return NextResponse.json({ ok: false, message: "Produk tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
