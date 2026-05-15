-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "assessment_email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "assessment_push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "assessment_in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "payment_email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "payment_push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "payment_in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "system_email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "system_push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "system_in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
