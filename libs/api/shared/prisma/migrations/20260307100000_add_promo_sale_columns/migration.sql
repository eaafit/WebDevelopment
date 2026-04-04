-- Promos: add columns to match schema (discount_percent required for seed)
ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "usage_limit" INTEGER;
ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "used_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "promos" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP;

-- Sales: replace source_id with subscription_id and promo_id, add is_active
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "subscription_id" UUID;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "promo_id" UUID;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "sales" ADD CONSTRAINT "sales_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "promos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales" DROP COLUMN IF EXISTS "source_id";

-- Payments: add promo_id and discount_amount if missing
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "promo_id" UUID;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(15,2);
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_promo_id_fkey";
ALTER TABLE "payments" ADD CONSTRAINT "payments_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "promos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
