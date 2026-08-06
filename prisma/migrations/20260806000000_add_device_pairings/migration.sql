-- CreateTable
CREATE TABLE "device_pairings" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "deviceSecret" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "tokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_pairings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_pairings_code_key" ON "device_pairings"("code");
CREATE UNIQUE INDEX "device_pairings_deviceSecret_key" ON "device_pairings"("deviceSecret");
CREATE INDEX "device_pairings_expiresAt_idx" ON "device_pairings"("expiresAt");

-- AddForeignKey
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_tokenId_fkey"
  FOREIGN KEY ("tokenId") REFERENCES "extension_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
