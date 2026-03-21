-- CreateEnum
CREATE TYPE "real_estate_object_type" AS ENUM (
    'apartment',
    'house',
    'room',
    'apartments',
    'land_plot',
    'commercial_property',
    'other'
);

-- CreateEnum
CREATE TYPE "real_estate_condition" AS ENUM (
    'excellent',
    'good',
    'satisfactory',
    'poor'
);

-- CreateEnum
CREATE TYPE "wall_material" AS ENUM (
    'brick',
    'panel',
    'block',
    'monolithic',
    'monolithic_brick',
    'wooden',
    'aerated_concrete'
);

-- CreateEnum
CREATE TYPE "elevator_type" AS ENUM (
    'none',
    'cargo',
    'passenger',
    'passenger_and_cargo'
);

-- AlterTable
ALTER TABLE "assessments"
ADD COLUMN "real_estate_object_id" UUID;

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "name" VARCHAR NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "name" VARCHAR NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "real_estate_objects" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "district_id" UUID,
    "address" VARCHAR NOT NULL,
    "cadastral_number" VARCHAR,
    "area" DECIMAL(10,2) NOT NULL,
    "object_type" "real_estate_object_type" NOT NULL,
    "rooms_count" INTEGER,
    "floors_total" INTEGER,
    "floor" INTEGER,
    "condition" "real_estate_condition",
    "year_built" INTEGER,
    "wall_material" "wall_material",
    "elevator_type" "elevator_type",
    "has_balcony_or_loggia" BOOLEAN,
    "land_category" VARCHAR,
    "permitted_use" VARCHAR,
    "utilities" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "real_estate_objects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_key" ON "cities"("name");

-- CreateIndex
CREATE INDEX "districts_city_id_idx" ON "districts"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "districts_city_id_name_key" ON "districts"("city_id", "name");

-- CreateIndex
CREATE INDEX "real_estate_objects_city_id_idx" ON "real_estate_objects"("city_id");

-- CreateIndex
CREATE INDEX "real_estate_objects_district_id_idx" ON "real_estate_objects"("district_id");

-- CreateIndex
CREATE INDEX "real_estate_objects_object_type_idx" ON "real_estate_objects"("object_type");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_real_estate_object_id_key" ON "assessments"("real_estate_object_id");

-- AddForeignKey
ALTER TABLE "districts"
ADD CONSTRAINT "districts_city_id_fkey"
FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_estate_objects"
ADD CONSTRAINT "real_estate_objects_city_id_fkey"
FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_estate_objects"
ADD CONSTRAINT "real_estate_objects_district_id_fkey"
FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments"
ADD CONSTRAINT "assessments_real_estate_object_id_fkey"
FOREIGN KEY ("real_estate_object_id") REFERENCES "real_estate_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
