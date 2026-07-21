-- Payment-proof image fields for bank-transfer confirmations.
ALTER TABLE "order_requests" ADD COLUMN "proofImage" BYTEA;
ALTER TABLE "order_requests" ADD COLUMN "proofMime" TEXT;
ALTER TABLE "order_requests" ADD COLUMN "proofUploadedAt" TIMESTAMP(3);
