/*
  Warnings:

  - You are about to drop the column `stripePriceId` on the `courses` table. All the data in the column will be lost.
  - You are about to drop the column `refunded` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `stripeCheckoutSessionId` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `stripeInvoiceId` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `stripePriceIdMonthly` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `stripePriceIdYearly` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the `subscriptions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_planId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_userId_fkey";

-- DropIndex
DROP INDEX "orders_stripeCheckoutSessionId_key";

-- DropIndex
DROP INDEX "orders_stripeInvoiceId_key";

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "stripePriceId",
ADD COLUMN     "priceLabel" TEXT;

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "refunded",
DROP COLUMN "status",
DROP COLUMN "stripeCheckoutSessionId",
DROP COLUMN "stripeInvoiceId",
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "plans" DROP COLUMN "stripePriceIdMonthly",
DROP COLUMN "stripePriceIdYearly",
ADD COLUMN     "priceLabel" TEXT;

-- DropTable
DROP TABLE "subscriptions";
