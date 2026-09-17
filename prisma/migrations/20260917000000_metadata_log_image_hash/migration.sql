-- Sidik gambar untuk penjaga duplikat.
-- Nullable dan tanpa backfill: sidik hanya bisa dihitung dari gambarnya, dan
-- baris lama tidak menyimpan gambar. Baris lama tetap terbaca, cuma tidak ikut
-- dibandingkan.
ALTER TABLE "metadata_logs" ADD COLUMN "imageHash" TEXT;

-- Melayani dua pencarian sekaligus: kecocokan persis, dan pengambilan sidik
-- terbaru milik satu kontributor untuk dibandingkan jaraknya di memori.
CREATE INDEX "metadata_logs_userId_imageHash_idx" ON "metadata_logs"("userId", "imageHash");
