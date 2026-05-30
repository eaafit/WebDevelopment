ALTER TABLE "documents" RENAME COLUMN "file_path" TO "object_key";

ALTER TABLE "documents"
ADD COLUMN "file_size" INTEGER,
ADD COLUMN "bucket_name" VARCHAR;

UPDATE "documents"
SET
  "file_size" = COALESCE("file_size", 0),
  "bucket_name" = COALESCE("bucket_name", 'assessment-files'),
  "object_key" = CASE
    WHEN "object_key" LIKE '/uploads/%' THEN regexp_replace("object_key", '^/uploads/?', 'legacy/')
    ELSE "object_key"
  END;

ALTER TABLE "documents"
ALTER COLUMN "file_size" SET NOT NULL,
ALTER COLUMN "bucket_name" SET NOT NULL;
