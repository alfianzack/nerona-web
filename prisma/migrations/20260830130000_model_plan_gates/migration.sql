-- Gerbang paket per model: satu kolom per paket, menggantikan `paidOnly`.
--
-- `paidOnly` hanya bisa mengatakan "bukan untuk Free". Ia tidak bisa
-- mengatakan "Business saja", yang justru pertanyaan yang muncul begitu ada
-- model mahal di registri.
ALTER TABLE "ai_models" ADD COLUMN "planFree" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ai_models" ADD COLUMN "planPro" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ai_models" ADD COLUMN "planBusiness" BOOLEAN NOT NULL DEFAULT true;

-- Pemetaan yang membuat keterlihatan TIDAK berubah saat migrasi jalan:
-- paidOnly=true berarti Free tidak melihatnya, dua paket berbayar melihatnya.
UPDATE "ai_models" SET "planFree" = NOT "paidOnly";

ALTER TABLE "ai_models" DROP COLUMN "paidOnly";
