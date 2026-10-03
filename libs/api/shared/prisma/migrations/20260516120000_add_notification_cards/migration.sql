ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'in_app';

CREATE TYPE "notification_category" AS ENUM (
  'application',
  'document',
  'payment',
  'system',
  'assessment'
);

ALTER TABLE "notifications"
  ADD COLUMN "category" "notification_category" NOT NULL DEFAULT 'system',
  ADD COLUMN "title" VARCHAR NOT NULL DEFAULT 'Уведомление';
