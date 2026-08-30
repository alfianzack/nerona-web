-- Semua kunci gateway pindah ke satu tempat.
--
-- Kunci disalin dari `settings`, TARIF TIDAK. Peringatan di migrasi
-- 20260828000000_ai_models masih berlaku: SQL tidak bisa membaca rantai
-- fallback env (AI_PRICE_IN / POINTS_PER_USD), jadi menyalin tarif dari
-- settings bisa diam-diam mengubah tagihan saat deploy. Kunci aman disalin
-- justru karena kosong tetap berarti "pakai env".
CREATE TABLE "ai_providers" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- Id tetap, bukan cuid: SQL tidak bisa memanggil cuid(), dan baris ini harus
-- bisa ditunjuk oleh pernyataan-pernyataan di bawah.
INSERT INTO "ai_providers" ("id", "label", "baseUrl", "apiKey", "isDefault", "sortOrder", "updatedAt")
VALUES (
    'prov_sumopod_default',
    'SumoPod',
    'https://ai.sumopod.com/v1',
    COALESCE((SELECT "value" FROM "settings" WHERE "key" = 'ai_api_key'), ''),
    true,
    0,
    CURRENT_TIMESTAMP
);

ALTER TABLE "ai_models" ADD COLUMN "providerId" TEXT;

-- Baris yang punya gateway sendiri (kunci ATAU alamat) dapat providernya
-- sendiri. Memakai apiKey saja akan membuang baseUrl milik baris yang memakai
-- kunci bersama di alamat lain.
INSERT INTO "ai_providers" ("id", "label", "baseUrl", "apiKey", "isDefault", "sortOrder", "updatedAt")
SELECT
    'prov_' || "id",
    'Gateway ' || "label",
    COALESCE(NULLIF(TRIM("baseUrl"), ''), 'https://ai.sumopod.com/v1'),
    COALESCE("apiKey", ''),
    false,
    0,
    CURRENT_TIMESTAMP
FROM "ai_models"
WHERE COALESCE(TRIM("apiKey"), '') <> '' OR COALESCE(TRIM("baseUrl"), '') <> '';

UPDATE "ai_models" SET "providerId" = 'prov_' || "id"
WHERE COALESCE(TRIM("apiKey"), '') <> '' OR COALESCE(TRIM("baseUrl"), '') <> '';

UPDATE "ai_models" SET "providerId" = 'prov_sumopod_default' WHERE "providerId" IS NULL;

ALTER TABLE "ai_models" ALTER COLUMN "providerId" SET NOT NULL;
ALTER TABLE "ai_models" DROP COLUMN "baseUrl";
ALTER TABLE "ai_models" DROP COLUMN "apiKey";

CREATE INDEX "ai_models_providerId_idx" ON "ai_models"("providerId");

-- RESTRICT, bukan SET NULL seperti users.aiModelId. Tenant yang kehilangan
-- pilihan model masih jatuh ke baris bawaan; model yang kehilangan gateway
-- tidak punya cadangan apa pun — ia hanya gagal saat dipanggil.
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Satu tempat kunci berarti satu tempat. Tanpa baris ini tersisa satu Setting
-- yang tidak dibaca siapa pun tetapi terlihat seperti kunci yang berlaku.
DELETE FROM "settings" WHERE "key" = 'ai_api_key';
