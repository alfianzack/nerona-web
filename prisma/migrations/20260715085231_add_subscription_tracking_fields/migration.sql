/*
  Warnings:

  - Added the required column `stripeCustomerId` to the `subscriptions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "pastDueSince" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT NOT NULL;
