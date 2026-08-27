-- Preset prompt metadata milik tenant.
--
-- Tidak ada baris yang dibuat untuk siapa pun: tabel kosong berarti setiap
-- tenant tetap memakai prompt Nerona, persis seperti sebelum migrasi ini.
-- Prompt kustom baru berlaku setelah tenant menulisnya sendiri dan
-- menyalakannya.
CREATE TABLE "prompt_presets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_presets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "prompt_presets_userId_idx" ON "prompt_presets"("userId");

ALTER TABLE "prompt_presets" ADD CONSTRAINT "prompt_presets_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
