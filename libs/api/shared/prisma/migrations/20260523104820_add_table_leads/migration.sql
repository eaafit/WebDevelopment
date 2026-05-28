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

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "applicant_id" UUID NOT NULL,
    "executor_id" UUID,
    "assessment_id" UUID NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "planned_completion_date" TIMESTAMP(3) NOT NULL,
    "actual_completion_date" TIMESTAMP(3),
    "transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_sync_user_id_key" ON "client_sync"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_assessment_id_key" ON "leads"("assessment_id");
SELECT * FROM leads;
SELECT * FROM assessments WHERE id = '88187d29-e7d5-4562-a87d-687d96f4e89c';
SELECT * FROM assessments ;

SELECT l.id, a.id, a.status, a.address
FROM leads l
JOIN assessments a ON l.assessment_id = a.id
WHERE l.applicant_id = 'b3b8fde7-28ee-4e36-ac8a-4c265db55b43';
INSERT INTO leads (
    id,
    applicant_id,
    assessment_id,
    start_date,
    created_at,
    updated_at,
    executor_id,
    planned_completion_date,
    actual_completion_date,
    transaction_id
)
VALUES (
    gen_random_uuid()::text,
    (SELECT id FROM users LIMIT 1)::uuid,
    (SELECT id FROM assessments LIMIT 1)::uuid,
    NOW(),
    NOW(),
    NOW(),
    NULL,                          -- executor_id пока неизвестен
    NOW() + INTERVAL '7 days',     -- планируемая дата завершения
    NULL,                          -- actual_completion_date
    NULL                           -- transaction_id
);
-- CreateIndex
CREATE INDEX "leads_applicant_id_idx" ON "leads"("applicant_id");

-- CreateIndex
CREATE INDEX "leads_executor_id_idx" ON "leads"("executor_id");

-- CreateIndex
CREATE INDEX "leads_assessment_id_idx" ON "leads"("assessment_id");

-- AddForeignKey
ALTER TABLE "bitrix_sync_log" ADD CONSTRAINT "bitrix_sync_log_sync_id_fkey" FOREIGN KEY ("sync_id") REFERENCES "bitrix_sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitrix_sync_log" ADD CONSTRAINT "bitrix_sync_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_sync" ADD CONSTRAINT "client_sync_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_executor_id_fkey" FOREIGN KEY ("executor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
