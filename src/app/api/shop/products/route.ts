import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createProduct, listProductsPaged, type ProductQuery } from "@/lib/shop";

function toInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function numParam(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));

  const sortParam = searchParams.get("sort");
  const sort: ProductQuery["sort"] = (["name", "price", "stock", "createdAt"] as const).includes(
    sortParam as ProductQuery["sort"]
  )
    ? (sortParam as ProductQuery["sort"])
    : "createdAt";
  const order: ProductQuery["order"] = searchParams.get("order") === "asc" ? "asc" : "desc";

  const statusParam = searchParams.get("status");
  const status =
    statusParam === "active" || statusParam === "inactive" ? statusParam : undefined;

  const stockParam = searchParams.get("stockFilter");
  const stockFilter = stockParam === "low" || stockParam === "out" ? stockParam : undefined;

  const query: ProductQuery = {
    page,
    pageSize,
    q: searchParams.get("q")?.trim() || undefined,
    sort,
    order,
    status,
    stockFilter,
    priceMin: numParam(searchParams.get("priceMin")),
    priceMax: numParam(searchParams.get("priceMax")),
  };

  const { rows, total } = await listProductsPaged(session.user.id, query);
  return NextResponse.json({ ok: true, rows, total, page, pageSize });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const price = toInt(body?.price);
  if (!name) {
    return NextResponse.json({ ok: false, message: "Nama produk wajib diisi." }, { status: 400 });
  }
  if (price === null || price < 0) {
    return NextResponse.json({ ok: false, message: "Harga tidak valid." }, { status: 400 });
  }

  const stockRaw = body?.stock;
  const stock = stockRaw === null || stockRaw === undefined || stockRaw === "" ? null : toInt(stockRaw);

  const product = await createProduct(session.user.id, {
    name,
    description: typeof body?.description === "string" ? body.description.trim() || null : null,
    price,
    stock,
    isActive: body?.isActive !== false,
  });
  return NextResponse.json({ ok: true, product });
}
