-- AlterTable
ALTER TABLE "internal_contents" ADD COLUMN     "is_ads" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "idx_internal_content_ads" ON "internal_contents"("is_ads");
