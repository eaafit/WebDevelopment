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

-- CreateTable
CREATE TABLE "bitrix_config" (
    "id" UUID NOT NULL,
    "portal_url" VARCHAR(255) NOT NULL,
    "member_id" VARCHAR(100) NOT NULL,
    "access_token" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitrix_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitrix_sync" (
    "id" UUID NOT NULL,
    "job_id" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "total_users" INTEGER NOT NULL DEFAULT 0,
    "processed_users" INTEGER NOT NULL DEFAULT 0,
    "successful_syncs" INTEGER NOT NULL DEFAULT 0,
    "failed_syncs" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP NOT NULL,
    "completed_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitrix_sync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitrix_sync_log" (
    "id" UUID NOT NULL,
    "sync_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "bitrix_contact_id" VARCHAR(50),
    "action" VARCHAR(20) NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "message" TEXT,
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitrix_sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_sync" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "bitrix_contact_id" VARCHAR(50),
    "sync_direction" VARCHAR(10) NOT NULL DEFAULT 'notary',
    "last_synced_at" TIMESTAMP,
    "last_notary_hash" VARCHAR(64),
    "last_bitrix_hash" VARCHAR(64),
    "conflict_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_sync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriptions_user_id_key" ON "newsletter_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "newsletter_subscriptions_status_idx" ON "newsletter_subscriptions"("status");

-- CreateIndex
CREATE INDEX "newsletter_subscriptions_subscribed_at_idx" ON "newsletter_subscriptions"("subscribed_at" DESC);

-- CreateIndex
CREATE INDEX "newsletter_campaigns_created_at_idx" ON "newsletter_campaigns"("created_at" DESC);

-- CreateIndex
CREATE INDEX "newsletter_campaigns_status_idx" ON "newsletter_campaigns"("status");

-- CreateIndex
CREATE INDEX "newsletter_campaigns_created_by_idx" ON "newsletter_campaigns"("created_by");

-- CreateIndex
CREATE INDEX "newsletter_deliveries_campaign_id_idx" ON "newsletter_deliveries"("campaign_id");

-- CreateIndex
CREATE INDEX "newsletter_deliveries_user_id_idx" ON "newsletter_deliveries"("user_id");

-- CreateIndex
CREATE INDEX "newsletter_deliveries_status_idx" ON "newsletter_deliveries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_deliveries_campaign_id_email_key" ON "newsletter_deliveries"("campaign_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "client_sync_user_id_key" ON "client_sync"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_type_idx" ON "audit_logs"("action_type");

-- CreateIndex
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_name_entity_id_idx" ON "audit_logs"("entity_name", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_name_entity_id_timestamp_idx" ON "audit_logs"("entity_name", "entity_id", "timestamp" DESC);

-- AddForeignKey
ALTER TABLE "newsletter_subscriptions" ADD CONSTRAINT "newsletter_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_campaigns" ADD CONSTRAINT "newsletter_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "newsletter_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitrix_sync_log" ADD CONSTRAINT "bitrix_sync_log_sync_id_fkey" FOREIGN KEY ("sync_id") REFERENCES "bitrix_sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitrix_sync_log" ADD CONSTRAINT "bitrix_sync_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_sync" ADD CONSTRAINT "client_sync_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
