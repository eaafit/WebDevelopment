-- Rework notification_preferences: one row per (user, channel, entity_category)

DO $$ BEGIN
    CREATE TYPE "notification_preference_channel" AS ENUM ('email', 'sms', 'push', 'in_app');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "notification_entity_category" AS ENUM ('assessment', 'payment', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "notification_preference_status" AS ENUM ('active', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "notification_preference_channel" NOT NULL,
    "entity_category" "notification_entity_category" NOT NULL,
    "status" "notification_preference_status" NOT NULL DEFAULT 'active',
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_preferences_user_id_channel_entity_category_key"
    ON "notification_preferences"("user_id", "channel", "entity_category");

CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
