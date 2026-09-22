-- CreateIndex: Optimasi Endorsements (Outlet + Schedule Date, Visit Status + Schedule Date, Payment Status + Schedule Date)
CREATE INDEX IF NOT EXISTS "idx_endorsements_outlet_schedule" ON "endorsements"("outlet_id", "schedule_date");
CREATE INDEX IF NOT EXISTS "idx_endorsements_visit_schedule" ON "endorsements"("visit_status", "schedule_date");
CREATE INDEX IF NOT EXISTS "idx_endorsements_payment_schedule" ON "endorsements"("payment_status", "schedule_date");

-- CreateIndex: Optimasi Relasi Posts (Mencegah In-Memory Sort pada query relasi posts berurutan)
CREATE INDEX IF NOT EXISTS "idx_endorsement_posts_endorsement_created" ON "endorsement_posts"("endorsement_id", "created_at");

-- CreateIndex: Optimasi Ads (Outlet + Schedule Date, Status + Schedule Date)
CREATE INDEX IF NOT EXISTS "idx_ads_outlet_schedule" ON "ads"("outlet_id", "schedule_date");
CREATE INDEX IF NOT EXISTS "idx_ads_status_schedule" ON "ads"("status", "schedule_date");

-- CreateIndex: Optimasi Internal Contents (Outlet/Platform/Pilar + Post Date)
CREATE INDEX IF NOT EXISTS "idx_internal_content_outlet_date" ON "internal_contents"("outlet_id", "post_date");
CREATE INDEX IF NOT EXISTS "idx_internal_content_platform_date" ON "internal_contents"("platform", "post_date");
CREATE INDEX IF NOT EXISTS "idx_internal_content_pillar_date" ON "internal_contents"("pillar", "post_date");
