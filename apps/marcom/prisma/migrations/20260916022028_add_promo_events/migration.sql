-- CreateTable
CREATE TABLE "promo_events" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "outlet_id" BIGINT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PROMO',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_promo_events_date" ON "promo_events"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "idx_promo_events_outlet" ON "promo_events"("outlet_id");

-- AddForeignKey
ALTER TABLE "promo_events" ADD CONSTRAINT "promo_events_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
