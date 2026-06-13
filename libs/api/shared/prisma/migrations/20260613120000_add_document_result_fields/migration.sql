-- AlterTable: готовая копия (скан-результат нотариуса) отдельно от файла-основания
ALTER TABLE "documents" ADD COLUMN "result_bucket_name" VARCHAR,
ADD COLUMN "result_object_key" VARCHAR,
ADD COLUMN "result_file_name" VARCHAR,
ADD COLUMN "result_file_size" INTEGER;
