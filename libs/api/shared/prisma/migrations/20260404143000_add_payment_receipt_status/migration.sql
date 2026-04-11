-- CreateEnum
CREATE TYPE "payment_receipt_status" AS ENUM ('pending', 'available', 'failed');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "receipt_status" "payment_receipt_status";

-- Backfill legacy payment documents as available receipts
UPDATE "payments"
SET "receipt_status" = 'available'::"payment_receipt_status"
WHERE COALESCE(NULLIF(BTRIM("attachment_file_url"), ''), NULL) IS NOT NULL;
