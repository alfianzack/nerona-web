-- CreateTable
CREATE TABLE "metadata_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "keywordCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metadata_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metadata_logs_userId_createdAt_idx" ON "metadata_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "metadata_logs_createdAt_idx" ON "metadata_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "metadata_logs" ADD CONSTRAINT "metadata_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
