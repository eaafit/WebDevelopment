ALTER TABLE "audit_logs"
ADD COLUMN "assessment_id" UUID;

UPDATE "audit_logs"
SET "assessment_id" = "entity_id"
WHERE "entity_name" = 'Assessment';

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_assessment_id_fkey"
FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" ("timestamp" DESC);
CREATE INDEX "audit_logs_action_type_idx" ON "audit_logs" ("action_type");
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs" ("entity_id");
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" ("user_id");
CREATE INDEX "audit_logs_assessment_id_idx" ON "audit_logs" ("assessment_id");
CREATE INDEX "audit_logs_assessment_id_timestamp_idx" ON "audit_logs" ("assessment_id", "timestamp" DESC);
