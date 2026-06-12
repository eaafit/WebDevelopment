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
CREATE UNIQUE INDEX "client_sync_user_id_key" ON "client_sync"("user_id");

-- AddForeignKey
ALTER TABLE "bitrix_sync_log" ADD CONSTRAINT "bitrix_sync_log_sync_id_fkey" FOREIGN KEY ("sync_id") REFERENCES "bitrix_sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitrix_sync_log" ADD CONSTRAINT "bitrix_sync_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_sync" ADD CONSTRAINT "client_sync_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
