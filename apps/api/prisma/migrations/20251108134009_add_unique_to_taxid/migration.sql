/*
  Warnings:

  - A unique constraint covering the columns `[taxId]` on the table `Vendor` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Vendor" ALTER COLUMN "taxId" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_taxId_key" ON "Vendor"("taxId");
