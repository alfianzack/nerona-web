-- Pemakaian token yang benar-benar terjadi, per panggilan yang ditagih.
--
-- Estimasi "poin per gambar" selama ini memakai profil token konstan. Konstanta
-- itu sempat meleset separuh dan tidak ada yang menangkapnya, karena tidak ada
-- satu pun angka nyata untuk dibandingkan. Tabel ini yang menyediakannya.
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aiModelId" TEXT,
    "feature" TEXT NOT NULL,
    "withImage" BOOLEAN NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_usage_logs_aiModelId_withImage_createdAt_idx" ON "ai_usage_logs"("aiModelId", "withImage", "createdAt");
CREATE INDEX "ai_usage_logs_userId_createdAt_idx" ON "ai_usage_logs"("userId", "createdAt");

ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, bukan CASCADE: menghapus sebuah model tidak boleh menghapus riwayat
-- pemakaiannya. Barisnya tetap berguna sebagai catatan tagihan.
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_aiModelId_fkey"
    FOREIGN KEY ("aiModelId") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
