-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('pending_payment', 'paid', 'in_progress', 'ready', 'delivered', 'cancelled');

-- AlterTable: собственный статус заказа копии, комментарий заявителя и стоимость
ALTER TABLE "documents" ADD COLUMN "status" "document_status" NOT NULL DEFAULT 'pending_payment',
ADD COLUMN "comment" TEXT,
ADD COLUMN "price" INTEGER NOT NULL DEFAULT 0;
