-- Assessments: notary_id, cancel_reason
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "notary_id" UUID;
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;
ALTER TABLE "assessments" DROP CONSTRAINT IF EXISTS "assessments_notary_id_fkey";
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_notary_id_fkey" FOREIGN KEY ("notary_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Documents: document_type (enum)
DO $$ BEGIN
  CREATE TYPE "document_type" AS ENUM ('passport', 'property_deed', 'technical_plan', 'cadastral_passport', 'photo', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "document_type" "document_type" NOT NULL DEFAULT 'other';

-- Subscriptions: base_price, currency
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "base_price" DECIMAL(15,2);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB';

-- Notifications: read_at
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP;
