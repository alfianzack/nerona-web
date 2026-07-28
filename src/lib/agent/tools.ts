import {
  createOrder,
  createProduct,
  updateProduct,
  listProductsPaged,
  listOrdersPaged,
  isOrderStatus,
  type OrderItemInput,
  type OrderStatus,
} from "@/lib/shop";

/**
 * Tool toko untuk agen. Dua aturan yang tidak boleh dilanggar:
 *
 * 1. `userId` SELALU datang dari `ToolContext` (diturunkan dari AgentProfile), tidak
 *    pernah dari output model — agen tidak bisa menyentuh data tenant lain.
 * 2. `executeTool` tidak pernah throw. Setiap kegagalan menjadi `{ ok: false, error }`
 *    supaya model bisa memulihkan diri secara percakapan.
 */

export interface ToolContext {
  userId: string;
  timezone: string;
  /** Hanya untuk test; produksi memakai waktu sekarang. */
  now?: Date;
}

interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

const MAX_DATE_DISTANCE_MS = 366 * 24 * 60 * 60 * 1000;

export const SHOP_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_products",
      description:
        "Lihat daftar produk aktif milik pemilik (nama, harga, stok). Pakai ini untuk mengecek harga atau menjawab pertanyaan tentang produk.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Kata kunci nama produk (opsional)" },
          limit: { type: "integer", description: "Jumlah maksimum, default 20, maks 50" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_product",
      description:
        "Tambahkan produk baru. Kalau namanya sudah ada, harga produk itu yang diperbarui (tidak dibuat ganda). Simpan langsung tanpa meminta konfirmasi.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nama produk" },
          price: { type: "integer", description: "Harga satuan dalam Rupiah, bilangan bulat" },
          stock: { type: "integer", description: "Stok awal (opsional; kosong = stok tidak dilacak)" },
          description: { type: "string", description: "Keterangan singkat (opsional)" },
        },
        required: ["name", "price"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_sale",
      description:
        "Catat penjualan/order. Simpan langsung tanpa meminta konfirmasi, lalu ulangi ringkasannya ke pemilik. Harga item boleh dikosongkan kalau produknya sudah terdaftar.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "Daftar item yang terjual",
            items: {
              type: "object",
              properties: {
                product_name: { type: "string" },
                qty: { type: "integer" },
                unit_price: {
                  type: "integer",
                  description: "Harga satuan; wajib kalau produk belum terdaftar",
                },
              },
              required: ["product_name", "qty"],
            },
          },
          customer_name: { type: "string", description: "Nama pembeli (opsional)" },
          date: {
            type: "string",
            description:
              "Tanggal transaksi format YYYY-MM-DD. Kosongkan kalau penjualan terjadi sekarang. Ubah sendiri kata seperti 'kemarin' memakai tanggal hari ini yang tertulis di prompt.",
          },
          note: { type: "string", description: "Catatan (opsional)" },
          status: {
            type: "string",
            description: "new | paid | done | cancelled. Default paid.",
          },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_recent_orders",
      description: "Lihat order terakhir beserta itemnya, diurutkan dari tanggal transaksi terbaru.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Jumlah maksimum, default 5, maks 20" },
          status: { type: "string", description: "Filter status: new | paid | done | cancelled" },
        },
      },
    },
  },
];

type ToolResult = Record<string, unknown>;

function fail(error: string, extra: ToolResult = {}): ToolResult {
  return { ok: false, error, ...extra };
}

