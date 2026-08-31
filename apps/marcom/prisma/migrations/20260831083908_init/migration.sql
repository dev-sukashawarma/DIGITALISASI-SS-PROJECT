-- CreateTable
CREATE TABLE "outlets" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kols" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tiktok_url" TEXT,
    "instagram_url" TEXT,
    "phone_number" TEXT,
    "bank_account" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "endorsements" (
    "id" BIGSERIAL NOT NULL,
    "kol_id" BIGINT NOT NULL,
    "outlet_id" BIGINT NOT NULL,
    "schedule_date" DATE NOT NULL,
    "rate_card" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "post_url" TEXT,
    "initial_views" INTEGER,
    "final_views" INTEGER,
    "visit_status" TEXT NOT NULL DEFAULT 'PENDING',
    "post_status" TEXT NOT NULL DEFAULT 'OFF',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" BIGSERIAL NOT NULL,
    "outlet_id" BIGINT NOT NULL,
    "schedule_date" DATE NOT NULL,
    "budget" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ad_url" TEXT,
    "initial_views" INTEGER,
    "final_views" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OFF',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outlets_name_key" ON "outlets"("name");

-- CreateIndex
CREATE INDEX "idx_endorsements_kol_id" ON "endorsements"("kol_id");

-- CreateIndex
CREATE INDEX "idx_endorsements_outlet_id" ON "endorsements"("outlet_id");

-- CreateIndex
CREATE INDEX "idx_endorsements_date" ON "endorsements"("schedule_date");

-- CreateIndex
CREATE INDEX "idx_ads_outlet_id" ON "ads"("outlet_id");

-- CreateIndex
CREATE INDEX "idx_ads_schedule_date" ON "ads"("schedule_date");

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_kol_id_fkey" FOREIGN KEY ("kol_id") REFERENCES "kols"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
