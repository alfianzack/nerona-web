import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createOrder, listOrdersPaged, isOrderStatus, type OrderItemInput, type OrderQuery } from "@/lib/shop";

function numParam(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function dateParam(value: string | null, endOfDay: boolean): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const page = Math.max(1, Math.floor(Number(searchParams.get("page")) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(searchParams.get("pageSize")) || 20)));

  const sortParam = searchParams.get("sort");
  const sort: OrderQuery["sort"] = (["createdAt", "total", "status"] as const).includes(
    sortParam as OrderQuery["sort"]
  )
    ? (sortParam as OrderQuery["sort"])
    : "createdAt";
  const order: OrderQuery["order"] = searchParams.get("order") === "asc" ? "asc" : "desc";

  const statusParam = searchParams.get("status");
  const status = isOrderStatus(statusParam) ? statusParam : undefined;

  const query: OrderQuery = {
    page,
    pageSize,
    q: searchParams.get("q")?.trim() || undefined,
    sort,
    order,
    status,
    dateFrom: dateParam(searchParams.get("dateFrom"), false),
    dateTo: dateParam(searchParams.get("dateTo"), true),
    totalMin: numParam(searchParams.get("totalMin")),
    totalMax: numParam(searchParams.get("totalMax")),
  };

  const { rows, total } = await listOrdersPaged(session.user.id, query);
  return NextResponse.json({ ok: true, rows, total, page, pageSize });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const items: OrderItemInput[] = rawItems
    .map((item: Record<string, unknown>) => ({
      productId: typeof item?.productId === "string" ? item.productId : null,
      productName: typeof item?.productName === "string" ? item.productName.trim() : "",
      qty: toInt(item?.qty),
      unitPrice: toInt(item?.unitPrice),
    }))
    .filter((item: OrderItemInput) => item.productName && item.qty > 0);

  if (items.length === 0) {
    return NextResponse.json(
      { ok: false, message: "Tambahkan minimal satu item." },
      { status: 400 }
    );
  }

  const order = await createOrder(session.user.id, {
    customerName: typeof body?.customerName === "string" ? body.customerName.trim() || null : null,
    note: typeof body?.note === "string" ? body.note.trim() || null : null,
    items,
  });
  return NextResponse.json({ ok: true, order });
}
