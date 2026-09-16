-- CreateTable
CREATE TABLE "internal_contents" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'TIKTOK',
    "pillar" TEXT NOT NULL DEFAULT 'REVIEW_RASA',
    "creator" TEXT,
    "outlet_id" BIGINT,
    "post_url" TEXT,
    "post_date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_contents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_internal_content_pillar" ON "internal_contents"("pillar");

-- CreateIndex
CREATE INDEX "idx_internal_content_platform" ON "internal_contents"("platform");

-- CreateIndex
CREATE INDEX "idx_internal_content_date" ON "internal_contents"("post_date");

-- CreateIndex
CREATE INDEX "idx_internal_content_outlet" ON "internal_contents"("outlet_id");

-- AddForeignKey
ALTER TABLE "internal_contents" ADD CONSTRAINT "internal_contents_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
