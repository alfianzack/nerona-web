-- Registri model AI, dengan tarif menempel pada barisnya sendiri.
--
-- SENGAJA tidak menyisipkan baris apa pun. Seed dari `settings` tidak bisa
-- membaca rantai fallback env (AI_PRICE_IN / POINTS_PER_USD), jadi kalau
-- Setting-nya kosong tapi env-nya terisi, seed akan menyalin default KODE dan
-- diam-diam mengubah tagihan pada deploy. Gantinya, resolveAiForUser jatuh ke
-- getAiSettings() selama tabel ini kosong: nol baris = perilaku hari ini.
CREATE TABLE "ai_models" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "note" TEXT,
    "inPerMTok" DOUBLE PRECISION NOT NULL,
    "outPerMTok" DOUBLE PRECISION NOT NULL,
    "vision" BOOLEAN NOT NULL DEFAULT true,
    "paidOnly" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "baseUrl" TEXT,
    "apiKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- Pilihan tenant. NULL = pakai baris bawaan owner.
ALTER TABLE "users" ADD COLUMN "aiModelId" TEXT;

CREATE INDEX "users_aiModelId_idx" ON "users"("aiModelId");

-- SET NULL, bukan CASCADE: menghapus satu model tidak boleh menghapus
-- penggunanya. Yang kehilangan pilihan jatuh ke bawaan owner.
ALTER TABLE "users" ADD CONSTRAINT "users_aiModelId_fkey"
    FOREIGN KEY ("aiModelId") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
