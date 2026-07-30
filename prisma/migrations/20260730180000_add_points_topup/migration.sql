-- Top-up poin satuan. Nullable karena hanya terisi untuk order berproduk
-- "points"; order paket tidak punya dua kolom ini.
--
-- Harga ikut disimpan supaya invoice tetap menyebut nominal yang benar-benar
-- ditransfer, meski owner mengubah harga paket poin setelahnya.
ALTER TABLE "order_requests" ADD COLUMN "pointsAmount" INTEGER;
ALTER TABLE "order_requests" ADD COLUMN "priceAmount" INTEGER;