function clampLimit(raw: unknown, fallback: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Format sebuah instant sebagai YYYY-MM-DD menurut zona waktu pemilik. */
function formatDateInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Instant yang jam lokalnya (di `timeZone`) jatuh pada `dateStr` pukul 12:00.
 * Tengah hari dipilih supaya konversi ke UTC tidak pernah menggeser tanggalnya.
 */
function noonInZone(dateStr: string, timeZone: string): Date {
  const guess = new Date(`${dateStr}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  const offset = asIfUtc - guess.getTime();
  return new Date(guess.getTime() - offset);
}

type DateResult = { ok: true; occurredAt: Date } | { ok: false; error: string };

function parseOccurredAt(dateStr: string, ctx: ToolContext): DateResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, error: "Format tanggal harus YYYY-MM-DD, contoh 2026-06-15." };
  }
  const occurredAt = noonInZone(dateStr, ctx.timezone);
  if (Number.isNaN(occurredAt.getTime())) {
    return { ok: false, error: `Tanggal ${dateStr} tidak valid.` };
  }
  // Menangkap tanggal yang tidak ada (mis. 2026-02-31 yang bergeser ke Maret).
  if (formatDateInZone(occurredAt, ctx.timezone) !== dateStr) {
    return { ok: false, error: `Tanggal ${dateStr} tidak ada di kalender.` };
  }
  const now = ctx.now ?? new Date();
  if (Math.abs(occurredAt.getTime() - now.getTime()) > MAX_DATE_DISTANCE_MS) {
    return {
      ok: false,
      error: `Tanggal ${dateStr} lebih dari satu tahun dari hari ini — konfirmasi dulu ke pemilik tanggal yang benar.`,
    };
  }
  return { ok: true, occurredAt };
}

async function findProducts(userId: string, q: string, limit: number) {
  const { rows, total } = await listProductsPaged(userId, {
    page: 1,
    pageSize: limit,
    q: q || undefined,
    sort: "name",
    order: "asc",
    status: "active",
  });
  return { rows, total };
}

async function toolListProducts(ctx: ToolContext, args: any): Promise<ToolResult> {
  const limit = clampLimit(args.limit, 20, 50);
  const { rows, total } = await findProducts(ctx.userId, String(args.q ?? "").trim(), limit);
  return {
    ok: true,
    products: rows.map((p) => ({ name: p.name, price: p.price, stock: p.stock })),
    total,
  };
}

async function toolAddProduct(ctx: ToolContext, args: any): Promise<ToolResult> {
  const name = String(args.name ?? "").trim();
  if (!name) return fail("Nama produk tidak boleh kosong.");
  if (name.length > 120) return fail("Nama produk terlalu panjang (maks 120 karakter).");
  if (!isNonNegativeInt(args.price)) {
    return fail("Harga harus bilangan bulat 0 atau lebih, dalam Rupiah tanpa titik.");
  }
  if (args.stock !== undefined && args.stock !== null && !isNonNegativeInt(args.stock)) {
    return fail("Stok harus bilangan bulat 0 atau lebih.");
  }

  // Pencarian memakai `contains`, jadi kecocokan harus disaring jadi PERSIS di sini —
  // "Nasi Goreng" tidak boleh menimpa harga "Nasi Goreng Spesial".
  const { rows } = await listProductsPaged(ctx.userId, {
    page: 1,
    pageSize: 50,
    q: name,
    sort: "name",
    order: "asc",
  });
  const existing = rows.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());

  if (existing) {
    const updated = await updateProduct(ctx.userId, existing.id, {
      price: args.price,
      ...(args.stock !== undefined && args.stock !== null ? { stock: args.stock } : {}),
      ...(args.description !== undefined ? { description: String(args.description) } : {}),
    });
    if (!updated) return fail("Produk tidak ditemukan saat memperbarui.");
    return {
      ok: true,
      action: "updated",
      product: { name: updated.name, price: updated.price, stock: updated.stock },
    };
  }

  const created = await createProduct(ctx.userId, {
    name,
    price: args.price,
    stock: args.stock ?? null,
    description: args.description !== undefined ? String(args.description) : null,
  });
  return {
    ok: true,
    action: "created",
    product: { name: created.name, price: created.price, stock: created.stock },
  };
}

interface ResolvedItem {
  item: OrderItemInput;
}

async function resolveSaleItem(
  ctx: ToolContext,
  raw: any
): Promise<ResolvedItem | { error: string; candidates?: unknown[] }> {
  const productName = String(raw?.product_name ?? "").trim();
  if (!productName) return { error: "Setiap item harus punya product_name." };

  const qty = raw?.qty;
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1) {
    return { error: `Jumlah untuk "${productName}" harus bilangan bulat minimal 1.` };
  }

  const unitPriceGiven = raw?.unit_price !== undefined && raw?.unit_price !== null;
  if (unitPriceGiven && !isNonNegativeInt(raw.unit_price)) {
    return { error: `Harga satuan untuk "${productName}" harus bilangan bulat 0 atau lebih.` };
  }

  const { rows } = await findProducts(ctx.userId, productName, 10);

  // Nama yang persis sama mengalahkan kecocokan sebagian, sehingga "Nasi Goreng"
  // tidak dianggap ambigu hanya karena ada "Nasi Goreng Spesial".
  const exact = rows.filter((p) => p.name.trim().toLowerCase() === productName.toLowerCase());
  const matches = exact.length > 0 ? exact : rows;

  if (matches.length > 1) {
    return {
      error: `Produk "${productName}" cocok dengan lebih dari satu produk — tanyakan ke pemilik yang mana.`,
      candidates: matches.map((p) => ({ name: p.name, price: p.price })),
    };
  }

  if (matches.length === 1) {
    const product = matches[0];
    return {
      item: {
        productId: product.id,
        productName: product.name,
        qty,
        unitPrice: unitPriceGiven ? raw.unit_price : product.price,
      },
    };
  }

  if (!unitPriceGiven) {
    return {
      error: `Produk "${productName}" belum terdaftar. Tanyakan harganya ke pemilik, atau tambahkan dulu lewat add_product.`,
    };
  }

  return {
    item: { productId: null, productName, qty, unitPrice: raw.unit_price },
  };
}

async function toolRecordSale(ctx: ToolContext, args: any): Promise<ToolResult> {
  const rawItems = Array.isArray(args.items) ? args.items : [];
  if (rawItems.length === 0) return fail("Minimal satu item harus disebutkan.");

  const status: OrderStatus = args.status === undefined ? "paid" : args.status;
  if (!isOrderStatus(status)) {
    return fail("Status harus salah satu dari: new, paid, done, cancelled.");
  }

  let occurredAt: Date | undefined;
  if (args.date !== undefined && args.date !== null && String(args.date).trim() !== "") {
    const parsed = parseOccurredAt(String(args.date).trim(), ctx);
    if (!parsed.ok) return fail(parsed.error);
    occurredAt = parsed.occurredAt;
  }

  const items: OrderItemInput[] = [];
  for (const raw of rawItems) {
    const resolved = await resolveSaleItem(ctx, raw);
    if ("error" in resolved) {
      return fail(resolved.error, resolved.candidates ? { candidates: resolved.candidates } : {});
    }
    items.push(resolved.item);
  }

  const order = await createOrder(ctx.userId, {
    items,
    customerName: args.customer_name ? String(args.customer_name).trim() : null,
    note: args.note ? String(args.note).trim() : null,
    status,
    ...(occurredAt ? { occurredAt } : {}),
  });

  return {
    ok: true,
    order: {
      id: order.id,
      customer_name: order.customerName,
      status: order.status,
      total: order.total,
      date: formatDateInZone(order.occurredAt, ctx.timezone),
      items: order.items.map((i) => ({
        name: i.productName,
        qty: i.qty,
        unit_price: i.unitPrice,
        subtotal: i.qty * i.unitPrice,
      })),
    },
  };
}

async function toolListRecentOrders(ctx: ToolContext, args: any): Promise<ToolResult> {
  if (args.status !== undefined && args.status !== null && !isOrderStatus(args.status)) {
    return fail("Status harus salah satu dari: new, paid, done, cancelled.");
  }
  const { rows, total } = await listOrdersPaged(ctx.userId, {
    page: 1,
    pageSize: clampLimit(args.limit, 5, 20),
    sort: "occurredAt",
    order: "desc",
    ...(args.status ? { status: args.status as OrderStatus } : {}),
  });

  return {
    ok: true,
    total,
    orders: rows.map((order) => ({
      id: order.id,
      customer_name: order.customerName,
      status: order.status,
      total: order.total,
      date: formatDateInZone(order.occurredAt, ctx.timezone),
      items: order.items.map((i) => ({ name: i.productName, qty: i.qty, unit_price: i.unitPrice })),
    })),
  };
}

const HANDLERS: Record<string, (ctx: ToolContext, args: any) => Promise<ToolResult>> = {
  list_products: toolListProducts,
  add_product: toolAddProduct,
  record_sale: toolRecordSale,
  list_recent_orders: toolListRecentOrders,
};

export async function executeTool(
  ctx: ToolContext,
  name: string,
  argsJson: string
): Promise<string> {
  const handler = HANDLERS[name];
  if (!handler) {
    return JSON.stringify(fail(`Tool "${name}" tidak ada.`));
  }

  let args: any;
  try {
    args = argsJson && argsJson.trim() ? JSON.parse(argsJson) : {};
  } catch {
    return JSON.stringify(fail("Argumen tool bukan JSON yang valid."));
  }
  if (args === null || typeof args !== "object") {
    return JSON.stringify(fail("Argumen tool harus berupa objek."));
  }

  try {
    return JSON.stringify(await handler(ctx, args));
  } catch (err) {
    console.error(`[agent-tools] ${name} gagal`, err);
    return JSON.stringify(fail("Terjadi kesalahan saat mengakses data toko. Coba lagi."));
  }
}
