-- AlterTable
ALTER TABLE "plans" ADD COLUMN "hub" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "licenses" ADD COLUMN "hub" BOOLEAN NOT NULL DEFAULT false;

-- Backfill 1: paket Business yang berhak.
UPDATE "plans" SET "hub" = true WHERE "name" = 'Business';

-- Backfill 2: lisensi Business yang SUDAH ADA.
--
-- Wajib, dan bukan sekadar kerapian: kolomnya berdefault false, jadi tanpa
-- baris ini setiap pelanggan Business yang sudah membayar langsung kehilangan
-- Hub pada deploy berikutnya — persis kebalikan dari yang dimaksud.
UPDATE "licenses"
SET "hub" = true
WHERE "planId" IN (SELECT "id" FROM "plans" WHERE "hub" = true);
