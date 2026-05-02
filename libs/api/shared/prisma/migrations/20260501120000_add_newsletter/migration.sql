CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "newsletter_subscription_status" AS ENUM ('active', 'unsubscribed');

-- CreateEnum
CREATE TYPE "newsletter_audience_type" AS ENUM ('all', 'role', 'selected');

-- CreateEnum
CREATE TYPE "newsletter_campaign_status" AS ENUM ('sending', 'sent', 'failed', 'partial_failed');

-- CreateEnum
CREATE TYPE "newsletter_delivery_status" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "newsletter_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "newsletter_subscription_status" NOT NULL DEFAULT 'active',
    "subscribed_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "newsletter_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_campaigns" (
    "id" UUID NOT NULL,
    "created_by" UUID,
    "subject" VARCHAR(200) NOT NULL,
    "body_html" TEXT NOT NULL,
    "audience_type" "newsletter_audience_type" NOT NULL,
    "audience_role" "role",
    "audience_label" VARCHAR(255) NOT NULL,
    "recipients_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "status" "newsletter_campaign_status" NOT NULL DEFAULT 'sending',
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP,

    CONSTRAINT "newsletter_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_deliveries" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "user_id" UUID,
    "email" VARCHAR NOT NULL,
    "full_name" VARCHAR NOT NULL,
    "status" "newsletter_delivery_status" NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP,

    CONSTRAINT "newsletter_deliveries_pkey" PRIMARY KEY ("id")
);

-- Backfill subscriptions for existing users.
INSERT INTO "newsletter_subscriptions" ("id", "user_id", "status", "subscribed_at", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", 'active', "created_at", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users"
WHERE NOT EXISTS (
    SELECT 1
    FROM "newsletter_subscriptions"
    WHERE "newsletter_subscriptions"."user_id" = "users"."id"
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriptions_user_id_key" ON "newsletter_subscriptions"("user_id");
CREATE INDEX "newsletter_subscriptions_status_idx" ON "newsletter_subscriptions"("status");
CREATE INDEX "newsletter_subscriptions_subscribed_at_idx" ON "newsletter_subscriptions"("subscribed_at" DESC);
CREATE INDEX "newsletter_campaigns_created_at_idx" ON "newsletter_campaigns"("created_at" DESC);
CREATE INDEX "newsletter_campaigns_status_idx" ON "newsletter_campaigns"("status");
CREATE INDEX "newsletter_campaigns_created_by_idx" ON "newsletter_campaigns"("created_by");
CREATE UNIQUE INDEX "newsletter_deliveries_campaign_id_email_key" ON "newsletter_deliveries"("campaign_id", "email");
CREATE INDEX "newsletter_deliveries_campaign_id_idx" ON "newsletter_deliveries"("campaign_id");
CREATE INDEX "newsletter_deliveries_user_id_idx" ON "newsletter_deliveries"("user_id");
CREATE INDEX "newsletter_deliveries_status_idx" ON "newsletter_deliveries"("status");

-- AddForeignKey
ALTER TABLE "newsletter_subscriptions"
ADD CONSTRAINT "newsletter_subscriptions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "newsletter_campaigns"
ADD CONSTRAINT "newsletter_campaigns_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "newsletter_deliveries"
ADD CONSTRAINT "newsletter_deliveries_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "newsletter_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "newsletter_deliveries"
ADD CONSTRAINT "newsletter_deliveries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
