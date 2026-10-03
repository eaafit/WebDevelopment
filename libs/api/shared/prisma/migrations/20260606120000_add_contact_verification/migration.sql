-- CreateTable
CREATE TABLE "contact_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" VARCHAR NOT NULL,
    "expires_at" TIMESTAMP NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMP NOT NULL,
    "confirmed_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_verifications_user_id_key" ON "contact_verifications"("user_id");

-- AddForeignKey
ALTER TABLE "contact_verifications" ADD CONSTRAINT "contact_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
