-- AlterTable: tanggal transaksi terpisah dari waktu pencatatan.
ALTER TABLE "shop_orders" ADD COLUMN     "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill baris lama supaya kolom ini non-null dan laporan tidak berubah angkanya.
UPDATE "shop_orders" SET "occurredAt" = "createdAt";

-- CreateIndex
CREATE INDEX "shop_orders_userId_occurredAt_idx" ON "shop_orders"("userId", "occurredAt");
