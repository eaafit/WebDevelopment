ALTER TABLE "audit_logs"
  ADD COLUMN "actor_email" VARCHAR,
  ADD COLUMN "actor_name" VARCHAR,
  ADD COLUMN "actor_role" "role";

UPDATE "audit_logs" AS audit
SET
  "actor_email" = "users"."email",
  "actor_name" = "users"."full_name",
  "actor_role" = "users"."role"
FROM "users"
WHERE audit."user_id" = "users"."id";

ALTER TABLE "audit_logs"
  ALTER COLUMN "user_id" DROP NOT NULL,
  ALTER COLUMN "entity_id" DROP NOT NULL;

CREATE INDEX "audit_logs_actor_email_idx" ON "audit_logs" ("actor_email");
CREATE INDEX "audit_logs_actor_name_idx" ON "audit_logs" ("actor_name");
