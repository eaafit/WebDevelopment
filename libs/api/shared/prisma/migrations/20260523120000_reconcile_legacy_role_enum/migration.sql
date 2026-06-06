-- Reconcile role enum values left by migrations from other branches
-- (e.g. marketplace_customer_role renamed applicant -> customer).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'role' AND e.enumlabel = 'customer'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'role' AND e.enumlabel = 'applicant'
  ) THEN
    ALTER TYPE "role" RENAME VALUE 'customer' TO 'applicant';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'role' AND e.enumlabel = 'psyconsallt'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'role' AND e.enumlabel = 'notary'
  ) THEN
    ALTER TYPE "role" RENAME VALUE 'psyconsallt' TO 'notary';
  END IF;
END $$;

-- Reconcile assessments.notary_id column name from legacy mindforge migrations.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessments' AND column_name = 'psyconsallt_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assessments' AND column_name = 'notary_id'
  ) THEN
    ALTER TABLE "assessments" DROP CONSTRAINT IF EXISTS "assessments_psyconsallt_id_fkey";
    ALTER TABLE "assessments" RENAME COLUMN "psyconsallt_id" TO "notary_id";
    ALTER TABLE "assessments" DROP CONSTRAINT IF EXISTS "assessments_notary_id_fkey";
    ALTER TABLE "assessments" ADD CONSTRAINT "assessments_notary_id_fkey"
      FOREIGN KEY ("notary_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'applicant';
