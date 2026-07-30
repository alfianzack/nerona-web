-- Harga paket jadi angka: "Rp 99.000/bulan" tidak bisa dikalikan durasi.
-- Nilai lama dipindah dengan membuang semua karakter non-digit, lalu kolom
-- teksnya dibuang supaya tidak ada dua sumber harga yang bisa berselisih.
ALTER TABLE "plans" ADD COLUMN "priceMonthly" INTEGER;

UPDATE "plans"
SET "priceMonthly" = NULLIF(regexp_replace(COALESCE("priceLabel", ''), '[^0-9]', '', 'g'), '')::INTEGER;

ALTER TABLE "plans" DROP COLUMN "priceLabel";

-- Durasi yang dibeli. Default 1 membuat setiap baris lama tetap bermakna:
-- semua langganan yang ada memang bulanan.
ALTER TABLE "order_requests" ADD COLUMN "durationMonths" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "licenses" ADD COLUMN "durationMonths" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "agent_profiles" ADD COLUMN "planDurationMonths" INTEGER NOT NULL DEFAULT 1;
