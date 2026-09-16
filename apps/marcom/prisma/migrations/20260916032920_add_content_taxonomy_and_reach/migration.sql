-- AlterTable
ALTER TABLE "internal_contents" ADD COLUMN     "content_type" TEXT,
ADD COLUMN     "followers_baseline" INTEGER,
ADD COLUMN     "format" TEXT NOT NULL DEFAULT 'VIDEO',
ADD COLUMN     "goal" TEXT,
ADD COLUMN     "post_time" TEXT,
ADD COLUMN     "reach" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Sudah Posting',
ALTER COLUMN "pillar" SET DEFAULT 'PROMO';

-- CreateIndex
CREATE INDEX "idx_internal_content_type" ON "internal_contents"("content_type");

-- CreateIndex
CREATE INDEX "idx_internal_content_format" ON "internal_contents"("format");

-- CreateIndex
CREATE INDEX "idx_internal_content_goal" ON "internal_contents"("goal");
