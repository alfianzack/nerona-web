-- Customer-owned shop: products and sales, scoped per user, standalone.
CREATE TABLE "shop_products" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shop_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shop_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "total" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shop_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shop_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    CONSTRAINT "shop_order_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shop_products_userId_idx" ON "shop_products"("userId");
CREATE INDEX "shop_orders_userId_idx" ON "shop_orders"("userId");
CREATE INDEX "shop_order_items_orderId_idx" ON "shop_order_items"("orderId");

ALTER TABLE "shop_products" ADD CONSTRAINT "shop_products_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "shop_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "shop_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
