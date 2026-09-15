-- Generate gambar, potongan pertama.
-- Seluruhnya aditif: dua kolom bernilai bawaan dan satu tabel baru. Baris
-- AiModel yang sudah ada tetap kind = 'chat' tanpa disentuh.

ALTER TABLE "ai_models" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'chat';
ALTER TABLE "ai_models" ADD COLUMN "usdPerImage" DOUBLE PRECISION;

CREATE TABLE "image_generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aiModelId" TEXT,
    "prompt" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "providerUrl" TEXT,
    "urlExpiresAt" TIMESTAMP(3),
    "thumbnail" BYTEA,
    "thumbMime" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_generations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "image_generations_userId_createdAt_idx" ON "image_generations"("userId", "createdAt");

ALTER TABLE "image_generations" ADD CONSTRAINT "image_generations_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
