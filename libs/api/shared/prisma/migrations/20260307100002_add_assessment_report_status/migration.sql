-- CreateEnum for report status (used by assessment_reports)
DO $$ BEGIN
  CREATE TYPE "report_status" AS ENUM ('draft', 'signed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add status column to assessment_reports
ALTER TABLE "assessment_reports" ADD COLUMN IF NOT EXISTS "status" "report_status" NOT NULL DEFAULT 'draft';
