-- Documents: store S3-style object key + metadata instead of a flat file_path.
-- No-op when object_key already exists (e.g. environments provisioned with the newer shape).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'file_path'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'object_key'
  ) THEN
    ALTER TABLE "documents" ADD COLUMN "object_key" VARCHAR NOT NULL DEFAULT '';
    ALTER TABLE "documents" ADD COLUMN "file_size" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "documents" ADD COLUMN "bucket_name" VARCHAR NOT NULL DEFAULT 'documents';
    UPDATE "documents" SET "object_key" = "file_path";
    ALTER TABLE "documents" ALTER COLUMN "object_key" DROP DEFAULT;
    ALTER TABLE "documents" ALTER COLUMN "file_size" DROP DEFAULT;
    ALTER TABLE "documents" ALTER COLUMN "bucket_name" DROP DEFAULT;
    ALTER TABLE "documents" DROP COLUMN "file_path";
  END IF;
END $$;
