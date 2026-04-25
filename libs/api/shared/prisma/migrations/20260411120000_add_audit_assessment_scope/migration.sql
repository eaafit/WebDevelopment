CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" ("timestamp" DESC);
CREATE INDEX "audit_logs_action_type_idx" ON "audit_logs" ("action_type");
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs" ("entity_id");
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" ("user_id");
CREATE INDEX "audit_logs_entity_name_entity_id_idx" ON "audit_logs" ("entity_name", "entity_id");
CREATE INDEX "audit_logs_entity_name_entity_id_timestamp_idx" ON "audit_logs" ("entity_name", "entity_id", "timestamp" DESC);
