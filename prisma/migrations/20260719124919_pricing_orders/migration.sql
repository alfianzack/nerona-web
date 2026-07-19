-- AlterTable
ALTER TABLE "agent_profiles" ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free';

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "generationLimit" INTEGER;

-- CreateTable
CREATE TABLE "order_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "contactNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),
    "fulfilledById" TEXT,

    CONSTRAINT "order_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "order_requests" ADD CONSTRAINT "order_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_requests" ADD CONSTRAINT "order_requests_fulfilledById_fkey" FOREIGN KEY ("fulfilledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
