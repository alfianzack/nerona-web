import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export const ORDER_STATUSES = ["new", "paid", "done", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

// ---------- Products ----------

export interface ProductInput {
  name: string;
  description?: string | null;
  price: number;
  stock?: number | null;
  isActive?: boolean;
}

export function listProducts(userId: string) {
  return prisma.shopProduct.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export function createProduct(userId: string, input: ProductInput) {
  return prisma.shopProduct.create({
    data: {
      userId,
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      stock: input.stock ?? null,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateProduct(userId: string, id: string, input: Partial<ProductInput>) {
  const existing = await prisma.shopProduct.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return null;
  return prisma.shopProduct.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.stock !== undefined ? { stock: input.stock } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

export async function deleteProduct(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.shopProduct.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return false;
  await prisma.shopProduct.delete({ where: { id } });
  return true;
}

export const LOW_STOCK_THRESHOLD = 5;

export interface ProductQuery {
  page: number;
  pageSize: number;
  q?: string;
  sort: "name" | "price" | "stock" | "createdAt";
  order: "asc" | "desc";
  status?: "active" | "inactive";
  stockFilter?: "low" | "out";
  priceMin?: number;
  priceMax?: number;
}

export async function listProductsPaged(userId: string, query: ProductQuery) {
  const where: Prisma.ShopProductWhereInput = { userId };

  if (query.q) {
    where.name = { contains: query.q, mode: "insensitive" };
  }
  if (query.status === "active") {
    where.isActive = true;
  } else if (query.status === "inactive") {
    where.isActive = false;
  }
  if (query.stockFilter === "out") {
    where.stock = 0;
  } else if (query.stockFilter === "low") {
    where.stock = { lte: LOW_STOCK_THRESHOLD };
  }
  if (query.priceMin !== undefined || query.priceMax !== undefined) {
    where.price = {
      ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
      ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.shopProduct.findMany({
      where,
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.shopProduct.count({ where }),
  ]);

  return { rows, total };
}

// ---------- Orders ----------

export interface OrderItemInput {
  productId?: string | null;
  productName: string;
  qty: number;
  unitPrice: number;
}

export interface OrderInput {
  customerName?: string | null;
  note?: string | null;
  items: OrderItemInput[];
}

export function listOrders(userId: string) {
  return prisma.shopOrder.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
}

function computeTotal(items: OrderItemInput[]): number {
  return items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
}

export async function createOrder(userId: string, input: OrderInput) {
  const items = input.items.filter((item) => item.productName && item.qty > 0);
  const total = computeTotal(items);
  return prisma.shopOrder.create({
    data: {
      userId,
      customerName: input.customerName ?? null,
      note: input.note ?? null,
      total,
      items: {
        create: items.map((item) => ({
          productId: item.productId ?? null,
          productName: item.productName,
          qty: item.qty,
          unitPrice: item.unitPrice,
        })),
      },
    },
    include: { items: true },
  });
}

export async function updateOrderStatus(userId: string, id: string, status: OrderStatus) {
  const existing = await prisma.shopOrder.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return null;
  return prisma.shopOrder.update({ where: { id }, data: { status } });
}

export async function deleteOrder(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.shopOrder.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return false;
  await prisma.shopOrder.delete({ where: { id } });
  return true;
}

export interface OrderQuery {
  page: number;
  pageSize: number;
  q?: string;
  sort: "createdAt" | "total" | "status";
  order: "asc" | "desc";
  status?: OrderStatus;
  dateFrom?: Date;
  dateTo?: Date;
  totalMin?: number;
  totalMax?: number;
}

export async function listOrdersPaged(userId: string, query: OrderQuery) {
  const where: Prisma.ShopOrderWhereInput = { userId };

  if (query.q) {
    where.customerName = { contains: query.q, mode: "insensitive" };
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom ? { gte: query.dateFrom } : {}),
      ...(query.dateTo ? { lte: query.dateTo } : {}),
    };
  }
  if (query.totalMin !== undefined || query.totalMax !== undefined) {
    where.total = {
      ...(query.totalMin !== undefined ? { gte: query.totalMin } : {}),
      ...(query.totalMax !== undefined ? { lte: query.totalMax } : {}),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.shopOrder.findMany({
      where,
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { items: true },
    }),
    prisma.shopOrder.count({ where }),
  ]);

  return { rows, total };
}
